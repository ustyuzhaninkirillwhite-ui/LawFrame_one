# Documents Upload Test Matrix

| Scenario | Layer | Test File | Status | Notes |
| --- | --- | --- | --- | --- |
| Upload intent | Backend/E2E | `documents.service.spec.ts`, `documents-upload-download-full.spec.ts` | Covered | Validates metadata before storage rows |
| Content bytes endpoint | Backend/E2E | `documents.service.spec.ts`, `documents-upload-download-full.spec.ts` | Covered | Base64 body decoded and hashed |
| Canonical base64 | Backend | `documents.service.spec.ts` | Covered | Non-canonical content rejected |
| Size validation | Backend/E2E | `documents.service.spec.ts`, `documents-upload-download-full.spec.ts` | Covered | Empty/zero-size rejected |
| MIME validation | Backend/E2E | `documents.service.spec.ts`, `documents-upload-download-full.spec.ts` | Covered | Unsupported MIME rejected |
| Extension validation | Backend/E2E | `documents.service.spec.ts`, `documents-upload-download-full.spec.ts` | Covered | `.exe` disguised as PDF rejected |
| Unsafe filename/path traversal | Backend/E2E | `documents.service.spec.ts`, `documents-upload-download-full.spec.ts` | Covered | Rejects traversal/reserved characters |
| SHA mismatch | Backend | `documents.service.spec.ts` | Covered | Mismatch rejected before completion |
| Complete upload | Backend/E2E | `documents.service.spec.ts`, `documents-upload-download-full.spec.ts` | Covered | Status/version metadata persisted |
| Detail metadata | E2E | `documents-upload-download-full.spec.ts` | Covered | Filename/MIME/size visible or in API detail |
| Signed URL policy | Backend/E2E | `documents.service.spec.ts`, `documents-upload-download-full.spec.ts` | Covered | Non-5xx, no secret leakage, archived block in unit |
| Archive/restore | Existing E2E/backend | `documents-storage.spec.ts`, `documents.service.spec.ts` | Covered | Kept as existing stage storage coverage |
| No raw content/signed URL audit leak | Backend/E2E | `documents.service.spec.ts`, network/storage assertions | Covered | Audit metadata stores hash/size/mime/status only |
