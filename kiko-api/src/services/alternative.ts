/**
 * Alternative.me Fear & Greed Index Service Stub
 */

export async function getFearGreedIndex(): Promise<{ value: number; classification: string }> {
    return { value: 50, classification: 'Neutral' };
}

// Alias
export const getFearAndGreedIndex = getFearGreedIndex;
