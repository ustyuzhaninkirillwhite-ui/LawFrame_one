# Stage 17.12 Pieces Localization Report

Generated: 2026-05-04T18:39:50.855Z
Status: PASS

- Pieces with any i18n: 684
- Pieces with ru locale: 365
- RU coverage: 53.36%

## Gmail

- Status: found
- RU locale present: true
- Actions: create_draft_reply, gmail_get_mail, gmail_get_thread, gmail_search_mail, reply_to_email, request_approval_in_mail, send_email
- Triggers: gmail_new_email_received, new_attachment, new_conversation, new_label, new_labeled_email

## CometAPI

- Status: found
- RU locale present: false
- Actions: ask_cometapi
- Triggers: none
- Note: CometAPI has no ru.json in the current local source tree; Stage 17.12 documents this and does not invent upstream localization.

Package names, slugs, action IDs, trigger IDs and JSON schema keys remain untranslated.
