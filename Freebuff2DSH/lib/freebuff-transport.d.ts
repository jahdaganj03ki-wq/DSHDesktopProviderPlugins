import type { FreebuffAdapterOptions, FreebuffRequest, FreebuffResponse } from './types.js';
export declare class FreebuffTransport {
    private readonly baseUrl;
    private readonly fetchImpl;
    private readonly userAgent;
    constructor(options?: FreebuffAdapterOptions);
    me(token: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
    session(token: string, method: 'GET' | 'DELETE', model?: string, instanceId?: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
    admitSession(token: string, model: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
    startRun(token: string, agentId: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
    chat(token: string, request: FreebuffRequest, instanceId: string, signal?: AbortSignal): Promise<FreebuffResponse>;
    private headers;
    private jsonOrThrow;
    private iterate;
}
