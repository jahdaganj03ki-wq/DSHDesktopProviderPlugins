import { FreebuffTransport } from './freebuff-transport.js';
import type { FreebuffAccount, FreebuffRequest, FailoverPolicy } from './types.js';
export declare const FREEBUFF_MODELS: string[];
/** Native Freebuff lifecycle: account → session → agent run → SSE chat. */
export declare class FreebuffProvider {
    private readonly accounts;
    private readonly policy;
    private readonly transport;
    private readonly persist?;
    private readonly sessions;
    private readonly runs;
    private readonly locks;
    private ready;
    constructor(accounts: Map<string, FreebuffAccount>, policy: FailoverPolicy, transport?: FreebuffTransport, persist?: (() => Promise<void>) | undefined);
    setReady(ready: Promise<void>): void;
    models(): readonly string[];
    stream(request: FreebuffRequest): AsyncIterable<Uint8Array>;
    private transform;
    private ensureSession;
    private ensureRun;
}
