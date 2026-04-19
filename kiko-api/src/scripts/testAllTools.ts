// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Renata
// Reason: `npm run test:tools` pointed to a missing file, which hid drift
//         between runtime tool registration, skill.json exposure, and prompt
//         instructions. This script restores a read-only audit gate.
// Goal: fail fast when a prompt-visible or skill-referenced tool is not
//       executable through the built-in registry, or when exposed schema
//       descriptions are too weak for stable model tool calls.
// Owns: static/runtime consistency checks for KiKo LLM tools and skills.
// Does Not Own: live API calls, real tool execution, trading side effects, or prompt routing policy.
// Design Language:
// - tool availability must be explicit and testable
// - prompt-mentioned tool names must resolve to registered tools or context-read tools
// - legacy non-exposed execution tools require a local allowlist with a reason
// - schema descriptions must explain model-facing parameters clearly enough for filling
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-skill-tool-prompt-consistency-audit.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: restoring `npm run test:tools` and checking prompt/tool/schema drift
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-skill-tool-prompt-consistency-audit.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-work-protocol-refactor.md

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureToolRegistryInitialized } from '../tooling/bootstrap.js';
import { toolRegistry } from '../tooling/registry.js';
import { skillRegistryExec } from '../skills/registry.js';

type Failure = {
    code: string;
    detail: Record<string, unknown>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '..');
const skillsExecRoot = path.join(srcRoot, 'skills_exec');
const skillsRoot = path.join(srcRoot, 'skills');

const intentionalNonExposedTools: Record<string, string> = {
    execute_swap: 'Legacy single-shot swap executor; chat uses prepare_swap_transaction so confirmation and policy gates stay centralized.',
};

const contextReadToolPrefixes = ['read_'];
const failures: Failure[] = [];

ensureToolRegistryInitialized();

const registeredDefinitions = toolRegistry.getAllDefinitions();
const registeredToolNames = new Set(registeredDefinitions.map((definition) => definition.name));
const registeredDefinitionByName = new Map(registeredDefinitions.map((definition) => [definition.name, definition]));

const rawSkillToolRefs = loadRawSkillToolRefs();
const rawReferencedToolNames = new Set(rawSkillToolRefs.map((ref) => ref.tool));
const loadedSkills = skillRegistryExec.getAllSkills();
const loadedSkillToolNames = new Set(loadedSkills.flatMap((skill) => skill.metadata.tools || []));
const exportedDefinitionNames = loadExportedToolDefinitionNames(skillsRoot);

for (const ref of rawSkillToolRefs) {
    if (!registeredToolNames.has(ref.tool)) {
        failures.push({
            code: 'SKILL_REFERENCES_UNREGISTERED_TOOL',
            detail: ref,
        });
    }
}

for (const name of exportedDefinitionNames) {
    if (registeredToolNames.has(name)) continue;
    if (intentionalNonExposedTools[name]) continue;
    failures.push({
        code: 'EXPORTED_TOOL_NOT_REGISTERED',
        detail: {
            tool: name,
        },
    });
}

for (const name of registeredToolNames) {
    if (loadedSkillToolNames.has(name)) continue;
    if (contextReadToolPrefixes.some((prefix) => name.startsWith(prefix))) continue;
    failures.push({
        code: 'REGISTERED_TOOL_NOT_EXPOSED_BY_ANY_SKILL',
        detail: {
            tool: name,
        },
    });
}

for (const mention of loadPromptToolMentions()) {
    if (!registeredToolNames.has(mention.tool)) {
        failures.push({
            code: 'PROMPT_MENTIONS_UNREGISTERED_TOOL',
            detail: mention,
        });
        continue;
    }
    const isContextReadTool = contextReadToolPrefixes.some((prefix) => mention.tool.startsWith(prefix));
    const skillTools = rawSkillToolRefs
        .filter((ref) => ref.skill === mention.skill)
        .map((ref) => ref.tool);
    if (!isContextReadTool && !skillTools.includes(mention.tool)) {
        failures.push({
            code: 'PROMPT_MENTIONS_TOOL_NOT_IN_SKILL_JSON',
            detail: {
                ...mention,
                skillTools,
            },
        });
    }
}

for (const skill of loadedSkills) {
    for (const toolName of skill.metadata.tools || []) {
        const definition = registeredDefinitionByName.get(toolName);
        if (!definition) continue;
        if (!hasUsefulText(definition.description)) {
            failures.push({
                code: 'WEAK_TOOL_DESCRIPTION',
                detail: {
                    skill: skill.metadata.id,
                    tool: toolName,
                    description: definition.description || '',
                },
            });
        }

        const properties = definition.parameters?.properties || {};
        for (const [param, schema] of Object.entries(properties)) {
            const description = typeof (schema as any)?.description === 'string'
                ? (schema as any).description
                : '';
            if (!hasUsefulText(description)) {
                failures.push({
                    code: 'WEAK_PARAMETER_DESCRIPTION',
                    detail: {
                        skill: skill.metadata.id,
                        tool: toolName,
                        param,
                        description,
                    },
                });
            }
        }
    }
}

if (failures.length > 0) {
    console.error(JSON.stringify({
        ok: false,
        registeredToolCount: registeredToolNames.size,
        skillCount: loadedSkills.length,
        failures,
    }, null, 2));
    process.exit(1);
}

console.log(JSON.stringify({
    ok: true,
    registeredToolCount: registeredToolNames.size,
    skillCount: loadedSkills.length,
    rawReferencedToolCount: rawReferencedToolNames.size,
    intentionallyNonExposedTools: intentionalNonExposedTools,
}, null, 2));

process.exit(0);

function hasUsefulText(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim().length >= 15;
}

function loadRawSkillToolRefs(): Array<{ skill: string; tool: string; file: string }> {
    const refs: Array<{ skill: string; tool: string; file: string }> = [];
    for (const skillDir of fs.readdirSync(skillsExecRoot, { withFileTypes: true })) {
        if (!skillDir.isDirectory()) continue;
        const file = path.join(skillsExecRoot, skillDir.name, 'skill.json');
        if (!fs.existsSync(file)) continue;
        const metadata = JSON.parse(fs.readFileSync(file, 'utf8')) as { id?: string; tools?: string[] };
        const skill = metadata.id || skillDir.name;
        for (const tool of metadata.tools || []) {
            refs.push({
                skill,
                tool,
                file: path.relative(path.resolve(srcRoot, '..'), file),
            });
        }
    }
    return refs;
}

function loadExportedToolDefinitionNames(root: string): Set<string> {
    const names = new Set<string>();
    for (const file of walkFiles(root)) {
        if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
        const text = fs.readFileSync(file, 'utf8');
        const exportedToolPattern = /export\s+const\s+\w+\s*:\s*Tool(?:<[^>]+>)?\s*=\s*\{\s*definition\s*:\s*\{[\s\S]*?name\s*:\s*['"]([^'"]+)['"]/g;
        for (const match of text.matchAll(exportedToolPattern)) {
            names.add(match[1]);
        }
    }
    return names;
}

function loadPromptToolMentions(): Array<{ skill: string; tool: string; file: string }> {
    const registeredOrReferenced = new Set([
        ...registeredToolNames,
        ...rawReferencedToolNames,
        ...exportedDefinitionNames,
    ]);
    const mentions: Array<{ skill: string; tool: string; file: string }> = [];
    for (const skillDir of fs.readdirSync(skillsExecRoot, { withFileTypes: true })) {
        if (!skillDir.isDirectory()) continue;
        const metadataFile = path.join(skillsExecRoot, skillDir.name, 'skill.json');
        if (!fs.existsSync(metadataFile)) continue;
        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')) as { id?: string };
        const skill = metadata.id || skillDir.name;
        for (const promptFile of ['prompt.exec.md', 'prompt.md']) {
            const file = path.join(skillsExecRoot, skillDir.name, promptFile);
            if (!fs.existsSync(file)) continue;
            const text = fs.readFileSync(file, 'utf8');
            const toolNames = new Set<string>();
            for (const match of text.matchAll(/`([a-z][a-z0-9_]{2,})`/g)) {
                toolNames.add(match[1]);
            }
            for (const match of text.matchAll(/\b([a-z]+(?:_[a-z0-9]+){1,})\b/g)) {
                toolNames.add(match[1]);
            }
            for (const tool of toolNames) {
                if (!registeredOrReferenced.has(tool)) continue;
                mentions.push({
                    skill,
                    tool,
                    file: path.relative(path.resolve(srcRoot, '..'), file),
                });
            }
        }
    }
    return mentions;
}

function walkFiles(root: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const next = path.join(root, entry.name);
        if (entry.isDirectory()) {
            out.push(...walkFiles(next));
        } else {
            out.push(next);
        }
    }
    return out;
}
