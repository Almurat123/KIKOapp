import fs from 'node:fs/promises';
import path from 'node:path';
import { PromptOrchestrator } from '../services/ai/PromptOrchestrator.js';
import type { IntentType, ModelType } from '../services/ai/types.js';

type Mode = 'execution' | 'thinking';

interface EvalCase {
    id: string;
    input: string;
    intent?: IntentType;
    rubric?: string;
    must_include?: string[];
    must_avoid?: string[];
}

interface Usage {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
}

interface ModelRunResult {
    output: string;
    usage?: Usage;
    raw?: any;
}

interface JudgeResult {
    score: number;
    verdict: 'pass' | 'borderline' | 'fail';
    issues: string[];
    strengths: string[];
    suggested_prompt_fix: string[];
    must_include_missed: string[];
    must_avoid_violations: string[];
}

interface ModeCaseReport {
    case_id: string;
    mode: Mode;
    intent: IntentType;
    user_input: string;
    system_prompt: string;
    assistant_output: string;
    judge: JudgeResult;
    usage?: Usage;
}

interface PromptAuditItem {
    severity: 'high' | 'medium' | 'low';
    title: string;
    why_it_hurts: string;
    fix: string;
}

interface PromptAuditResult {
    mode: Mode;
    summary: string;
    issues: PromptAuditItem[];
}

const VALID_INTENTS: IntentType[] = [
    'TRADING',
    'COPY_TRADING',
    'MARKET_ANALYSIS',
    'PREDICTION_MARKETS',
    'SOCIAL_SENSING',
    'RISK_SCAN',
    'GENERAL_CHAT',
];

function parseArgs(argv: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
            out[key] = 'true';
        } else {
            out[key] = next;
            i += 1;
        }
    }
    return out;
}

function asIntent(raw: string | undefined, fallback: IntentType): IntentType {
    if (!raw) return fallback;
    const upper = raw.toUpperCase() as IntentType;
    if (VALID_INTENTS.includes(upper)) return upper;
    return fallback;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function loadCases(casesPath: string, defaultIntent: IntentType): Promise<EvalCase[]> {
    const raw = await fs.readFile(casesPath, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
        const arr = JSON.parse(trimmed) as EvalCase[];
        return arr.map((item, idx) => ({
            id: item.id || `case_${String(idx + 1).padStart(3, '0')}`,
            input: item.input,
            intent: asIntent(item.intent, defaultIntent),
            rubric: item.rubric,
            must_include: item.must_include || [],
            must_avoid: item.must_avoid || [],
        }));
    }

    return trimmed
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, idx) => {
            const obj = JSON.parse(line) as EvalCase;
            return {
                id: obj.id || `case_${String(idx + 1).padStart(3, '0')}`,
                input: obj.input,
                intent: asIntent(obj.intent, defaultIntent),
                rubric: obj.rubric,
                must_include: obj.must_include || [],
                must_avoid: obj.must_avoid || [],
            };
        });
}

function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function safeJsonParse<T>(text: string): T | null {
    try {
        return JSON.parse(text) as T;
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]) as T;
        } catch {
            return null;
        }
    }
}

function extractResponseText(payload: any): string {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }
    const outputs = Array.isArray(payload?.output) ? payload.output : [];
    const chunks: string[] = [];
    for (const item of outputs) {
        const content = Array.isArray(item?.content) ? item.content : [];
        for (const c of content) {
            const maybeText = c?.text ?? c?.output_text ?? c?.value;
            if (typeof maybeText === 'string' && maybeText.trim()) {
                chunks.push(maybeText.trim());
            }
        }
    }
    return chunks.join('\n').trim();
}

async function callOpenAI(params: {
    apiKey: string;
    baseUrl: string;
    model: string;
    system: string;
    user: string;
    maxOutputTokens: number;
    reasoningEffort?: string;
}): Promise<ModelRunResult> {
    const body: Record<string, any> = {
        model: params.model,
        input: [
            {
                role: 'system',
                content: [{ type: 'input_text', text: params.system }],
            },
            {
                role: 'user',
                content: [{ type: 'input_text', text: params.user }],
            },
        ],
        max_output_tokens: params.maxOutputTokens,
    };

    if (params.reasoningEffort) {
        body.reasoning = { effort: params.reasoningEffort };
    }

    const resp = await fetch(`${params.baseUrl}/responses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OpenAI API error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    return {
        output: extractResponseText(data),
        usage: data?.usage,
        raw: data,
    };
}

function defaultJudgeResult(reason: string): JudgeResult {
    return {
        score: 0,
        verdict: 'fail',
        issues: [reason],
        strengths: [],
        suggested_prompt_fix: [],
        must_include_missed: [],
        must_avoid_violations: [],
    };
}

async function auditPrompt(params: {
    apiKey: string;
    baseUrl: string;
    auditModel: string;
    mode: Mode;
    systemPrompt: string;
    maxOutputTokens: number;
    reasoningEffort?: string;
}): Promise<PromptAuditResult> {
    const userPrompt = `
请你审计下面这段系统提示词是否存在“难以调试、约束冲突、过度宽泛、指令顺序冲突、遗漏边界条件”等问题。

模式: ${params.mode}
系统提示词:
<<<SYSTEM_PROMPT
${params.systemPrompt}
SYSTEM_PROMPT

输出严格 JSON，结构:
{
  "mode": "${params.mode}",
  "summary": "一句话总结",
  "issues": [
    {
      "severity": "high|medium|low",
      "title": "问题标题",
      "why_it_hurts": "为什么会导致错误或调试困难",
      "fix": "可执行的修改建议"
    }
  ]
}
只输出 JSON，不要额外文本。
`.trim();

    const audit = await callOpenAI({
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        model: params.auditModel,
        system: '你是资深 Prompt Engineer，擅长做可执行、可验证的提示词审计。',
        user: userPrompt,
        maxOutputTokens: params.maxOutputTokens,
        reasoningEffort: params.reasoningEffort,
    });

    const parsed = safeJsonParse<PromptAuditResult>(audit.output);
    if (!parsed || !Array.isArray(parsed.issues)) {
        return {
            mode: params.mode,
            summary: 'Prompt audit parse failed',
            issues: [
                {
                    severity: 'high',
                    title: '审计输出不可解析',
                    why_it_hurts: '无法自动消费审计结果',
                    fix: '将审计模型输出约束为严格 JSON',
                },
            ],
        };
    }
    return parsed;
}

async function judgeCase(params: {
    apiKey: string;
    baseUrl: string;
    judgeModel: string;
    mode: Mode;
    intent: IntentType;
    userInput: string;
    assistantOutput: string;
    rubric?: string;
    mustInclude?: string[];
    mustAvoid?: string[];
    maxOutputTokens: number;
    reasoningEffort?: string;
}): Promise<JudgeResult> {
    const mustInclude = params.mustInclude || [];
    const mustAvoid = params.mustAvoid || [];
    const evalPrompt = `
请评测以下回答质量（${params.mode} / ${params.intent}）并输出严格 JSON。

用户输入:
${params.userInput}

助手回答:
${params.assistantOutput}

额外标准:
${params.rubric || '无'}

must_include:
${JSON.stringify(mustInclude)}

must_avoid:
${JSON.stringify(mustAvoid)}

评分规则:
- score: 0-100
- verdict: pass|borderline|fail
- issues: 关键问题列表（字符串数组）
- strengths: 优点列表（字符串数组）
- suggested_prompt_fix: 针对提示词可改进项（字符串数组）
- must_include_missed: 未覆盖项（字符串数组）
- must_avoid_violations: 违规项（字符串数组）

只输出 JSON，不要额外文本。
`.trim();

    const judged = await callOpenAI({
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        model: params.judgeModel,
        system: '你是严格的一致性评测器，只输出可解析 JSON。',
        user: evalPrompt,
        maxOutputTokens: params.maxOutputTokens,
        reasoningEffort: params.reasoningEffort,
    });

    const parsed = safeJsonParse<JudgeResult>(judged.output);
    if (!parsed) return defaultJudgeResult('Judge JSON parse failed');

    if (typeof parsed.score !== 'number' || !Array.isArray(parsed.issues)) {
        return defaultJudgeResult('Judge schema invalid');
    }
    return parsed;
}

function buildMarkdownSummary(params: {
    runId: string;
    targetModel: string;
    judgeModel: string;
    auditModel: string;
    totalCases: number;
    reports: ModeCaseReport[];
    audits: PromptAuditResult[];
}): string {
    const byMode: Record<Mode, ModeCaseReport[]> = {
        execution: [],
        thinking: [],
    };
    for (const row of params.reports) byMode[row.mode].push(row);

    const modeSummary = (mode: Mode): string => {
        const list = byMode[mode];
        if (list.length === 0) return `- ${mode}: no data`;
        const avg = list.reduce((sum, x) => sum + x.judge.score, 0) / list.length;
        const pass = list.filter(x => x.judge.verdict === 'pass').length;
        const fail = list.filter(x => x.judge.verdict === 'fail').length;
        return `- ${mode}: avg=${avg.toFixed(1)}, pass=${pass}, fail=${fail}, cases=${list.length}`;
    };

    const topIssues = params.reports
        .flatMap(r => r.judge.issues.map(i => `${r.mode}/${r.case_id}: ${i}`))
        .slice(0, 10);

    const auditLines = params.audits.flatMap(audit =>
        (audit.issues || []).slice(0, 5).map(item => `- [${audit.mode}] (${item.severity}) ${item.title}: ${item.fix}`),
    );

    return [
        `# Prompt Mode Eval Report`,
        ``,
        `- run_id: ${params.runId}`,
        `- target_model: ${params.targetModel}`,
        `- judge_model: ${params.judgeModel}`,
        `- audit_model: ${params.auditModel}`,
        `- total_cases: ${params.totalCases}`,
        ``,
        `## Score Summary`,
        modeSummary('execution'),
        modeSummary('thinking'),
        ``,
        `## Prompt Audit Highlights`,
        ...(auditLines.length > 0 ? auditLines : ['- none']),
        ``,
        `## Top Case Issues`,
        ...(topIssues.length > 0 ? topIssues.map(i => `- ${i}`) : ['- none']),
        ``,
    ].join('\n');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help === 'true') {
        console.log(`
Usage:
  tsx src/scripts/promptModeEval.ts [options]

Options:
  --cases <path>                     JSON/JSONL cases
  --mode <both|execution|thinking>   default both
  --intent <IntentType>              default GENERAL_CHAT
  --target-model <model>             default gpt-5-mini
  --judge-model <model>              default gpt-5-mini
  --audit-model <model>              default gpt-5-mini
  --orchestrator-model-type <deepseek|grok> default deepseek
  --max-output-tokens <num>          default 1200
  --reasoning-effort <low|medium|high>
  --out-dir <path>                   default test
`);
        return;
    }

    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
        throw new Error('Missing OPENAI_API_KEY');
    }

    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const modeArg = (args.mode || 'both').toLowerCase();
    const modes: Mode[] =
        modeArg === 'execution' ? ['execution'] :
            modeArg === 'thinking' ? ['thinking'] : ['execution', 'thinking'];

    const defaultIntent = asIntent(args.intent, 'GENERAL_CHAT');
    const targetModel = args['target-model'] || 'gpt-5-mini';
    const judgeModel = args['judge-model'] || targetModel;
    const auditModel = args['audit-model'] || judgeModel;
    const orchestratorModelType = ((args['orchestrator-model-type'] || 'deepseek').toLowerCase() === 'grok' ? 'grok' : 'deepseek') as ModelType;
    const maxOutputTokens = Number(args['max-output-tokens'] || 1200);
    const reasoningEffort = args['reasoning-effort'];
    const outDir = args['out-dir'] || 'test';
    const casesPath = args.cases || 'src/evals/prompt_eval_cases.sample.jsonl';

    const absCasesPath = path.resolve(process.cwd(), casesPath);
    if (!(await fileExists(absCasesPath))) {
        throw new Error(`Cases file not found: ${absCasesPath}`);
    }
    const cases = await loadCases(absCasesPath, defaultIntent);
    if (cases.length === 0) {
        throw new Error(`No cases loaded from ${absCasesPath}`);
    }

    const orchestrator = new PromptOrchestrator();
    const sampleIntent = cases[0].intent || defaultIntent;
    const modeSystemPrompt = {
        execution: orchestrator.getSystemPrompt(orchestratorModelType, sampleIntent, { routingMode: 'execution' }),
        thinking: orchestrator.getSystemPrompt(orchestratorModelType, sampleIntent, { routingMode: 'thinking' }),
    };

    const audits: PromptAuditResult[] = [];
    for (const mode of modes) {
        const audit = await auditPrompt({
            apiKey,
            baseUrl,
            auditModel,
            mode,
            systemPrompt: modeSystemPrompt[mode],
            maxOutputTokens,
            reasoningEffort,
        });
        audits.push(audit);
    }

    const reports: ModeCaseReport[] = [];
    for (const testCase of cases) {
        const intent = testCase.intent || defaultIntent;
        for (const mode of modes) {
            const systemPrompt = orchestrator.getSystemPrompt(orchestratorModelType, intent, { routingMode: mode });
            const run = await callOpenAI({
                apiKey,
                baseUrl,
                model: targetModel,
                system: systemPrompt,
                user: testCase.input,
                maxOutputTokens,
                reasoningEffort,
            });
            const judged = await judgeCase({
                apiKey,
                baseUrl,
                judgeModel,
                mode,
                intent,
                userInput: testCase.input,
                assistantOutput: run.output,
                rubric: testCase.rubric,
                mustInclude: testCase.must_include,
                mustAvoid: testCase.must_avoid,
                maxOutputTokens,
                reasoningEffort,
            });

            reports.push({
                case_id: testCase.id,
                mode,
                intent,
                user_input: testCase.input,
                system_prompt: systemPrompt,
                assistant_output: run.output,
                judge: judged,
                usage: run.usage,
            });
        }
    }

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const runId = `prompt-mode-eval-${stamp}`;
    const absOutDir = path.resolve(process.cwd(), outDir);
    await fs.mkdir(absOutDir, { recursive: true });

    const jsonReportPath = path.join(absOutDir, `${runId}.json`);
    const mdReportPath = path.join(absOutDir, `${runId}.md`);

    const jsonPayload = {
        run_id: runId,
        generated_at: now.toISOString(),
        config: {
            modes,
            default_intent: defaultIntent,
            target_model: targetModel,
            judge_model: judgeModel,
            audit_model: auditModel,
            orchestrator_model_type: orchestratorModelType,
            cases_path: absCasesPath,
            max_output_tokens: maxOutputTokens,
            reasoning_effort: reasoningEffort || null,
        },
        audits,
        reports,
    };

    await fs.writeFile(jsonReportPath, JSON.stringify(jsonPayload, null, 2), 'utf8');
    const md = buildMarkdownSummary({
        runId,
        targetModel,
        judgeModel,
        auditModel,
        totalCases: cases.length,
        reports,
        audits,
    });
    await fs.writeFile(mdReportPath, md, 'utf8');

    const executionScores = reports.filter(r => r.mode === 'execution').map(r => r.judge.score);
    const thinkingScores = reports.filter(r => r.mode === 'thinking').map(r => r.judge.score);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    console.log(JSON.stringify({
        ok: true,
        run_id: runId,
        report_json: jsonReportPath,
        report_md: mdReportPath,
        avg_score_execution: Number(avg(executionScores).toFixed(2)),
        avg_score_thinking: Number(avg(thinkingScores).toFixed(2)),
        total_rows: reports.length,
    }, null, 2));
}

main().catch((err) => {
    console.error(`[promptModeEval] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
