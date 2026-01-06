import type { Intent } from './intentParser';

export class AIExtendedIntentParser {
    static async parseUserIntent(input: string): Promise<Intent | null> {
        return null;
    }
}

export type ExtendedUserIntent = Intent;
