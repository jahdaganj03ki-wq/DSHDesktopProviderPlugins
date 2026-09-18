# dsh-freebuff architecture

## Runtime path

`DSH → FreebuffLlmAdapter → FreebuffProvider → AccountScheduler →
Session/Run lifecycle → FreebuffTransport → SSE parser`.

A request captures one account before the first upstream operation. The same
account remains bound to the complete stream. A second account is considered
only when Freebuff returns a typed quota signal before any response bytes or
side effect.

## Failover rules

Allowed automatic switch: an explicit `quota_exhausted`, `quota_exceeded`, or
account-scoped `spend_limited` code, when the response has no bytes and no side
effect. `rate_limited` and generic HTTP 429 are classified as rate limiting,
not quota exhaustion.

Never switch on `ip_capped`, `banned`, `country_blocked`, `session_superseded`,
401, 403, malformed requests, or an ambiguous timeout. Never switch after the
first SSE byte.

## Secrets

The account vault stores AES-256-GCM ciphertext. The 32-byte key must be
provided out-of-band through `DSH_FREEBUFF_VAULT_KEY` as base64url. Tokens are
never returned by the account routes. A production DSH build should replace
this environment key with the host credential/DPAPI service.

## Protocol assumptions

The provider uses the public Freebuff session lifecycle:

- `GET /api/v1/me`
- `GET /api/v1/freebuff/session`
- `POST /api/v1/freebuff/session/admission`
- `POST /api/v1/agent-runs`
- `POST /api/v1/chat/completions`

Freebuff can change this protocol. Contract fixtures must be updated from the
official client before enabling the provider in a release build.
