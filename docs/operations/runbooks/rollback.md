# Rollback Runbook

1. Confirm failing component through `/health/dependencies` and `/system/status`.
2. Freeze new rollout jobs for the target environment.
3. Redeploy the previous image digest for `backend`, `web`, and `mining-worker`.
4. Re-apply the previous release manifest.
5. If a migration is non-reversible, disable dependent feature flags and keep DB at the forward version.
6. Re-run smoke checks and reopen traffic only after `ready` and `system/status` recover.
