import type {
  ReadinessProfile,
  ReadinessServiceCode,
} from '@lexframe/contracts';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface ReadinessProfileDefinition {
  readonly description: string;
  readonly allowReadinessGateBlocked: boolean;
  readonly requiredServices: readonly ReadinessServiceCode[];
  readonly optionalServices: readonly ReadinessServiceCode[];
}

interface ReadinessProfileContract {
  readonly defaultProfile: ReadinessProfile;
  readonly profiles: Record<ReadinessProfile, ReadinessProfileDefinition>;
}

const CONTRACT_PATH = resolveContractPath();

const profileContract = Object.freeze(
  JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as ReadinessProfileContract,
);

export function resolveReadinessProfile(
  profile: string | undefined,
): ReadinessProfile {
  const normalized =
    profile && profile in profileContract.profiles
      ? (profile as ReadinessProfile)
      : profileContract.defaultProfile;

  return normalized;
}

export function getReadinessProfileDefinition(profile: ReadinessProfile) {
  return profileContract.profiles[profile];
}

export function isRequiredReadinessService(
  profile: ReadinessProfile,
  service: ReadinessServiceCode,
) {
  return getReadinessProfileDefinition(profile).requiredServices.includes(
    service,
  );
}

export function getReadinessProfileContract() {
  return profileContract;
}

function resolveContractPath() {
  const candidates = [
    resolve(process.cwd(), 'config', 'readiness', 'profiles.json'),
    resolve(
      dirname(__dirname),
      '..',
      '..',
      '..',
      '..',
      '..',
      'config',
      'readiness',
      'profiles.json',
    ),
    resolve(
      dirname(__dirname),
      '..',
      '..',
      '..',
      '..',
      'config',
      'readiness',
      'profiles.json',
    ),
  ];

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(
      'Readiness profile contract config/readiness/profiles.json was not found.',
    );
  }

  return match;
}
