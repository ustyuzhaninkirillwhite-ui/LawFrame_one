# Data Ownership Matrix

| Entity | Source of truth | External references | Forbidden shortcut |
| --- | --- | --- | --- |
| User identity | Supabase Auth + LexFrame user record | `auth.users.id` | Treat Supabase auth row as full profile |
| Workspace | LexFrame DB | Activepieces project binding | Use AP project as workspace |
| Automation template | LexFrame DB | Optional AP template reference | Store only in Activepieces |
| Installed automation | LexFrame DB | Activepieces flow id | Create runtime flow without local record |
| Run history | LexFrame DB | Activepieces run id | Keep business history only in AP |
| Recommendation | LexFrame analytics + product DB | PostHog/ClickHouse traces | Build from builder logs |
| Publication request | LexFrame DB | external URL/id | Publish directly from frontend |

