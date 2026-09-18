import type { AccountVault } from './account-vault.js';
/** Minimal host-side account management API; token is accepted and immediately sealed by the vault. */
export declare function registerFreebuffRoutes(ctx: any, vault: AccountVault): void;
