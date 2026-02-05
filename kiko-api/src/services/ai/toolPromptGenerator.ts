/**
 * Tool Prompt Generator
 * 
 * Dynamically generates system prompt content from the actual tool registry.
 * This ensures the LLM always knows exactly what tools are available and their schemas.
 */

import { toolRegistry } from '../../tooling/registry.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

/**
 * Generates a condensed tool list for quick reference.
 * Used for token-constrained contexts.
 */
export function generateToolList(): string {
    const definitions = toolRegistry.getAllDefinitions();
    const lines = [
        'Available tools (optional, use only if helpful):',
        ...definitions.map(d => `- \`${d.name}\`: ${d.description.split('.')[0]}`)
    ];
    return lines.join('\n');
}
