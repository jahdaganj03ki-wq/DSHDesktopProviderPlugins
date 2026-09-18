export * from './types.js';
export * from './errors.js';
export * from './account-vault.js';
export * from './scheduler.js';
export * from './freebuff-transport.js';
export * from './failover.js';
export * from './provider.js';
export * from './dsh-adapter.js';
export * from './routes.js';
export * from './plugin.js';
export { apply as default } from './plugin.js';
/**
 * DSH registration is intentionally kept behind the peer dependency boundary.
 * The transport/core can be contract-tested without booting DSH; wiring it into
 * `ctx.llm.registerAdapter` should follow the installed dsh-llm version.
 */
export const FREEBUFF_PROVIDER = 'freebuff';
