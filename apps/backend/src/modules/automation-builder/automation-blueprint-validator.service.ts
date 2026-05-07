import type {
  AutomationBlueprint,
  AutomationBlueprintIssue,
  AutomationBlueprintValidationSummary,
} from '@lexframe/contracts';
import { automationBlueprintSchema } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import Ajv2020 from 'ajv/dist/2020';

const allowedActivepiecesPieces = new Set([
  '@activepieces/piece-manual-trigger',
  '@lexframe/piece-ai-gateway',
  '@lexframe/piece-approval',
  '@lexframe/piece-callback',
  '@lexframe/piece-delivery',
  '@lexframe/piece-document',
  '@lexframe/piece-gateway',
  '@lexframe/piece-legal',
  '@lexframe/trigger',
]);

const forbiddenActivepiecesPiecePattern =
  /openai|anthropic|deepseek|comet|xai|http|webhook|code|supabase|service-role|internal-network/i;

@Injectable()
export class AutomationBlueprintValidatorService {
  private readonly ajv = new Ajv2020({ allErrors: true, strict: false });
  private readonly validateSchema = this.ajv.compile(automationBlueprintSchema);

  validate(
    blueprint: AutomationBlueprint,
  ): AutomationBlueprintValidationSummary {
    const errors: AutomationBlueprintIssue[] = [];
    const warnings: AutomationBlueprintIssue[] = [];
    const policyBlocks: AutomationBlueprintIssue[] = [];

    if (!this.validateSchema(blueprint)) {
      for (const error of this.validateSchema.errors ?? []) {
        errors.push({
          code: 'schema_validation_failed',
          message: `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
          severity: 'error',
        });
      }
    }

    const stepsById = new Map(blueprint.steps.map((step) => [step.id, step]));
    if (!blueprint.steps.some((step) => step.kind === 'trigger')) {
      errors.push({
        code: 'trigger_required',
        message: 'AutomationBlueprint must contain a trigger step.',
        severity: 'error',
      });
    }
    if (!blueprint.steps.some((step) => step.kind === 'end')) {
      errors.push({
        code: 'end_required',
        message: 'AutomationBlueprint must contain an end/output step.',
        severity: 'error',
      });
    }

    for (const edge of blueprint.edges) {
      if (
        !stepsById.has(edge.sourceStepId) ||
        !stepsById.has(edge.targetStepId)
      ) {
        errors.push({
          code: 'edge_references_unknown_step',
          message: `Edge ${edge.id} references an unknown source or target step.`,
          severity: 'error',
          edgeId: edge.id,
        });
      }
    }

    const connected = new Set<string>();
    for (const edge of blueprint.edges) {
      connected.add(edge.sourceStepId);
      connected.add(edge.targetStepId);
    }
    for (const step of blueprint.steps) {
      if (
        step.kind !== 'note' &&
        blueprint.steps.length > 1 &&
        !connected.has(step.id)
      ) {
        errors.push({
          code: 'disconnected_executable_step',
          message: `Executable step ${step.id} is disconnected.`,
          severity: 'error',
          stepId: step.id,
        });
      }
    }

    const hasApprovalGate =
      blueprint.approvalGates.length > 0 ||
      blueprint.steps.some((step) => step.kind === 'approval');
    const hasExternalDelivery = blueprint.steps.some(
      (step) => step.kind === 'delivery' || step.policy.externalAction,
    );
    if (hasExternalDelivery && !hasApprovalGate) {
      policyBlocks.push({
        code: 'external_delivery_requires_approval_gate',
        message:
          'External actions and delivery require an explicit approval gate.',
        severity: 'policy_block',
      });
    }

    for (const block of blueprint.riskReport.blocks) {
      policyBlocks.push({
        code: 'planner_policy_block',
        message: block,
        severity: 'policy_block',
      });
    }

    for (const step of blueprint.steps) {
      const runtime = step.runtimeMapping;
      if (runtime?.provider === 'activepieces') {
        const pieceName = runtime.pieceName ?? '';
        if (
          pieceName.length === 0 ||
          !allowedActivepiecesPieces.has(pieceName) ||
          forbiddenActivepiecesPiecePattern.test(pieceName)
        ) {
          policyBlocks.push({
            code: 'activepieces_piece_not_allowed',
            message: `Activepieces piece is not in the LexFrame allowlist for step ${step.id}.`,
            severity: 'policy_block',
            stepId: step.id,
          });
        }
      }

      if (containsSecretLikeValue(step.config)) {
        policyBlocks.push({
          code: 'secret_like_value_in_blueprint',
          message: `Step ${step.id} contains a secret-like config value.`,
          severity: 'policy_block',
          stepId: step.id,
        });
      }
    }

    const affectedSteps = [
      ...new Set(
        [...errors, ...warnings, ...policyBlocks]
          .map((issue) => issue.stepId)
          .filter((stepId): stepId is string => Boolean(stepId)),
      ),
    ];
    const affectedEdges = [
      ...new Set(
        [...errors, ...warnings, ...policyBlocks]
          .map((issue) => issue.edgeId)
          .filter((edgeId): edgeId is string => Boolean(edgeId)),
      ),
    ];
    const status =
      policyBlocks.length > 0
        ? 'policy_blocked'
        : errors.length > 0
          ? 'invalid'
          : warnings.length > 0
            ? 'valid_with_warnings'
            : 'valid';

    return {
      status,
      errors,
      warnings,
      policyBlocks,
      affectedSteps,
      affectedEdges,
      canAskClarification:
        status === 'invalid' &&
        errors.some((issue) =>
          ['trigger_required', 'end_required'].includes(issue.code),
        ),
      canApprove: status === 'valid' || status === 'valid_with_warnings',
      canConvertToCanvasDraft:
        status === 'valid' || status === 'valid_with_warnings',
      canCreateRuntimeDraft:
        (status === 'valid' || status === 'valid_with_warnings') &&
        (blueprint.runtimePlan.activepieces?.createDraftAllowed ?? false),
      canPublish: false,
      canRunProduction: false,
    };
  }
}

function containsSecretLikeValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return /sk-[a-z0-9_-]{10,}|eyJ[a-z0-9_-]{20,}\.|signed(url|_url)|api[_-]?key|secret|token/i.test(
      value,
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSecretLikeValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, child]) =>
      /api[_-]?key|secret|token|signed(url|_url)|password/i.test(key)
        ? true
        : containsSecretLikeValue(child),
    );
  }
  return false;
}
