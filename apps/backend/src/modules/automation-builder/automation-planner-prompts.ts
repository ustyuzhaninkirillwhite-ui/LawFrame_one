import { createHash } from 'node:crypto';

export const automationPlannerPromptAssets = [
  {
    id: 'stage20.system',
    version: '1',
    purpose: 'AutomationBlueprint generation boundary',
    text: 'Generate only a LexFrame AutomationBlueprint JSON object. Do not approve, publish, run, deliver, expose secrets, create arbitrary code steps, or call runtime tools.',
  },
  {
    id: 'stage20.data_policy',
    version: '1',
    purpose: 'Context and classification policy',
    text: 'Use only backend-provided context references and modes. Legal secret, client material and personal data are handled by backend policy and cannot be downgraded.',
  },
  {
    id: 'stage20.runtime_mapping',
    version: '1',
    purpose: 'Canvas/runtime projection policy',
    text: 'Map steps to LexFrame modules and approved runtime targets only. Activepieces is a draft projection, never product source of truth.',
  },
] as const;

export function getAutomationPlannerPromptHash() {
  return createHash('sha256')
    .update(
      JSON.stringify(
        automationPlannerPromptAssets.map((asset) => ({
          id: asset.id,
          version: asset.version,
          purpose: asset.purpose,
          textHash: createHash('sha256').update(asset.text).digest('hex'),
        })),
      ),
    )
    .digest('hex');
}
