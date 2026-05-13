import type {
  ChatRouteSnapshot,
  ChatStreamEvent,
  ChatStreamSnapshot,
} from '@lexframe/contracts';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface CreateStreamSnapshotInput {
  readonly streamId?: string;
  readonly workspaceId: string;
  readonly threadId: string;
  readonly messageId: string;
  readonly routeSnapshot: ChatRouteSnapshot;
  readonly text: string;
  readonly status?: ChatStreamSnapshot['status'];
  readonly clientMessageId?: string | null;
  readonly userMessage?: ChatStreamSnapshot['userMessage'];
  readonly assistantMessage?: ChatStreamSnapshot['assistantMessage'];
}

@Injectable()
export class ChatStreamService {
  createStreamSnapshot(input: CreateStreamSnapshotInput): ChatStreamSnapshot {
    const streamId = input.streamId ?? randomUUID();
    const safeRoute = redactRouteSnapshot(input.routeSnapshot);
    const events: ChatStreamEvent[] = [
      {
        type: 'message_start',
        payload: {
          streamId,
          threadId: input.threadId,
          messageId: input.messageId,
          traceId: input.routeSnapshot.traceId,
        },
      },
      {
        type: 'run_status',
        payload: {
          streamId,
          threadId: input.threadId,
          messageId: input.messageId,
          status: input.status ?? 'completed',
        },
      },
      {
        type: 'route_snapshot',
        payload: safeRoute,
      },
      {
        type: 'text_delta',
        payload: {
          messageId: input.messageId,
          delta: input.text,
        },
      },
      {
        type: 'usage',
        payload: {
          inputTokens: Math.max(1, Math.ceil(input.text.length / 8)),
          outputTokens: Math.max(1, Math.ceil(input.text.length / 4)),
          source: 'gateway_estimated',
        },
      },
      {
        type: 'message_done',
        payload: {
          messageId: input.messageId,
          status: 'completed',
        },
      },
    ];

    return {
      streamId,
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      messageId: input.messageId,
      status: input.status ?? 'completed',
      clientMessageId: input.clientMessageId ?? null,
      userMessage: input.userMessage ?? null,
      assistantMessage: input.assistantMessage ?? null,
      run: {
        runId: streamId,
        streamId,
        threadId: input.threadId,
        messageId: input.messageId,
        status: input.status ?? 'completed',
        retryable: input.status === 'failed',
      },
      events,
    };
  }
}

function redactRouteSnapshot(snapshot: ChatRouteSnapshot) {
  const keyFingerprintPrefix =
    snapshot.keyFingerprintPrefix ??
    (snapshot.keyFingerprint
      ? snapshot.keyFingerprint.slice(
          0,
          Math.min(snapshot.keyFingerprint.length, 15),
        )
      : null);

  return {
    route: snapshot.route,
    provider: snapshot.provider,
    model: snapshot.model,
    policyDecisionId: snapshot.policyDecisionId,
    keyFingerprintPrefix,
    traceId: snapshot.traceId,
  };
}
