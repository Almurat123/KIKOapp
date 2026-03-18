const INTERNAL_JSON_MARKERS = [
    'case_id',
    'required_context_usage',
    'tool_plan',
    'error_matrix',
    'response_contract',
    'decision_flow',
    'available_tools_expected',
    'expected_assistant_behavior',
];

const INTERNAL_LABELED_JSON_BLOCKS = new Set([
    'USER_SETTINGS',
    'USER_CONTEXT',
    'EXECUTION_PLAN',
    'PROVIDER_NATIVE_EVIDENCE',
]);

const PSEUDO_TOOL_CALL_PATTERNS = [
    /```json\s*[\s\S]*?"tool_calls"\s*:\s*\[/i,
    /```json\s*[\s\S]*?"tool_name"\s*:\s*"/i,
    /```json\s*[\s\S]*?"tool"\s*:\s*"/i,
    /(?:^|\n)\s*\{\s*"tool_calls"\s*:\s*\[/i,
    /(?:^|\n)\s*\{\s*"tool_name"\s*:\s*"/i,
    /(?:^|\n)\s*\{\s*"tool"\s*:\s*"/i,
    /<tool_calls?>[\s\S]*?<\/tool_calls?>/i,
    /<toolcall\b[^>]*>[\s\S]*?<\/toolcall>/i,
    /<invoke\b[^>]*>[\s\S]*?<\/invoke>/i,
    /<parameter\b[^>]*>[\s\S]*?<\/parameter>/i,
    /<tool_name>[\s\S]*?<\/tool_name>/i,
    /<function_call\b[^>]*>[\s\S]*?<\/function_call>/i,
    /<argument\b[^>]*>[\s\S]*?<\/argument>/i,
    /(?:^|\n)\s*function\s+call\s*:\s*[a-z_][a-z0-9_]*(?:\s*\(|\s*$)/i,
    /(?:^|\n)\s*(?:tool|tool_name|function)\s*:\s*[a-z_][a-z0-9_]*(?:\s*$|\n|\s*\()/i,
    /(?:^|\n)\s*(?:call|using|use)\s+(?:the\s+)?tool\s+[a-z_][a-z0-9_]*(?:\b|\s*\()/i,
    /(?:^|\n)\s*calling\b[^\n]*\b(?:get_[a-z0-9_]+|analyze_[a-z0-9_]+)\b[^\n]*(?=\n|$)/i,
    /(?:^|\n)\s*i\s+will\s+fetch\b[\s\S]*?\b(?:get_[a-z0-9_]+|analyze_[a-z0-9_]+)\b/i,
];

const REASONING_INTERNAL_PATTERNS = [
    /task strategy/i,
    /task_strategy/i,
    /tool preferences/i,
    /tool policy/i,
    /current phase/i,
    /intent envelope/i,
    /provider-native/i,
    /available skills?/i,
    /available tools?/i,
    /preferred tools?/i,
    /let me call/i,
    /i should use/i,
    /i'?ll call/i,
    /tool_calls?/i,
    /\btool_name\b/i,
    /<tool_calls?>/i,
    /<invoke\b/i,
    /<parameter\b/i,
    /<function_call\b/i,
    /<argument\b/i,
    /function\s+call\s*:/i,
    /(?:^|\s)tool\s*:\s*[a-z_][a-z0-9_]*/i,
    /(?:call|using|use)\s+(?:the\s+)?tool\s+[a-z_][a-z0-9_]*/i,
    /calling\b.*\b(?:get_[a-z0-9_]+|analyze_[a-z0-9_]+)\b/i,
    /i\s+will\s+fetch\b.*\b(?:get_[a-z0-9_]+|analyze_[a-z0-9_]+)\b/i,
    /\bterminated\b/i,
    /search_polymarket/i,
    /get_polymarket/i,
    /search_farcaster/i,
    /get_trending_casts/i,
    /x_search/i,
    /farcaster/i,
    /polymarket/i,
    /<call_[^>]+>/i,
    /<\/[a-z_]+>/i,
];

export function sanitizeSkillPrompt(rawPrompt: string): string {
    const normalized = String(rawPrompt || '').replace(/\r\n/g, '\n');

    const withoutCaseSections = normalized.replace(
        /^##+\s+CASE[^\n]*\n[\s\S]*?(?=^##+\s+|$)/gim,
        '',
    );

    const withoutInternalJsonBlocks = withoutCaseSections.replace(
        /```json[\s\S]*?```/gi,
        (block) => containsInternalJsonMarker(block) ? '' : block,
    );

    return withoutInternalJsonBlocks
        .replace(/^Use this internal JSON contract.*$/gim, '')
        .replace(/^Do not output this JSON.*$/gim, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function stripLeadingInternalScaffold(answer: string): string {
    let next = String(answer || '');

    while (true) {
        const stripped = stripLeadingInternalScaffoldOnce(next);
        if (stripped === next) break;
        next = stripped;
    }

    return next.trimStart();
}

export function createLeadingInternalScaffoldSuppressor() {
    let buffer = '';
    let passthrough = false;
    let suppressingFence = false;

    return {
        push(delta: string): string {
            if (!delta) return '';
            if (passthrough) return delta;

            buffer += delta;
            const trimmed = buffer.trimStart();

            if (suppressingFence || trimmed.startsWith('```json')) {
                if (containsInternalJsonMarker(buffer)) {
                    suppressingFence = true;
                }
                const closingIdx = buffer.indexOf('```', buffer.indexOf('```json') + 7);
                if (suppressingFence && closingIdx >= 0) {
                    buffer = buffer.slice(closingIdx + 3).replace(/^\s+/, '');
                    passthrough = true;
                    suppressingFence = false;
                    const flushed = buffer;
                    buffer = '';
                    return flushed;
                }
                if (trimmed.startsWith('```json')) {
                    return '';
                }
            }

            if (startsWithInternalLabeledJsonBlock(trimmed)) {
                const stripped = stripLeadingInternalScaffold(buffer);
                if (stripped !== buffer.trimStart()) {
                    buffer = stripped;
                    passthrough = true;
                    const flushed = buffer;
                    buffer = '';
                    return flushed;
                }
                return '';
            }

            if (buffer.length >= 48 || /\n/.test(buffer)) {
                passthrough = true;
                const flushed = stripLeadingInternalScaffold(buffer);
                buffer = '';
                return flushed;
            }

            return '';
        },
        flush(): string {
            if (!buffer) return '';
            const flushed = passthrough ? buffer : stripLeadingInternalScaffold(buffer);
            buffer = '';
            passthrough = true;
            suppressingFence = false;
            return flushed;
        },
    };
}

export function containsPseudoToolCallOutput(answer: string): boolean {
    const text = String(answer || '');
    return PSEUDO_TOOL_CALL_PATTERNS.some((pattern) => pattern.test(text));
}

export function stripPseudoToolCallOutput(answer: string): string {
    let next = String(answer || '');

    next = next.replace(/```json\s*[\s\S]*?"tool_calls"\s*:\s*\[[\s\S]*?```/gi, '');
    next = next.replace(/```json\s*[\s\S]*?"tool_name"\s*:\s*"[\s\S]*?```/gi, '');
    next = next.replace(/```json\s*[\s\S]*?"tool"\s*:\s*"[\s\S]*?```/gi, '');
    next = next.replace(/(?:^|\n)\s*\{\s*"tool_calls"\s*:\s*\[[\s\S]*?\}\s*(?=\n|$)/gi, '\n');
    next = next.replace(/(?:^|\n)\s*\{\s*"tool_name"\s*:\s*"[\s\S]*?\}\s*(?=\n|$)/gi, '\n');
    next = next.replace(/(?:^|\n)\s*\{\s*"tool"\s*:\s*"[\s\S]*?\}\s*(?=\n|$)/gi, '\n');
    next = next.replace(/<tool_calls?>[\s\S]*?<\/tool_calls?>/gi, '\n');
    next = next.replace(/<toolcall\b[^>]*>[\s\S]*?<\/toolcall>/gi, '\n');
    next = next.replace(/<invoke\b[^>]*>[\s\S]*?<\/invoke>/gi, '\n');
    next = next.replace(/<parameter\b[^>]*>[\s\S]*?<\/parameter>/gi, '\n');
    next = next.replace(/<tool_name>[\s\S]*?<\/tool_name>/gi, '\n');
    next = next.replace(/<function_call\b[^>]*>[\s\S]*?<\/function_call>/gi, '\n');
    next = next.replace(/<argument\b[^>]*>[\s\S]*?<\/argument>/gi, '\n');
    next = next.replace(/(?:^|\n)\s*function\s+call\s*:\s*[a-z_][a-z0-9_]*(?:\s*\([^)]*\))?\s*(?=\n|$)/gim, '\n');
    next = next.replace(/(?:^|\n)\s*(?:tool|tool_name|function)\s*:\s*[a-z_][a-z0-9_]*(?:\s*\([^)]*\))?\s*(?=\n|$)/gim, '\n');
    next = next.replace(/(?:^|\n)\s*(?:call|using|use)\s+(?:the\s+)?tool\s+[a-z_][a-z0-9_]*(?:\s*\([^)]*\))?\s*(?=\n|$)/gim, '\n');
    next = next.replace(/(?:^|\n)\s*calling\b[^\n]*\b(?:get_[a-z0-9_]+|analyze_[a-z0-9_]+)\b[^\n]*(?=\n|$)/gim, '\n');
    next = next.replace(/(?:^|\n)\s*i\s+will\s+fetch\b[^\n]*\b(?:get_[a-z0-9_]+|analyze_[a-z0-9_]+)\b[^\n]*(?=\n|$)/gim, '\n');
    next = next.replace(/<call_[^>\n]+>/gi, '\n');
    next = next.replace(/<\/call_[^>\n]+>/gi, '\n');
    next = next.replace(/<ToolCall\b[^>]*>\s*[\s\S]*?<\/ToolCall>/gi, '\n');

    return next.replace(/\n{3,}/g, '\n\n').trim();
}

export function createPseudoToolCallStreamSuppressor() {
    let buffer = '';

    return {
        push(delta: string): string {
            if (!delta) return '';
            buffer += delta;
            return emitPseudoSafeContent(false);
        },
        flush(): string {
            return emitPseudoSafeContent(true);
        },
    };

    function emitPseudoSafeContent(flush: boolean): string {
        let working = buffer;
        let output = '';

        while (true) {
            const blockStart = findEarliestPseudoBlockStart(working);
            if (!blockStart) break;

            output += emitSafeLines(working.slice(0, blockStart.index), true);

            const closeIndex = blockStart.closePattern
                ? working.slice(blockStart.index).search(blockStart.closePattern)
                : -1;

            if (closeIndex < 0) {
                buffer = working.slice(blockStart.index);
                return output;
            }

            const absoluteCloseIndex = blockStart.index + closeIndex;
            const matchedClose = working.slice(absoluteCloseIndex).match(blockStart.closePattern!);
            const closeLength = matchedClose?.[0]?.length || 0;
            working = working.slice(absoluteCloseIndex + closeLength);
        }

        if (!flush) {
            const lastNewline = working.lastIndexOf('\n');
            if (lastNewline < 0) {
                buffer = working;
                return output;
            }

            output += emitSafeLines(working.slice(0, lastNewline + 1), false);
            buffer = working.slice(lastNewline + 1);
            return output;
        }

        output += stripPseudoToolCallOutput(working);
        buffer = '';
        return output;
    }
}

export function sanitizeReasoningForDisplay(reasoning: string): string {
    let next = String(reasoning || '').replace(/\r\n/g, '\n');
    next = stripLeadingInternalScaffold(next);
    next = stripPseudoToolCallOutput(next);
    next = next.replace(/<\/?[a-z_][^>\n]*>/gi, '');

    const sentences = next
        .split(/(?<=[.!?。！？])\s+|\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => !REASONING_INTERNAL_PATTERNS.some((pattern) => pattern.test(item)));

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const sentence of sentences) {
        const key = sentence.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(sentence);
    }

    const result = deduped.join(' ').trim();
    if (result) return result;

    if (String(reasoning || '').trim()) {
        return 'Analyzing the request and checking what evidence can be gathered.';
    }
    return '';
}

function containsInternalJsonMarker(value: string): boolean {
    const normalized = String(value || '').toLowerCase();
    return INTERNAL_JSON_MARKERS.some((marker) => normalized.includes(marker));
}

function stripLeadingInternalScaffoldOnce(answer: string): string {
    let next = String(answer || '');

    next = next.replace(
        /^\s*```json\s*[\s\S]*?```\s*/i,
        (block) => containsInternalJsonMarker(block) ? '' : block,
    );

    next = next.replace(
        /^\s*json\s*\n\s*\{[\s\S]*?\}\s*/i,
        (block) => containsInternalJsonMarker(block) ? '' : block,
    );

    const trimmed = next.trimStart();
    const strippedLabeledBlock = stripLeadingInternalLabeledJsonBlock(trimmed);
    if (strippedLabeledBlock !== trimmed) {
        return strippedLabeledBlock;
    }

    return next;
}

function startsWithInternalLabeledJsonBlock(value: string): boolean {
    const match = String(value || '').match(/^\[([A-Z_]+)\]\s*\n/);
    return !!match && INTERNAL_LABELED_JSON_BLOCKS.has(match[1]);
}

function stripLeadingInternalLabeledJsonBlock(value: string): string {
    const match = String(value || '').match(/^\[([A-Z_]+)\]\s*\n/);
    if (!match || !INTERNAL_LABELED_JSON_BLOCKS.has(match[1])) {
        return value;
    }
    const remainder = value.slice(match[0].length).trimStart();
    const jsonValue = extractLeadingJsonValue(remainder);
    if (!jsonValue) return value;
    return remainder.slice(jsonValue.length).trimStart();
}

const STREAM_PSEUDO_BLOCKS: Array<{ openPattern: RegExp; closePattern: RegExp | null }> = [
    { openPattern: /<tool_calls?\b[^>]*>/i, closePattern: /<\/tool_calls?>/i },
    { openPattern: /<toolcall\b[^>]*>/i, closePattern: /<\/toolcall>/i },
    { openPattern: /<invoke\b[^>]*>/i, closePattern: /<\/invoke>/i },
    { openPattern: /<parameter\b[^>]*>/i, closePattern: /<\/parameter>/i },
    { openPattern: /<tool_name>/i, closePattern: /<\/tool_name>/i },
    { openPattern: /<function_call\b[^>]*>/i, closePattern: /<\/function_call>/i },
    { openPattern: /<argument\b[^>]*>/i, closePattern: /<\/argument>/i },
    { openPattern: /<ToolCall\b[^>]*>/i, closePattern: /<\/ToolCall>/i },
    { openPattern: /```json/i, closePattern: /```/i },
];

function findEarliestPseudoBlockStart(value: string): { index: number; closePattern: RegExp | null } | null {
    let earliest: { index: number; closePattern: RegExp | null } | null = null;

    for (const block of STREAM_PSEUDO_BLOCKS) {
        const match = block.openPattern.exec(value);
        if (!match || typeof match.index !== 'number') continue;
        if (!earliest || match.index < earliest.index) {
            earliest = { index: match.index, closePattern: block.closePattern };
        }
    }

    return earliest;
}

function emitSafeLines(value: string, flushAll: boolean): string {
    if (!value) return '';
    if (flushAll) {
        return stripPseudoToolCallOutput(value);
    }

    const lines = value.split(/(?<=\n)/);
    const safeLines = lines.map((line) => {
        const sanitized = stripPseudoToolCallOutput(line);
        if (!sanitized) return '';
        if (line.endsWith('\n') && !sanitized.endsWith('\n')) {
            return `${sanitized}\n`;
        }
        return sanitized;
    }).filter(Boolean);
    return safeLines.join('');
}

function extractLeadingJsonValue(value: string): string | null {
    const text = String(value || '');
    const opening = text[0];
    const closing = opening === '{' ? '}' : opening === '[' ? ']' : '';
    if (!closing) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === opening) depth += 1;
        if (char === closing) {
            depth -= 1;
            if (depth === 0) {
                return text.slice(0, i + 1);
            }
        }
    }

    return null;
}
