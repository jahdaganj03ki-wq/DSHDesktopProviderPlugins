import type { FreebuffErrorOutcome } from './types.js';
/** Classifies only documented/provider-shaped signals; generic 429 is not quota exhaustion. */
export declare function classifyFreebuffError(input: {
    status?: number;
    body?: string;
    error?: unknown;
    bytesSent?: boolean;
    sideEffectAccepted?: boolean;
}): FreebuffErrorOutcome;
export declare function maySwitchAccount(outcome: FreebuffErrorOutcome, request: {
    stream: boolean;
    sideEffect: string;
}, policy: {
    allowStreamingFailover: boolean;
    allowNonIdempotentFailover: boolean;
}): boolean;
