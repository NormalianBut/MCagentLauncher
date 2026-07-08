# Security

MCagentlauncher must keep execution authority narrow and auditable.

## Execution Boundary

MCAgent may generate plans, explanations, and diagnostics. It must not execute commands or mutate local files.

Desktop Local Executor performs local actions only after user confirmation and after validating the plan, source metadata, and hashes.

## Resource Safety

- Use source metadata and rule checks before installation.
- Verify hashes for downloaded files.
- Avoid bypassing upstream platform rules.
- Avoid private mirrors unless explicitly supported by policy and user configuration.
- Preserve rollback information where possible.

## Secret Handling

Secrets, tokens, private keys, and API keys must not be committed. Example environment files may list variable names but must not contain real secret values.

