export const DEFAULT_FAILOVER_POLICY = {
    enabled: false,
    maxAttempts: 1,
    maxAccountSwitches: 0,
    allowStreamingFailover: false,
    allowNonIdempotentFailover: false,
    maxConcurrentPerAccount: 1,
};
