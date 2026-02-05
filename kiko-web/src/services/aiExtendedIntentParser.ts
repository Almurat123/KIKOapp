import type { Intent } from './intentTypes';

export class AIExtendedIntentParser {
    static async parseUserIntent(_input: string): Promise<Intent | null> {
        return null;
    }
}

export type ExtendedUserIntent = Intent;
