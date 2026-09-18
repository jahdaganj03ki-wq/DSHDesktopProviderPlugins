function numberValue(value) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}
function parseBody(raw) {
    try {
        const value = JSON.parse(raw);
        return value && typeof value === 'object' ? value : {};
    }
    catch {
        return {};
    }
}
/** Classifies only documented/provider-shaped signals; generic 429 is not quota exhaustion. */
export function classifyFreebuffError(input) {
    const body = parseBody(input.body ?? '');
    const nested = body.error && typeof body.error === 'object' ? body.error : {};
    const code = String(body.code ?? body.errorCode ?? nested.code ?? nested.type ?? '').toLowerCase();
    const errorMessage = input.error instanceof Error ? input.error.message : input.error;
    const message = String(body.message ?? nested.message ?? errorMessage ?? '').slice(0, 300);
    const status = input.status ?? 0;
    const bytesSent = input.bytesSent ?? false;
    const sideEffectAccepted = input.sideEffectAccepted ?? bytesSent;
    const retryAfterMs = numberValue(body.retryAfterMs ?? nested.retryAfterMs);
    const resetAtRaw = numberValue(body.resetAt ?? nested.resetAt);
    const resetAt = resetAtRaw !== undefined ? (resetAtRaw < 10_000_000_000 ? resetAtRaw * 1000 : resetAtRaw) : undefined;
    let klass = 'unknown';
    if (['quota_exhausted', 'quota_exceeded', 'spend_limited'].includes(code))
        klass = 'quota_exhausted';
    else if (code === 'rate_limited')
        klass = 'rate_limit';
    else if (['ip_capped', 'ip_cap'].includes(code))
        klass = 'ip_cap';
    else if (['banned', 'account_banned'].includes(code))
        klass = 'banned';
    else if (['country_blocked', 'geo_blocked'].includes(code))
        klass = 'country_blocked';
    else if (['session_superseded', 'session_conflict'].includes(code))
        klass = 'session_conflict';
    else if (['model_locked', 'model_unavailable', 'waiting_room_required'].includes(code))
        klass = 'model_unavailable';
    else if (status === 401)
        klass = 'auth';
    else if (status === 403)
        klass = 'permission';
    else if (status === 400)
        klass = 'invalid_request';
    else if (status === 408)
        klass = 'timeout';
    else if (status >= 500)
        klass = 'server';
    else if (status === 429)
        klass = 'rate_limit';
    else if (status === 0)
        klass = 'network';
    return { class: klass, providerCode: code || undefined, retryAfterMs, resetAt, bytesSent, sideEffectAccepted, message: message || `Freebuff request failed (${status || 'network'})` };
}
export function maySwitchAccount(outcome, request, policy) {
    if (outcome.bytesSent || outcome.sideEffectAccepted)
        return false;
    if (outcome.class !== 'quota_exhausted')
        return false;
    // A streaming request may switch only before its first byte. At that point
    // no response has been exposed and the provider rejected admission safely.
    // `allowStreamingFailover` is reserved for future post-header provider
    // idempotency support and is never used to permit switching after bytes.
    if (request.sideEffect !== 'none' && !policy.allowNonIdempotentFailover)
        return false;
    return true;
}
