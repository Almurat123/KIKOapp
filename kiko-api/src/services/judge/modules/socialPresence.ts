/**
 * Social Presence Module
 * Evaluates if project is actively managed and discussed
 */

import { SocialPresence } from '../../../types/judgeTypes.js';

export interface SocialPresenceInput {
    twitterActive: boolean;          // Posted in last 7 days
    twitterFollowers: number;
    hasKOLMentions: boolean;
    communityDiscussionLevel: number; // 0-1 from sentiment analysis
    telegramActive: boolean;
    discordActive: boolean;
}

export function evaluateSocialPresence(input: SocialPresenceInput): SocialPresence {
    let score = 0;

    // Twitter activity (critical)
    if (input.twitterActive) {
        score += 0.20;
    }

    // Follower count tiers
    if (input.twitterFollowers > 10000) {
        score += 0.25;
    } else if (input.twitterFollowers > 1000) {
        score += 0.15;
    } else if (input.twitterFollowers > 100) {
        score += 0.05;
    }

    // KOL mentions (authority signal)
    if (input.hasKOLMentions) {
        score += 0.20;
    }

    // Community discussion
    score += input.communityDiscussionLevel * 0.15;

    // Telegram activity
    if (input.telegramActive) {
        score += 0.10;
    }

    // Discord activity
    if (input.discordActive) {
        score += 0.10;
    }

    // Clamp to 0-1
    score = Math.max(0, Math.min(1, score));

    return {
        twitter_active: input.twitterActive,
        twitter_followers: input.twitterFollowers,
        has_kol_mentions: input.hasKOLMentions,
        community_discussion_level: input.communityDiscussionLevel,
        telegram_active: input.telegramActive,
        discord_active: input.discordActive,
        score,
    };
}
