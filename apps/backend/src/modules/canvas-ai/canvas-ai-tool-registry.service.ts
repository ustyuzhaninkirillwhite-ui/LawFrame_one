import type { CanvasAiBuiltContext } from './canvas-ai-context-builder.service';
import { Injectable } from '@nestjs/common';

export interface CanvasAiToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

@Injectable()
export class CanvasAiToolRegistry {
  listTools(): readonly CanvasAiToolDefinition[] {
    return [
      {
        name: 'canvas_get_validation_summary',
        description: 'Read redacted Canvas validation issue summaries.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: 'canvas_search_modules',
        description: 'Read allowlisted Canvas module catalog summaries.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    ];
  }

  runReadTool(input: {
    readonly toolName: string;
    readonly context: CanvasAiBuiltContext;
  }): Record<string, unknown> {
    switch (input.toolName) {
      case 'canvas_get_validation_summary':
        return {
          status: input.context.validation.status,
          errors_count: input.context.validation.errors_count,
          warnings_count: input.context.validation.warnings_count,
          policy_blocks_count: input.context.validation.policy_blocks_count,
          issues: input.context.summary.validation_issues,
        };
      case 'canvas_search_modules':
        return {
          modules: input.context.modules.slice(0, 20).map((module) => ({
            module_code: module.module_code,
            title: module.display_name,
            category: module.category_code,
            disabled: module.availability.status !== 'available',
            disabled_reason: module.availability.human_reason ?? null,
          })),
        };
      default:
        return { blocked: true, reason: 'tool_not_allowlisted' };
    }
  }
}
