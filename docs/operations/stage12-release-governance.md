# Stage 12 Release Governance

## Baseline

- GitHub Actions is the canonical CI/CD control plane.
- `preview`, `staging`, `production` use the same release manifest schema.
- Production release requires a validated release manifest, smoke report, and manual approval.

## Required Gates

- `check:contracts`
- `check:backend`
- `check:frontend`
- `check:db`
- `check:ai`
- `check:activepieces`
- `check:security`
- manual browser smoke

## Release Artifacts

- container image references for `backend`, `web`, `mining-worker`
- migrations list
- Activepieces piece version
- AI prompt/schema versions
- smoke report location

## Rollback

- redeploy previous image digests
- revert feature flags for risky routes
- pin previous Activepieces piece version
- stop rollout if health or system status becomes `blocked`
