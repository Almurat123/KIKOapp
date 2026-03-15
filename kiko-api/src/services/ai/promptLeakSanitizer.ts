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

    next = next.replace(
        /^\s*```json\s*[\s\S]*?```\s*/i,
        (block) => containsInternalJsonMarker(block) ? '' : block,
    );

    next = next.replace(
        /^\s*json\s*\n\s*\{[\s\S]*?\}\s*/i,
        (block) => containsInternalJsonMarker(block) ? '' : block,
    );

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

function containsInternalJsonMarker(value: string): boolean {
    const normalized = String(value || '').toLowerCase();
    return INTERNAL_JSON_MARKERS.some((marker) => normalized.includes(marker));
}
