/**
 * Tool Prompt Generator
 * 
 * Dynamically generates system prompt content from the actual tool registry.
 * This ensures the LLM always knows exactly what tools are available and their schemas.
 */

import { toolRegistry } from '../../tools/registry.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

/**
 * Generates a formatted tool description block for the system prompt.
 * This is the SINGLE SOURCE OF TRUTH for tool information in prompts.
 */
export function generateToolPrompt(): string {
    const definitions = toolRegistry.getAllDefinitions();

    if (definitions.length === 0) {
        logger.error(LogCode.SYS_ERROR, 'ToolPromptGenerator: No tools registered');
        return '**No tools available.**';
    }

    const lines: string[] = [
        '**AVAILABLE TOOLS (Auto-Generated)**',
        '',
        'The following tools are available for use. Each tool has a name, description, and required parameters.',
        ''
    ];

    for (const def of definitions) {
        lines.push(`### \`${def.name}\``);
        lines.push(`${def.description}`);

        // Format parameters
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

        lines.push(''); // Empty line between tools
    }

    return lines.join('\n');
}

/**
 * Generates a condensed tool list for quick reference.
 * Used for token-constrained contexts.
 */
export function generateToolList(): string {
    const definitions = toolRegistry.getAllDefinitions();
    return definitions.map(d => `- \`${d.name}\`: ${d.description.split('.')[0]}`).join('\n');
}
