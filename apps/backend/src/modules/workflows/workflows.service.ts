import {
  compileRuntimePlanPreview,
  createWorkflowPolicyReport,
  createWorkflowValidationReport,
  validWorkflowExample,
  validateWorkflowDefinition,
} from '@lexframe/workflow';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkflowsService {
  getDraftContract() {
    return {
      workflow: validWorkflowExample,
      validationReport: createWorkflowValidationReport(validWorkflowExample),
      policyReport: createWorkflowPolicyReport(validWorkflowExample, {
        dataClass: 'B_INTERNAL_WORKSPACE',
        allowedProviderRoutes: ['xai'],
      }),
      runtimePlanPreview: compileRuntimePlanPreview(validWorkflowExample),
      validation: validateWorkflowDefinition(validWorkflowExample),
    };
  }
}
