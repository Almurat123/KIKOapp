import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Skill, SkillMetadata, SkillRegistry } from './types.js';
import { TOOL_DEFINITIONS } from '../services/ai/prompts/core.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Registry implements SkillRegistry {
    private skills: Map<string, Skill> = new Map();
    private toolDefinitionsRaw: string = TOOL_DEFINITIONS; // Fallback to core definitions initially

    constructor() {
        // Auto-load skills on instantiation
        this.loadSkills();
    }

    private loadSkills() {
        console.log('[SkillRegistry] Loading skills...');

        // Scan directories in src/skills/
        const skillsDir = __dirname;
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillDir = path.join(skillsDir, entry.name);
                this.loadSkillFromDir(skillDir);
            }
        }
    }

    private loadSkillFromDir(dir: string) {
        try {
            const jsonPath = path.join(dir, 'skill.json');
            const promptPath = path.join(dir, 'prompt.md');

            if (!fs.existsSync(jsonPath) || !fs.existsSync(promptPath)) {
                // Not a valid skill directory
                return;
            }

            const metadata: SkillMetadata = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            const prompt = fs.readFileSync(promptPath, 'utf-8');

            const skill: Skill = {
                metadata,
                prompt
            };

            this.register(skill);
            console.log(`[SkillRegistry] Loaded skill: ${metadata.id}`);

        } catch (error) {
            console.error(`[SkillRegistry] Failed to load skill from ${dir}:`, error);
        }
    }

    register(skill: Skill) {
        this.skills.set(skill.metadata.id, skill);
    }

    getSkill(id: string): Skill | undefined {
        return this.skills.get(id);
    }

    getSkillsByIntent(intent: string): Skill[] {
        return Array.from(this.skills.values()).filter(skill =>
            skill.metadata.intents.includes(intent)
        );
    }

    getAllSkills(): Skill[] {
        return Array.from(this.skills.values());
    }

    /**
     * Currently returns the global TOOL_DEFINITIONS string.
     * TODO: Future improvement - generate this dynamically from registered tool definitions
     * to only show relevant tools for active skills.
     */
    getToolDefinitionsForSkills(skillIds: string[]): string {
        // For now, we return the global definition as fallback/simplification 
        // until we fully migrate individual tool definitions into skills.
        return this.toolDefinitionsRaw;
    }
}

export const skillRegistry = new Registry();
