const MAX_BODY = 64 * 1024;
function json(res, status, value) {
    const body = JSON.stringify(value);
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(body);
}
async function body(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        const data = Buffer.from(chunk);
        size += data.length;
        if (size > MAX_BODY)
            throw new Error('request too large');
        chunks.push(data);
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}
/** Minimal host-side account management API; token is accepted and immediately sealed by the vault. */
export function registerFreebuffRoutes(ctx, vault) {
    const register = (route) => ctx.webServer.register(route);
    const install = () => [
        register({ kind: 'exact', path: '/api/dsh-freebuff/accounts', handler: async (_req, res) => json(res, 200, { accounts: vault.listPublic() }) }),
        register({ kind: 'exact', path: '/api/dsh-freebuff/accounts/add', handler: async (req, res) => {
                try {
                    const input = await body(req);
                    const account = await vault.add({ alias: String(input.alias ?? ''), token: String(input.token ?? ''), userId: input.userId ? String(input.userId) : undefined, email: input.email ? String(input.email) : undefined, weight: Number(input.weight ?? 1) });
                    json(res, 201, { account: vault.listPublic().find(item => item.id === account.id) });
                }
                catch (error) {
                    json(res, 400, { error: error instanceof Error ? error.message : 'invalid request' });
                }
            } }),
        register({ kind: 'exact', path: '/api/dsh-freebuff/accounts/remove', handler: async (req, res) => {
                try {
                    const input = await body(req);
                    await vault.remove(String(input.id ?? ''));
                    json(res, 200, { ok: true });
                }
                catch (error) {
                    json(res, 400, { error: error instanceof Error ? error.message : 'invalid request' });
                }
            } }),
    ];
    if (typeof ctx.effect === 'function')
        ctx.effect(() => { const disposers = install(); return () => disposers.forEach((dispose) => typeof dispose === 'function' && dispose()); });
    else
        install();
}
