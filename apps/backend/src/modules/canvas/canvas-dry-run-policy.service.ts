import type { CanvasTestRunPolicy, WorkflowNode } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

export interface DryRunDecision {
  readonly action: 'execute' | 'simulate' | 'block';
  readonly reason: string | null;
}

@Injectable()
export class CanvasDryRunPolicyService {
  defaultPolicy(mode: CanvasTestRunPolicy['ai_mode'] = 'mock') {
    return {
      allow_real_reads: true,
      allow_real_writes: false,
      allow_external_calls: false,
      allow_ai_calls: mode !== 'mock',
      ai_mode: mode,
      max_loop_items: 5,
      timeout_seconds: 30,
    } satisfies CanvasTestRunPolicy;
  }

  decide(input: {
    readonly node: WorkflowNode;
    readonly dryRun: boolean;
    readonly policy: CanvasTestRunPolicy;
  }): DryRunDecision {
    const node = input.node;

    if (node.policy.external_action || isExternalProvider(node)) {
      return input.dryRun
        ? { action: 'simulate', reason: 'external_action_preview_only' }
        : { action: 'block', reason: 'external_action_blocked_in_test' };
    }

    if (node.policy.approval_required || node.block_code.includes('approval')) {
      return { action: 'simulate', reason: 'approval_gate_simulated' };
    }

    if (
      node.policy.ai_action ||
      node.runtime_mapping.provider === 'ai_gateway'
    ) {
      if (!input.policy.allow_ai_calls || input.policy.ai_mode === 'mock') {
        return { action: 'simulate', reason: 'ai_output_mocked' };
      }
      return { action: 'execute', reason: 'ai_gateway_policy_checked' };
    }

    if (
      node.block_code.includes('delete') ||
      node.block_code.includes('publish')
    ) {
      return { action: 'block', reason: 'destructive_action_blocked' };
    }

    return { action: 'execute', reason: null };
  }
}

function isExternalProvider(node: WorkflowNode) {
  const blockCode = node.block_code.toLowerCase();
  const moduleCode = (node.module_code ?? '').toLowerCase();
  return (
    blockCode.includes('email') ||
    blockCode.includes('telegram') ||
    blockCode.includes('webhook') ||
    blockCode.includes('delivery') ||
    moduleCode.includes('email') ||
    moduleCode.includes('telegram') ||
    moduleCode.includes('webhook') ||
    moduleCode.includes('delivery')
  );
}
