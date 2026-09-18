import type { FreebuffAccount, FailoverPolicy } from './types.js';
/** In-memory weighted fair scheduler; persistence remains the vault's responsibility. */
export declare class AccountScheduler {
    private readonly accounts;
    private cursor;
    constructor(accounts: Map<string, FreebuffAccount>);
    select(excluded: Set<string>, policy: FailoverPolicy, now?: number): FreebuffAccount | undefined;
    release(account: FreebuffAccount): void;
    recordFailure(account: FreebuffAccount, klass: FreebuffAccount['lastErrorClass'], resetAt?: number, retryAfterMs?: number): void;
    recordSuccess(account: FreebuffAccount): void;
}
