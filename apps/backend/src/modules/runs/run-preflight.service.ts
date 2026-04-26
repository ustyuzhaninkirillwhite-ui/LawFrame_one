import type {
  RunPreflightCheck,
  RunPreflightReport,
  RunPreflightRequest,
} from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { randomUUID } from 'node:crypto';
import { ActivepiecesService } from '../activepieces/activepieces.service';
import { DatabaseService } from '../database/database.service';

interface InstalledAutomationPreflightRow {
  readonly id: string;
  readonly title: string;
  readonly required_inputs: readonly string[] | null;
  readonly active_canvas_version_id: string | null;
  readonly production_disabled_at: string | null;
  readonly production_disabled_reason: string | null;
}

@Injectable()
export class RunPreflightService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activepiecesService: ActivepiecesService,
  ) {}

  async preflight(
    access: AccessContext,
    automationId: string,
    input: RunPreflightRequest,
  ): Promise<RunPreflightReport> {
    const automation =
      await this.databaseService.one<InstalledAutomationPreflightRow>(
        `
        select id, title, required_inputs, active_canvas_version_id,
               production_disabled_at, production_disabled_reason
        from app.installed_automations
        where id = $1
          and workspace_id = $2
        limit 1
      `,
        [automationId, access.activeWorkspace!.id],
      );

    if (!automation) {
      throw new AppHttpException(
        'AUTOMATION_NOT_FOUND',
        404,
        'Installed automation was not found.',
      );
    }

    const runtime =
      await this.activepiecesService.getAutomationRuntimeRequirements(
        access,
        automationId,
      );
    const runtimeBinding = await this.databaseService.one<{
      readonly automation_version_id: string | null;
      readonly runtime_projection_id: string | null;
      readonly status: string | null;
    }>(
      `
        select automation_version_id, runtime_projection_id, status
        from app.automation_runtime_bindings
        where workspace_id = $1
          and installed_automation_id = $2
          and active = true
        limit 1
      `,
      [access.activeWorkspace!.id, automationId],
    );
    const requiredInputs = automation.required_inputs ?? [];
    const documentIds = input.inputs?.documentIds ?? [];
    const checks: RunPreflightCheck[] = [
      {
        code: 'canvas.production.enabled',
        label: 'Production enabled',
        category: 'runtime',
        status: automation.production_disabled_at ? 'blocked' : 'ready',
        message: automation.production_disabled_at
          ? (automation.production_disabled_reason ??
            'Production runs are emergency-disabled.')
          : 'Production runs are enabled.',
      },
      {
        code: 'canvas.version.binding',
        label: 'Canvas version binding',
        category: 'runtime',
        status:
          automation.active_canvas_version_id &&
          runtimeBinding?.automation_version_id !==
            automation.active_canvas_version_id
            ? 'blocked'
            : 'ready',
        message:
          automation.active_canvas_version_id &&
          runtimeBinding?.automation_version_id !==
            automation.active_canvas_version_id
            ? 'Runtime binding does not point to the active Canvas version.'
            : 'Runtime binding points to the active Canvas version.',
      },
      {
        code: 'runtime.sync',
        label: 'Runtime sync',
        category: 'runtime',
        status: runtime.syncState === 'synced' ? 'ready' : 'blocked',
        message:
          runtime.syncState === 'synced'
            ? 'Runtime binding is synchronized.'
            : 'Automation runtime must be synchronized before execution.',
      },
      {
        code: 'runtime.connections',
        label: 'Runtime connections',
        category: 'connection',
        status: runtime.missingConnections.length === 0 ? 'ready' : 'blocked',
        message:
          runtime.missingConnections.length === 0
            ? 'All required runtime connections are present.'
            : `Missing connections: ${runtime.missingConnections
                .map((item) => item.code)
                .join(', ')}`,
      },
      {
        code: 'input.documents',
        label: 'Input documents',
        category: 'document',
        status:
          requiresDocuments(requiredInputs) && documentIds.length === 0
            ? 'blocked'
            : 'ready',
        message:
          requiresDocuments(requiredInputs) && documentIds.length === 0
            ? 'This automation requires at least one document input.'
            : 'Document inputs are available for execution.',
      },
      {
        code: 'input.profile',
        label: 'Execution profile',
        category: 'profile',
        status:
          requiresProfile(requiredInputs) && !input.profileId
            ? 'blocked'
            : 'ready',
        message:
          requiresProfile(requiredInputs) && !input.profileId
            ? 'This automation requires a legal work profile.'
            : 'Profile requirement is satisfied.',
      },
    ];

    for (const warning of runtime.warnings) {
      checks.push({
        code: `runtime.warning.${checks.length + 1}`,
        label: 'Runtime warning',
        category: 'runtime',
        status: 'warning',
        message: warning,
      });
    }
    const canvasValidationWarnings = runtime.warnings.filter((warning) =>
      warning.startsWith('WF_'),
    );
    if (canvasValidationWarnings.length > 0) {
      checks.push({
        code: 'canvas.validation',
        label: 'Canvas validation',
        category: 'runtime',
        status: 'blocked',
        message: canvasValidationWarnings.join('; '),
      });
    }

    const canStart =
      runtime.canRun && checks.every((check) => check.status !== 'blocked');

    return {
      automationId: automation.id,
      canStart,
      summary: canStart
        ? `Preflight passed for ${automation.title}.`
        : `Preflight blocked for ${automation.title}.`,
      checks,
      requiredInputs,
      warnings: runtime.warnings,
      missingConnectionCodes: runtime.missingConnections.map(
        (item) => item.code,
      ),
      traceId: randomUUID(),
    };
  }
}

function requiresDocuments(requiredInputs: readonly string[]) {
  return requiredInputs.some((item) => item.toLowerCase().includes('document'));
}

function requiresProfile(requiredInputs: readonly string[]) {
  return requiredInputs.some((item) => item.toLowerCase().includes('profile'));
}
