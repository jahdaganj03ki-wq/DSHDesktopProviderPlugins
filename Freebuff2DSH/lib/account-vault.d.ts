import type { FreebuffAccount } from './types.js';
declare function publicAccount(account: FreebuffAccount): {
    id: string;
    alias: string;
    userId?: string;
    email?: string;
    enabled: boolean;
    weight: number;
    quotaState: import("./types.js").QuotaState;
    breakerState: import("./types.js").BreakerState;
    cooldownUntil?: number;
    resetAt?: number;
    inFlight: number;
    lastErrorClass?: import("./types.js").FreebuffErrorClass;
    lastSuccessAt?: number;
    consecutiveFailures: number;
};
/** Host-side account store. Production deployments should replace token storage with DPAPI/keychain. */
export declare class AccountVault {
    private readonly filename;
    private readonly key;
    private accounts;
    private saveTail;
    constructor(filename: string, key: Buffer);
    load(): Promise<void>;
    listPublic(): ReturnType<typeof publicAccount>[];
    listHost(): FreebuffAccount[];
    /** Internal host map used by the scheduler; never expose this to browser code. */
    hostMap(): Map<string, FreebuffAccount>;
    get(id: string): FreebuffAccount | undefined;
    add(input: {
        alias: string;
        token: string;
        userId?: string;
        email?: string;
        weight?: number;
    }): Promise<FreebuffAccount>;
    update(id: string, patch: Partial<Omit<FreebuffAccount, 'id' | 'token'>>): Promise<void>;
    remove(id: string): Promise<void>;
    save(): Promise<void>;
}
export {};
