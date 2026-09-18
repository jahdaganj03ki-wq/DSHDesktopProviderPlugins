# Testing and release gates

## Required gates

1. TypeScript typecheck against the exact installed DSH peer versions.
2. Unit tests for error classification, encrypted vault persistence,
   weighted scheduling, cooldown reset, and request-bound failover.
3. Contract fixtures for Freebuff session admission, quota rejection, SSE,
   authentication failure, IP cap, ban, and session supersession.
4. Streaming test proving no second account is selected after the first byte.
5. Secret-redaction test proving account endpoints never return `token`.
6. Compatibility check against the supported DSH `0.1.5-rc.2` runtime.

## Release policy

Failover remains disabled until a permitted account has passed the protocol
fixtures. Enable only with `maxAccountSwitches` and `maxAttempts` bounded.
The plugin must not rotate around provider bans, IP caps, country restrictions,
or other anti-abuse controls.
