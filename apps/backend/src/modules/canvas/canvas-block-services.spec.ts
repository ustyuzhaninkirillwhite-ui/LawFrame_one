import type { AccessContext } from '../../common/types/lexframe-request';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';
import { CanvasBlockRuntimeMappingService } from './canvas-block-runtime-mapping.service';
import { CanvasBlockValidationService } from './canvas-block-validation.service';
import { CanvasConnectionPolicyService } from './canvas-connection-policy.service';

describe('Canvas block model services', () => {
  const access: AccessContext = {
    activeWorkspace: null,
    roles: ['lawyer'],
    permissions: ['canvas.view', 'canvas.edit'],
  };
  const registry = new CanvasBlockRegistryService();

  it('exposes MVP block definitions and schemas through the registry', () => {
    const blocks = registry.listBlockTypes(access);
    const manualStart = registry.getBlockType('manual_start', access);
    const schema = registry.getBlockSchema('email_delivery', access);

    expect(blocks.some((block) => block.code === 'pretrial_claim_draft')).toBe(
      true,
    );
    expect(manualStart.kind).toBe('trigger');
    expect(schema.handles.some((handle) => handle.code === 'sent')).toBe(true);
    expect(schema.validationRules).toBeDefined();
  });

  it('marks blocks unavailable when role policy blocks them', () => {
    const viewerAccess: AccessContext = {
      activeWorkspace: null,
      roles: ['viewer'],
      permissions: ['canvas.view'],
    };

    const block = registry.getBlockType('case_material_analysis', viewerAccess);

    expect(block.enabled).toBe(false);
    expect(block.disabledReason).toContain('Current role');
  });

  it('validates required inputs and external delivery approval policy', () => {
    const blockValidation = new CanvasBlockValidationService(registry);
    const connectionPolicy = new CanvasConnectionPolicyService(registry);

    const blockResult = blockValidation.validateBlock({
      access,
      blockCode: 'pretrial_claim_draft',
      bindings: [],
    });
    const connectionResult = connectionPolicy.validateConnection({
      access,
      sourceBlockCode: 'pretrial_claim_draft',
      sourceHandle: 'main_output',
      targetBlockCode: 'email_delivery',
      targetHandle: 'main_input',
      hasApprovalPath: false,
    });

    expect(blockResult.valid).toBe(false);
    expect(
      blockResult.issues.some(
        (issue) => issue.code === 'REQUIRED_INPUT_MISSING',
      ),
    ).toBe(true);
    expect(connectionResult.allowed).toBe(false);
    expect(connectionResult.policy.blocks[0]?.code).toBe(
      'EXTERNAL_DELIVERY_REQUIRES_APPROVAL',
    );
  });

  it('previews runtime mapping without executing external actions', () => {
    const runtime = new CanvasBlockRuntimeMappingService(registry);

    const preview = runtime.previewBlock({
      access,
      blockCode: 'email_delivery',
    });
    const testResult = runtime.testBlock({
      access,
      blockCode: 'email_delivery',
    });

    expect(preview.provider).toBe('internal_worker');
    expect(preview.internalRoute).toBe('delivery.email');
    expect(testResult.status).toBe('ready');
    expect(JSON.stringify(testResult)).not.toContain('service_role');
  });
});
