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

## Local Environment Probe Safety

Local environment probing must follow these principles:

- explicit consent before any read-only probe;
- least privilege;
- read-only behavior only;
- local-only results by default;
- redaction before display or export;
- no background probe;
- no upload by default;
- no persistence without a future explicit user export flow.

MCAgent Server and Web Playground must not read or receive local environment reports by default.

The read-only probe security model also forbids:

- background probes;
- arbitrary shell commands;
- user-controlled commands;
- recursive home directory scans;
- automatic `.minecraft` discovery;
- execution capabilities before an explicit executor milestone.

Real platform, directory, Java, or network probes must pass a permission policy gate. Java detection and directory access require separate future ADRs.

## Endpoint Trust

An endpoint is not trusted merely because it responds. M11 clients validate `GET /v1/meta`, require compatible API/schema versions and planning capabilities, and reject server declarations that include local execution, file access, download, environment probe, or process-launch authority.

Metadata requests contain no environment report, local path, token, API key, or user information. CORS uses an exact origin allowlist rather than a wildcard.

## Security Feedback

Public issues must not contain exploits, credentials, private paths, or sensitive environment data. Contributors should use GitHub private vulnerability reporting only when the repository UI shows that it is available, or another maintainer-published private contact. The project does not automatically collect telemetry, logs, or environment reports.
