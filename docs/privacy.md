# Privacy

MCagentlauncher treats privacy as a default architecture constraint.

## Defaults

- Do not upload full logs by default.
- Do not upload local paths by default.
- Do not upload tokens, API keys, session values, or private server addresses.
- Do not store unredacted user logs in Supabase.
- Do not make community contribution uploads implicit.

## Optional Community Cases

Anonymous cases can help improve rules and MCAgent behavior, but they must be consent-based. Before upload, the Desktop client should redact local paths, usernames, server addresses, tokens, and unrelated log content. The user should be able to preview what will be shared.

