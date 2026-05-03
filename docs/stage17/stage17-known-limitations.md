# Stage 17 Known Limitations

- Stage 17 is local-integrated MVP evidence, not a production-ready deployment.
- Production readiness still depends on Stage 14/12 gates and deployment hardening.
- Activepieces embedding/provisioning/show-hide pieces surfaces carry paid-edition/license risk and require explicit license sign-off.
- `E:/activepieces-main` is not a git checkout, so AP source commit evidence is unavailable.
- AP source declares `bun@1.3.3`, but `bun` and `node_modules` are absent in the current local environment.
- Localization patches can regress on AP image/SDK/source upgrade.
- Runtime DOM overlay is fallback only; it must not become the primary localization path again.
- Offline pieces pack proves local metadata/cache visibility, not real execution of external API calls.
- Gmail and CometAPI require credentials for real actions; no credentials are committed or exposed to frontend.
- AP pieces visibility depends on platform-level installation and policy tags.
- Local Owner Key Vault remains owner-machine dependent and backend-only.
- Future simplified LexFrame Canvas is not implemented in Stage 17.12.
