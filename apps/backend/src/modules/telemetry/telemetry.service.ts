import type {
  EventDefinition,
  ProductEventCaptureRequest,
  ProductEventCaptureResponse,
  ProductEventSource,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type { PoolClient, QueryResultRow } from 'pg';
import { eventCatalogByName } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { RequestMeta } from '../stage7-support/stage7.helpers';

interface IdRow {
  readonly id: string;
}

interface PersistProductEventInput {
  readonly eventId: string;
  readonly actorUserId: string | null;
  readonly workspaceId: string;
  readonly sessionId: string | null;
  readonly traceId: string | null;
  readonly eventName: string;
  readonly source: ProductEventSource;
  readonly eventTime: string;
  readonly resourceType?: string | null;
  readonly resourceId?: string | null;
  readonly processInstanceId?: string | null;
  readonly runId?: string | null;
  readonly properties: Record<string, unknown>;
  readonly clientEventId?: string | null;
  readonly idempotencyKey?: string | null;
}

type Queryable = Pick<PoolClient, 'query'> | DatabaseService;

@Injectable()
export class TelemetryService {
  constructor(private readonly databaseService: DatabaseService) {}

  async captureFromFrontend(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: ProductEventCaptureRequest,
    meta: RequestMeta,
  ): Promise<ProductEventCaptureResponse> {
    const traceId = input.traceId || meta.traceId || randomUUID();
    const eventId = randomUUID();

    if (input.workspaceId !== access.activeWorkspace?.id) {
      return this.quarantine(
        {
          eventId,
          actorUserId: actor.id,
          workspaceId: access.activeWorkspace!.id,
          sessionId: input.sessionId,
          traceId,
          eventName: input.eventName,
          source: input.source ?? 'frontend',
          eventTime: input.eventTime,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          processInstanceId: input.processInstanceId,
          runId: input.runId,
          properties: input.properties,
          clientEventId: input.clientEventId,
          idempotencyKey: input.idempotencyKey,
        },
        'workspace_mismatch',
      );
    }

    return this.persistValidatedEvent(
      {
        eventId,
        actorUserId: actor.id,
        workspaceId: access.activeWorkspace!.id,
        sessionId: input.sessionId,
        traceId,
        eventName: input.eventName,
        source: input.source ?? 'frontend',
        eventTime: input.eventTime,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        processInstanceId: input.processInstanceId,
        runId: input.runId,
        properties: input.properties,
        clientEventId: input.clientEventId,
        idempotencyKey: input.idempotencyKey,
      },
      undefined,
      true,
    );
  }

  async enqueueAuthoritativeEvent(
    input: Omit<PersistProductEventInput, 'eventId'>,
    options: {
      readonly client?: PoolClient;
    } = {},
  ) {
    const response = await this.persistValidatedEvent(
      {
        ...input,
        eventId: randomUUID(),
      },
      options.client,
      false,
    );

    return response.outboxId;
  }

  private async persistValidatedEvent(
    input: PersistProductEventInput,
    client?: PoolClient,
    allowQuarantine = true,
  ): Promise<ProductEventCaptureResponse> {
    const definition = eventCatalogByName[input.eventName];

    if (!definition) {
      return this.quarantine(input, 'unknown_event', client);
    }

    if (!definition.allowedSources.includes(input.source)) {
      return this.quarantine(input, 'source_not_allowed', client);
    }

    const scrubbed = scrubProperties(definition, input.properties);
    const missingFields = collectMissingFields(
      definition,
      input,
      scrubbed.properties,
    );

    if (
      (missingFields.length > 0 || scrubbed.removedKeys.length > 0) &&
      allowQuarantine
    ) {
      return this.quarantine(
        {
          ...input,
          properties: scrubbed.properties,
        },
        missingFields.length > 0
          ? `missing_required:${missingFields.join(',')}`
          : `denylist_field:${scrubbed.removedKeys.join(',')}`,
        client,
      );
    }

    const outboxId = await this.insertOutbox(
      {
        ...input,
        properties: scrubbed.properties,
      },
      definition,
      client,
    );

    return {
      status: 'queued',
      eventId: input.eventId,
      outboxId,
      quarantineId: null,
      traceId: input.traceId ?? input.eventId,
    };
  }

  private async insertOutbox(
    input: PersistProductEventInput,
    definition: EventDefinition,
    client?: PoolClient,
  ) {
    const payloadHash = hashPayload({
      eventName: input.eventName,
      source: input.source,
      eventTime: input.eventTime,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      processInstanceId: input.processInstanceId ?? null,
      runId: input.runId ?? null,
      properties: input.properties,
    });
    const result = await this.runQuery<IdRow>(
      this.getQueryable(client),
      `
        insert into app.product_event_outbox (
          id,
          event_id,
          workspace_id,
          actor_user_id,
          session_id,
          trace_id,
          event_name,
          event_group,
          activity_code,
          schema_version,
          source,
          privacy_class,
          risk_level,
          process_instance_id,
          run_id,
          resource_type,
          resource_id,
          event_time,
          properties,
          payload_hash,
          client_event_id,
          idempotency_key,
          status
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19::jsonb,
          $20,
          $21,
          $22,
          'pending'
        )
        on conflict (workspace_id, source, client_event_id)
          where client_event_id is not null
        do update
          set updated_at = timezone('utc', now())
        returning id
      `,
      [
        randomUUID(),
        input.eventId,
        input.workspaceId,
        input.actorUserId,
        input.sessionId,
        input.traceId,
        input.eventName,
        definition.eventGroup,
        definition.activityCode,
        definition.schemaVersion,
        input.source,
        definition.privacyClass,
        definition.riskLevel,
        input.processInstanceId ?? null,
        input.runId ?? null,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.eventTime,
        JSON.stringify(input.properties),
        payloadHash,
        input.clientEventId ?? null,
        input.idempotencyKey ?? input.clientEventId ?? null,
      ],
    );

    return result.rows[0]?.id ?? null;
  }

  private async quarantine(
    input: PersistProductEventInput,
    reasonCode: string,
    client?: PoolClient,
  ): Promise<ProductEventCaptureResponse> {
    const result = await this.runQuery<IdRow>(
      this.getQueryable(client),
      `
        insert into app.product_event_quarantine (
          id,
          event_id,
          workspace_id,
          actor_user_id,
          session_id,
          trace_id,
          event_name,
          source,
          reason_code,
          resource_type,
          resource_id,
          process_instance_id,
          run_id,
          event_time,
          properties,
          client_event_id,
          idempotency_key
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15::jsonb,
          $16,
          $17
        )
        returning id
      `,
      [
        randomUUID(),
        input.eventId,
        input.workspaceId,
        input.actorUserId,
        input.sessionId,
        input.traceId,
        input.eventName,
        input.source,
        reasonCode,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.processInstanceId ?? null,
        input.runId ?? null,
        input.eventTime,
        JSON.stringify(input.properties),
        input.clientEventId ?? null,
        input.idempotencyKey ?? input.clientEventId ?? null,
      ],
    );

    return {
      status: 'quarantined',
      eventId: input.eventId,
      outboxId: null,
      quarantineId: result.rows[0]?.id ?? null,
      traceId: input.traceId ?? input.eventId,
    };
  }

  private getQueryable(client?: PoolClient): Queryable {
    return client ?? this.databaseService;
  }

  private runQuery<T extends QueryResultRow>(
    queryable: Queryable,
    text: string,
    values: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[] }> {
    if (queryable instanceof DatabaseService) {
      return queryable.query<T>(text, values);
    }

    return queryable.query(text, [...values]) as unknown as Promise<{
      readonly rows: readonly T[];
    }>;
  }
}

function scrubProperties(
  definition: EventDefinition,
  properties: Record<string, unknown>,
) {
  const removedKeys: string[] = [];
  const next = Object.fromEntries(
    Object.entries(properties).filter(([key]) => {
      const keep = !definition.denylistFields.includes(key);

      if (!keep) {
        removedKeys.push(key);
      }

      return keep;
    }),
  );

  return {
    properties: next,
    removedKeys,
  };
}

function collectMissingFields(
  definition: EventDefinition,
  input: PersistProductEventInput,
  properties: Record<string, unknown>,
) {
  const envelope = {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    traceId: input.traceId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    processInstanceId: input.processInstanceId,
    runId: input.runId,
    actorUserId: input.actorUserId,
    ...properties,
  };

  return definition.requiredFields.filter((field) => {
    const candidate = envelope[field as keyof typeof envelope];
    return candidate === undefined || candidate === null || candidate === '';
  });
}

function hashPayload(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
