import type { FailoverPolicy } from './types.js';
export declare const name = "llm-freebuff";
export declare const inject: string[];
export interface FreebuffConfig extends Partial<FailoverPolicy> {
    baseUrl?: string;
    vaultPath?: string;
    vaultKey?: string;
    userAgent?: string;
}
export declare function apply(ctx: any, config?: FreebuffConfig): void;
