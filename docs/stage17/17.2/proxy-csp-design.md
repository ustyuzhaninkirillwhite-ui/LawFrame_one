# Reverse Proxy And CSP Design

## Prefix

Activepieces is exposed inside the LexFrame contour under:

```text
/automation-runtime/*
```

The prefix is used for browser-visible builder URLs and for network evidence.
The backend session API stays separate as `/activepieces/session` in the Nest
app and `/api/activepieces/session` at the edge if an API prefix is mounted.

## Reverse Proxy Requirements

| Area | Requirement | Evidence |
| --- | --- | --- |
| URL prefix | Builder URL resolves under `/automation-runtime/*`. | Browser opens returned `builder_url`. |
| Assets | JS, CSS, fonts and images rewrite without 404s. | Network log has no blocked AP assets. |
| APIs | AP API calls route to AP service, not LexFrame API. | `/activepieces/session` is not confused with AP internal API. |
| WebSockets | Upgrade/Connection headers pass through. | Browser and AP logs show no WS failure. |
| Headers | Host and X-Forwarded-* match external URL. | AP generated links stay under prefix. |
| Auth routes | AP sign-in/sign-up/reset-password are blocked or redirected. | Playwright proves no AP login page. |

## CSP Baseline

Exact values must be validated against the real runtime and SDK source:

```text
default-src 'self';
frame-src 'self' https://<activepieces-public-origin>;
connect-src 'self' https://<activepieces-public-origin> wss://<activepieces-public-origin>;
script-src 'self' https://cdn.activepieces.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https://<activepieces-public-origin>;
object-src 'none';
base-uri 'self';
frame-ancestors 'self';
```

No wildcard production CSP is allowed for the Stage 17 PASS path.

## Proxy Skeleton

```nginx
location /automation-runtime/ {
  proxy_pass http://activepieces-app/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
}

location ~ ^/automation-runtime/(sign-in|sign-up|reset-password) {
  return 403;
}
```
