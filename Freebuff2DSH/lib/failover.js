import { classifyFreebuffError, maySwitchAccount } from './errors.js';
import { AccountScheduler } from './scheduler.js';
export class AllAccountsExhaustedError extends Error {
    resetAt;
    constructor(resetAt) {
        super('No eligible Freebuff account remains');
        this.resetAt = resetAt;
    }
}
/** Executes one semantic request; account changes only happen before bytes/side effects. */
export class FreebuffFailoverExecutor {
    accounts;
    scheduler;
    constructor(accounts, scheduler) {
        this.accounts = accounts;
        this.scheduler = scheduler;
    }
    async execute(request, policy, send) {
        const tried = new Set();
        const resetAt = new Map();
        let attempts = 0;
        let switches = 0;
        const maxAttempts = policy.enabled ? Math.max(1, policy.maxAttempts) : 1;
        while (attempts < maxAttempts) {
            attempts++;
            const account = this.scheduler.select(tried, policy);
            if (!account)
                throw new AllAccountsExhaustedError(resetAt);
            tried.add(account.id);
            try {
                const result = await send({ account, attempt: attempts });
                this.scheduler.recordSuccess(account);
                this.scheduler.release(account);
                return result.value;
            }
            catch (error) {
                const outcome = this.outcome(error);
                account.lastErrorClass = outcome.class;
                if (outcome.resetAt !== undefined)
                    resetAt.set(account.id, outcome.resetAt);
                this.scheduler.recordFailure(account, outcome.class, outcome.resetAt, outcome.retryAfterMs);
                this.scheduler.release(account);
                const canSwitch = policy.enabled && switches < policy.maxAccountSwitches && attempts < maxAttempts && maySwitchAccount(outcome, request, policy);
                if (!canSwitch)
                    throw error;
                switches++;
            }
        }
        throw new AllAccountsExhaustedError(resetAt);
    }
    outcome(error) {
        const value = error;
        return classifyFreebuffError({ status: value.status, body: value.body, error, bytesSent: value.bytesSent, sideEffectAccepted: value.sideEffectAccepted });
    }
}
