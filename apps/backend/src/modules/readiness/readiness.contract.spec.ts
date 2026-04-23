import {
  getReadinessProfileContract,
  getReadinessProfileDefinition,
  isRequiredReadinessService,
  resolveReadinessProfile,
} from './readiness.contract';

describe('readiness.contract', () => {
  it('resolves unknown values to the default readiness profile', () => {
    expect(resolveReadinessProfile(undefined)).toBe('local-basic');
    expect(resolveReadinessProfile('unknown-profile')).toBe('local-basic');
  });

  it('exposes strict integrated requirements for local-integrated', () => {
    const definition = getReadinessProfileDefinition('local-integrated');

    expect(definition.allowReadinessGateBlocked).toBe(false);
    expect(definition.requiredServices).toEqual(
      expect.arrayContaining([
        'postgres',
        'supabase-storage',
        'backend',
        'web',
        'activepieces',
        'redis',
        'opensearch',
        'delivery-sandbox',
      ]),
    );
    expect(
      isRequiredReadinessService('local-integrated', 'supabase-storage'),
    ).toBe(true);
    expect(isRequiredReadinessService('local-integrated', 'opensearch')).toBe(
      true,
    );
    expect(
      isRequiredReadinessService('local-integrated', 'delivery-sandbox'),
    ).toBe(true);
  });

  it('loads a complete profile contract from repo config', () => {
    const contract = getReadinessProfileContract();

    expect(contract.defaultProfile).toBe('local-basic');
    expect(Object.keys(contract.profiles)).toEqual([
      'local-basic',
      'local-integrated',
      'staging-rc',
      'production',
    ]);
  });
});
