import { redactActivepiecesProvisioningError } from './activepieces-canvas-provisioning.service';

describe('ActivepiecesCanvasProvisioningService redaction', () => {
  it('does not expose raw external runtime database errors', () => {
    const details = redactActivepiecesProvisioningError(
      new Error(
        'duplicate key value violates unique constraint "UQ_7ad44f9fcbfc95e0a8436bbb029"',
      ),
    );

    expect(details).toEqual({
      reasonCode: 'AP_PROVISIONING_CONFLICT',
      safeToShow: true,
    });
    expect(JSON.stringify(details)).not.toContain('duplicate key');
    expect(JSON.stringify(details)).not.toContain(
      'UQ_7ad44f9fcbfc95e0a8436bbb029',
    );
  });
});
