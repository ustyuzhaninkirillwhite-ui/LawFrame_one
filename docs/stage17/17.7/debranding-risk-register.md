# Stage 17.7 Debranding Risk Register

| Risk | Mitigation | Check |
| --- | --- | --- |
| Activepieces wordmark appears in runtime theme | Default theme uses local LexFrame automation assets | `branding:check-visible` |
| Browser locale overrides Russian locale | `resolveActivepiecesLocale()` always returns `ru` | `i18n:check-activepieces-ru` |
| SDK embed path and reverse-proxy path diverge | Session response and embed route both force `ru` | `i18n:check-activepieces-ru` |
| Required Canvas controls are hidden while debranding | Static gate checks hide flags stay `false` | `stage17:functionality-preservation` |
| License notices removed by white-label patch | LICENSE is checked and preservation report is required | `license:check-notices` |
| Forbidden English control labels appear in user UI | Translation values are scanned for forbidden visible terms | `branding:check-visible` |
