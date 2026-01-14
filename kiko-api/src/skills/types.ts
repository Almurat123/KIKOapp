import { type HighLevelIntentType } from '../services/ai/intentParser.js';

export interface SkillMetadata {
    id: string; // e.g., 'swap', 'risk', 'polymarket'
    name: string; // Human-readable name
    description: string; // Description for the agent/user
    intents: string[]; // Triggers for this skill (strings for flexibility, mapped to HighLevelIntentType)
    tools: string[]; // List of tool names included in this skill
    examples: {
        en: string[];
        zh: string[];
    };
}

export interface Skill {
    metadata: SkillMetadata;
    prompt: string; // Loaded from prompt.md
    // We map tool names to their implementations in the registry, 
    // so we don't strictly need to store implementations here, 
    // but we need to know which tools belong to this skill.
}

export interface SkillRegistry {
    register(skill: Skill): void;
    getSkill(id: string): Skill | undefined;
    getSkillsByIntent(intent: string): Skill[];
    getAllSkills(): Skill[];
    // Helper to get tool definitions for a list of skills
    getToolDefinitionsForSkills(skillIds: string[]): string; // Returns combined JSON Schema string
}
