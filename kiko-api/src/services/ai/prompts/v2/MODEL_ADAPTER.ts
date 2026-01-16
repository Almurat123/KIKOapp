type ModelAdapterMap = {
    deepseek: string;
    grok: string;
};

export const MODEL_ADAPTER: ModelAdapterMap = {
    deepseek: `
Model behavior: DeepSeek
- Prefer concise, structured reasoning.
- Use brief step-by-step only when necessary.
`.trim(),
    grok: `
Model behavior: Grok
- Focus on social sentiment only when relevant.
- Keep output concise and avoid redundant safety text.
`.trim()
};
