import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Skill, SkillMetadata, SkillRegistry } from './types.js';
import { toolRegistry } from '../tools/registry.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Registry implements SkillRegistry {
    private skills: Map<string, Skill> = new Map();

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
     * Returns a tool definition block for the given skills.
     * The canonical source of tool schemas is `toolRegistry` (not prompt-layer static strings).
     */
    getToolDefinitionsForSkills(skillIds: string[]): string {
        const wantedToolNames = new Set<string>();
        for (const id of skillIds) {
            const skill = this.getSkill(id);
            if (!skill) continue;
            for (const toolName of skill.metadata.tools || []) {
                wantedToolNames.add(toolName);
            }
        }

        const definitions = toolRegistry.getAllDefinitions();
        const filtered = wantedToolNames.size > 0
            ? definitions.filter(d => wantedToolNames.has(d.name))
            : definitions;

        if (filtered.length === 0) {
            return '**AVAILABLE TOOLS (Auto-Generated)**\n\n**No tools available.**';
        }

        const lines: string[] = [
            '**AVAILABLE TOOLS (Auto-Generated)**',
            '',
            'The following tools are available for use. Each tool has a name, description, and required parameters.',
            ''
        ];

        for (const def of filtered) {
            lines.push(`### \`${def.name}\``);
            lines.push(`${def.description}`);

            if (def.parameters && def.parameters.properties) {
                const props = Object.entries(def.parameters.properties);
                const required = def.parameters.required || [];

                if (props.length > 0) {
                    lines.push('**Parameters:**');
                    for (const [name, schema] of props) {
                        const isRequired = required.includes(name);
                        const typeStr = (schema as any).type || 'any';
                        const desc = (schema as any).description || '';
                        lines.push(`- \`${name}\` (${typeStr}${isRequired ? ', required' : ''}): ${desc}`);
                    }
                }
            }

            lines.push('');
        }

        return lines.join('\n');
    }
}

export const skillRegistry = new Registry();
