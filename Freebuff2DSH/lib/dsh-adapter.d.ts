import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { ModelModality } from '@deepseek-ai/dsh-llm';
import { FreebuffProvider } from './provider.js';
/** Direct DSH LLM seam adapter. It intentionally exposes only text/tool chunks. */
export declare class FreebuffLlmAdapter extends LlmAdapter {
    private readonly provider;
    constructor(provider: FreebuffProvider);
    providerInfo(provider: string): {
        id: string;
        name: string;
    };
    listModels(_provider: string): Promise<{
        provider: string;
        id: string;
        name: string;
        inputModalities: readonly ModelModality[];
    }[]>;
    resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<{
        provider: string;
        id: string;
        name: string;
        inputModalities: readonly ModelModality[];
        context: {
            contextWindow: number;
        };
    }>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<{
        model: {
            provider: string;
            id: string;
            name: string;
            inputModalities: readonly ModelModality[];
            context: {
                contextWindow: number;
            };
        };
        stream: (options: any) => AsyncIterable<any>;
    }>;
    stream(options: any): AsyncIterable<any>;
}
export declare function createFreebuffLlmAdapter(provider: FreebuffProvider): FreebuffLlmAdapter;
