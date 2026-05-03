# Stage 17.12 Open-Source Pieces Pack

Status: PASS

The local pack inventories open-source Activepieces core/community pieces for local/offline inspection. Offline means metadata, display names, actions/triggers, source paths and local build status are available. External API execution still requires network, provider credentials and connection setup.

## Local Profile

- Profile: `stage17-local-all-open-source-pieces`.
- Scope: local/dev only.
- Production remains allowlisted and policy-filtered.
- Gmail and other delivery pieces require backend-approved connection policy.
- Direct AI provider pieces, including CometAPI, must not bypass LexFrame AI Gateway for production legal data.

## Inventory

- Total: 684
- Community: 657
- Core: 27
- Actions: 4367
- Triggers: 1258

## Gmail

- Status: found
- Package: @activepieces/piece-gmail
- Path: packages/pieces/community/gmail
- Auth: unknown_auth
- RU locale: true
- Actions: create_draft_reply, gmail_get_mail, gmail_get_thread, gmail_search_mail, reply_to_email, request_approval_in_mail, send_email
- Triggers: gmail_new_email_received, new_attachment, new_conversation, new_label, new_labeled_email

## CometAPI

- Status: found
- Package: @activepieces/piece-cometapi
- Path: packages/pieces/community/cometapi
- Auth: unknown_auth
- RU locale: false
- Actions: ask_cometapi
- Triggers: none
