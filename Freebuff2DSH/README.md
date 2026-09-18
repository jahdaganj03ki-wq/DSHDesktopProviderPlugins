# dsh-freebuff

CI build: GitHub Actions (`Freebuff2DSH` workflow)

Native DeepSeek Harness provider integration for Freebuff models.

> This initial implementation intentionally supports only provider-compliant
> quota failover. It does not bypass bans, IP caps, country restrictions,
> referral gates, or other anti-abuse controls.

## Status

The repository contains the provider core, account vault, Freebuff session
transport, native DSH adapter, host account routes, and safe failover state
machine. It is an alpha integration: validate the current Freebuff protocol
against a permitted account before production use.

## Setup

Generate a 32-byte vault key and expose it only to the DSH host process:

```powershell
$key = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$env:DSH_FREEBUFF_VAULT_KEY = $key.Replace('+','-').Replace('/','_').TrimEnd('=')
```

The plugin stores encrypted accounts at `$DSH_HOME/.freebuff-auth.json`.
Use the plugin's host-side account route to add accounts; tokens are never
returned in account listings. Failover is opt-in through the plugin profile.

## Safety defaults

- account failover disabled by default;
- no switching after the first streamed byte;
- no retry of ambiguous or non-idempotent requests;
- `ip_capped`, `banned`, and `country_blocked` never trigger rotation;
- secrets are never emitted in logs or browser responses.

## References

- https://github.com/franksong2702/dsh-codex-connect
- https://github.com/CodebuffAI/freebuff
- https://github.com/akasakaid/Freebuff-router
