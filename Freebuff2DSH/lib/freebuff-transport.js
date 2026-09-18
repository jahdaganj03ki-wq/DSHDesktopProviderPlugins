const DEFAULT_BASE = 'https://www.codebuff.com';
function withTimeout(signal, timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
export class FreebuffTransport {
    baseUrl;
    fetchImpl;
    userAgent;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.userAgent = options.userAgent ?? 'dsh-freebuff/0.1';
    }
    async me(token, signal) {
        const response = await this.fetchImpl(`${this.baseUrl}/api/v1/me`, { headers: this.headers(token), signal: withTimeout(signal, 10_000) });
        return this.jsonOrThrow(response);
    }
    async session(token, method, model, instanceId, signal) {
        const headers = this.headers(token);
        if (model)
            headers['x-freebuff-model'] = model;
        if (instanceId)
            headers['x-freebuff-instance-id'] = instanceId;
        const response = await this.fetchImpl(`${this.baseUrl}/api/v1/freebuff/session`, { method, headers, signal: withTimeout(signal, 20_000) });
        return this.jsonOrThrow(response);
    }
    async admitSession(token, model, signal) {
        const response = await this.fetchImpl(`${this.baseUrl}/api/v1/freebuff/session/admission`, {
            method: 'POST', headers: { ...this.headers(token), 'content-type': 'application/json', 'x-freebuff-model': model },
            body: JSON.stringify({ model }), signal: withTimeout(signal, 20_000),
        });
        return this.jsonOrThrow(response);
    }
    async startRun(token, agentId, signal) {
        const response = await this.fetchImpl(`${this.baseUrl}/api/v1/agent-runs`, {
            method: 'POST', headers: { ...this.headers(token), 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'START', agentId, ancestorRunIds: [] }), signal: withTimeout(signal, 20_000),
        });
        return this.jsonOrThrow(response);
    }
    async chat(token, request, instanceId, signal) {
        const response = await this.fetchImpl(`${this.baseUrl}/api/v1/chat/completions`, {
            method: 'POST', headers: { ...this.headers(token), 'content-type': 'application/json', 'x-freebuff-instance-id': instanceId },
            body: JSON.stringify({ ...request.body, model: request.model, stream: true }), signal: withTimeout(signal, request.deadlineMs ?? 120_000),
        });
        if (!response.ok) {
            const body = await response.text();
            throw Object.assign(new Error(body || `Freebuff HTTP ${response.status}`), { status: response.status, body });
        }
        if (!response.body)
            throw new Error('Freebuff returned no response body');
        return { status: response.status, headers: response.headers, body: this.iterate(response.body), bytesSent: false };
    }
    headers(token) { return { authorization: `Bearer ${token}`, 'user-agent': this.userAgent, accept: 'application/json' }; }
    async jsonOrThrow(response) { const body = await response.text(); if (!response.ok)
        throw Object.assign(new Error(body || `Freebuff HTTP ${response.status}`), { status: response.status, body }); return body ? JSON.parse(body) : {}; }
    async *iterate(body) { const reader = body.getReader(); try {
        while (true) {
            const next = await reader.read();
            if (next.done)
                return;
            yield next.value;
        }
    }
    finally {
        reader.releaseLock();
    } }
}
