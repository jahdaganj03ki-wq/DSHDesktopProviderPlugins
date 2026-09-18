import { AccountScheduler } from './scheduler.js';
import type { FreebuffAccount, FreebuffRequest, FailoverPolicy } from './types.js';
export interface AttemptResult<T> {
    value: T;
    bytesSent: boolean;
    sideEffectAccepted: boolean;
}
export interface FreebuffAttemptContext {
    account: FreebuffAccount;
    attempt: number;
}
export type SendAttempt<T> = (context: FreebuffAttemptContext) => Promise<AttemptResult<T>>;
export declare class AllAccountsExhaustedError extends Error {
    readonly resetAt: ReadonlyMap<string, number | undefined>;
    constructor(resetAt: ReadonlyMap<string, number | undefined>);
}
/** Executes one semantic request; account changes only happen before bytes/side effects. */
export declare class FreebuffFailoverExecutor {
    private readonly accounts;
    private readonly scheduler;
    constructor(accounts: Map<string, FreebuffAccount>, scheduler: AccountScheduler);
    execute<T>(request: FreebuffRequest, policy: FailoverPolicy, send: SendAttempt<T>): Promise<T>;
    private outcome;
}
