# Activepieces Legal Pieces Compatibility

- Package version must be pinned in the release manifest.
- Production sync is allowed only after staging smoke flow execution.
- Rollback path: restore the previous vendor Activepieces container image and the previous `@lexframe/activepieces-legal-pieces` version.
