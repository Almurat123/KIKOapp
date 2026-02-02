import type { SuggestionGroup, SuggestionItem } from './ChatInputSuggestions';
import { ParamMemory } from './CommandRegistry';
import { COMMAND_CONFIGS, CATEGORY_ORDER, CATEGORY_LABELS, type CommandCategory } from './CommandConfig';
import { UsageTracker } from './UsageTracker';
import { getContextualBoost, type SuggestionContext } from './SuggestionContext';
import Fuse from 'fuse.js';

// --- State Definitions ---
type SuggestionStage =
    | 'IDLE'
    | 'COMMAND_MATCH'    // "sw" -> "Swap"
    | 'ARGS_AMOUNT'      // "Swap " -> "Swap 0.01 ETH to [Paste]"
    | 'ARGS_TARGET'      // "Swap ... to " -> "Swap ... to [Paste]"
    | 'ARGS_CHAIN'       // "Swap ... 0x..." -> "... at Base"
    | 'ARGS_COPY_TARGET' // "Copy Trade " -> "Copy Trade [Paste Address]"
    | 'ARGS_COPY_AMOUNT' // "Copy Trade 0x..." -> "with 0.1 ETH per trade"
    | 'ARGS_COPY_CONFIG' // "with 0.1..." -> "Auto Sell: ON, TP/SL..."
    | 'ARGS_CHECK_TARGET' // "Check " -> "Check [Paste Address]"
    | 'ARGS_CHECK_OPTION' // "Check 0x..." -> "PNL 7D / Risk / ..."
    | 'ARGS_WHAT_OPTION' // "What's ..." -> "What's trending token", "What's [Paste Address] PNL"
    | 'ARGS_CANCEL_TARGET' // "Cancel " -> "Cancel my polymarket order"
    | 'ARGS_TELL_OPTION' // "Tell me ..." -> "Tell me about Farcaster trending"
    | 'ARGS_BET_LINK' // "Bet " -> "Bet [Paste Polymarket Link]"
    | 'ARGS_BET_SIDE' // "Bet https://..." -> "YES / NO"
    | 'ARGS_BET_AMOUNT' // "Bet ... YES" -> "With 1 USDC"
    | 'ADDRESS_DETECTED' // "0x..." -> "Buy / Swap / Copy / Check"
    | 'COMPLETE';

interface MatchResult {
    id: string;
    label: string;
    actionText: string;
    displayText?: string; // For special UI hints like "[Paste Address]"
    score: number;
    type: 'command' | 'progressive' | 'history';
    suffix?: string; // e.g. " to ETH"
    category?: CommandCategory; // For grouping
}

// Supported native and stable tokens for suggestions
const NATIVE_TOKENS = ['ETH', 'USDC', 'USDT', 'BNB', 'SOL'];
const POPULAR_TOKENS = ['USDC', 'ETH', 'SOL', 'USDT', 'BNB'];

// Fuse.js instance for fuzzy command matching
const commandFuse = new Fuse(COMMAND_CONFIGS, {
    keys: ['label', 'triggers'],
    threshold: 0.3,  // 0 = exact, 1 = match anything
    includeScore: true
});

export class SuggestionEngine {
    public static getSuggestions(
        text: string,
        onCommit: (text: string) => void,
        context?: SuggestionContext  // Optional context for smart boosting
    ): SuggestionGroup[] {
        const trimmedText = text.trim();

        if (!text || trimmedText.length === 0) {
            if (context?.mode === 'focus') {
                // For focus mode with empty text, we show top/recent commands
                return this.getTopSuggestions(onCommit, context);
            }
            return [];
        }

        // Check if input exactly matches a complete command option
        // If so, don't show suggestions (user has already selected a complete command)
        const isCompleteOption = COMMAND_CONFIGS.some(cmd =>
            cmd.options?.some(option => option.label.toLowerCase() === trimmedText.toLowerCase())
        );

        if (isCompleteOption) {
            return [];
        }

        const stage = this.detectStage(text);

        // If command is complete (all stages satisfied), hide suggestions
        if (stage === 'COMPLETE') {
            console.log('[SuggestionEngine] Command is complete, hiding suggestions');
            return [];
        }

        // Find active command to check for stage configs
        const activeCommand = COMMAND_CONFIGS.find(cmd =>
            cmd.triggers.some(trigger => {
                const triggerLower = trigger.toLowerCase();
                return text.toLowerCase().startsWith(triggerLower + ' ') || text.toLowerCase().startsWith(triggerLower + '\n');
            })
        );

        const matches: MatchResult[] = [];

        // Check if we have a config-driven stage for this command
        if (activeCommand?.stageConfigs?.[stage]) {
            const config = activeCommand.stageConfigs[stage];
            console.log('[SuggestionEngine] Using config-driven stage:', stage);

            if (config.suggestions === 'getAmountSuggestions') {
                matches.push(...this.getAmountSuggestions(text, context));
            } else if (config.suggestions === 'getTargetSuggestions') {
                matches.push(...this.getPastePrompt(text));
            } else if (config.suggestions === 'getCopyTargetSuggestions') {
                matches.push(...this.getCopyTargetSuggestions(text));
            } else if (config.suggestions === 'getCopyAmountSuggestions') {
                matches.push(...this.getCopyAmountSuggestions(text));
            } else if (config.suggestions === 'getCopyConfigSuggestions') {
                matches.push(...this.getCopyConfigSuggestions(text));
            } else {
                // Fallback or generic rendering logic (can be expanded)
                matches.push({
                    id: `generic-${stage}`,
                    label: config.labelTemplate.replace('{text}', text),
                    actionText: config.actionTextTemplate.replace('{text}', text),
                    displayText: config.displayText,
                    score: 1000,
                    type: 'progressive'
                });
            }
        } else {
            // --- Fallback to hardcoded logic for other stages ---
            switch (stage) {
                case 'COMMAND_MATCH':
                    matches.push(...this.getCommandMatches(text, context));
                    break;

                case 'ARGS_AMOUNT':
                    matches.push(...this.getAmountSuggestions(text, context));
                    break;

                case 'ARGS_TARGET':
                    matches.push(...this.getPastePrompt(text));
                    break;

                case 'ARGS_CHAIN':
                    matches.push(...this.getChainSuggestions(text));
                    break;

                case 'ARGS_COPY_TARGET':
                    matches.push(...this.getCopyTargetSuggestions(text));
                    break;

                case 'ARGS_COPY_AMOUNT':
                    matches.push(...this.getCopyAmountSuggestions(text));
                    break;

                case 'ARGS_COPY_CONFIG':
                    matches.push(...this.getCopyConfigSuggestions(text));
                    break;

                case 'ARGS_CHECK_TARGET':
                    matches.push(...this.getCheckTargetSuggestions(text));
                    break;

                case 'ARGS_CHECK_OPTION':
                    matches.push(...this.getCheckOptionSuggestions(text));
                    break;

                case 'ARGS_WHAT_OPTION':
                    matches.push(...this.getWhatSuggestions(text));
                    break;

                case 'ARGS_CANCEL_TARGET':
                    matches.push(...this.getCancelTargetSuggestions(text));
                    break;

                case 'ARGS_TELL_OPTION':
                    matches.push(...this.getTellSuggestions(text));
                    break;

                case 'ARGS_BET_LINK':
                    matches.push(...this.getBetLinkSuggestions(text));
                    break;

                case 'ARGS_BET_SIDE':
                    matches.push(...this.getBetSideSuggestions(text));
                    break;

                case 'ARGS_BET_AMOUNT':
                    matches.push(...this.getBetAmountSuggestions(text));
                    break;

                case 'ADDRESS_DETECTED':
                    matches.push(...this.getAddressSuggestions(text));
                    break;
            }
        }

        // Sort & Build
        // Sort by score (higher first), then apply usage boost, and limit to 5
        const sortedMatches = [...matches].sort((a, b) => {
            // Get usage boosts for command-based suggestions
            const aBoost = a.id.startsWith('cmd-') ? UsageTracker.getScoreBoost(a.id.replace('cmd-', '')) + UsageTracker.getRecencyBoost(a.id.replace('cmd-', '')) : 0;
            const bBoost = b.id.startsWith('cmd-') ? UsageTracker.getScoreBoost(b.id.replace('cmd-', '')) + UsageTracker.getRecencyBoost(b.id.replace('cmd-', '')) : 0;
            return (b.score + bBoost) - (a.score + aBoost);
        });
        const finalMatches = sortedMatches.slice(0, 5);

        // Phase 5: Group by category for COMMAND_MATCH stage
        if (stage === 'COMMAND_MATCH' && finalMatches.some(m => m.category)) {
            const groups: SuggestionGroup[] = [];

            for (const category of CATEGORY_ORDER) {
                const categoryMatches = finalMatches.filter(m => m.category === category);
                if (categoryMatches.length > 0) {
                    groups.push({
                        label: CATEGORY_LABELS[category],
                        items: categoryMatches.map(m => this.buildItem(m, onCommit))
                    });
                }
            }

            console.log('[SuggestionEngine] Generated grouped suggestions:', groups.length, 'groups');
            return groups;
        }

        // Default: flat list
        const items = finalMatches.map(m => this.buildItem(m, onCommit));

        console.log('[SuggestionEngine] Generated', items.length, 'suggestions');

        return items.length > 0 ? [{ label: 'SUGGESTIONS', items }] : [];
    }

    // --- State Machine Logic ---

    private static detectStage(text: string): SuggestionStage {
        const lower = text.toLowerCase();

        // Special case for ambiguous "c" or "c " -> COMMAND_MATCH
        if (text === 'c' || text === 'c ' || text === 'C' || text === 'C ') {
            return 'COMMAND_MATCH';
        }

        // 1. Check if input matches ANY command trigger from CommandConfig
        const matchesAnyCommand = COMMAND_CONFIGS.some(cmd =>
            cmd.triggers.some(trigger =>
                lower.startsWith(trigger) || trigger.startsWith(lower)
            )
        );

        if (!matchesAnyCommand) {
            // Check if input is a raw address
            if (this.hasAddress(lower)) {
                return 'ADDRESS_DETECTED';
            }
            return 'IDLE';
        }

        // 2. Find exact command match for stage detection
        const matchingCommands = COMMAND_CONFIGS.filter(cmd =>
            cmd.triggers.some(trigger => {
                const triggerLower = trigger.toLowerCase();
                return lower === triggerLower || triggerLower.startsWith(lower);
            })
        );

        const exactMatchWithSpace = COMMAND_CONFIGS.find(cmd =>
            cmd.triggers.some(trigger => {
                const triggerLower = trigger.toLowerCase();
                return lower.startsWith(triggerLower + ' ') || lower.startsWith(triggerLower + '\n');
            })
        );

        // If there's an exact match followed by space/newline, that's our command
        let exactCommand = exactMatchWithSpace;

        // If no space but exactly matches one trigger AND it's not ambiguous
        if (!exactCommand && matchingCommands.length === 1) {
            const cmd = matchingCommands[0];
            if (cmd.triggers.some(t => t.toLowerCase() === lower)) {
                exactCommand = cmd;
            }
        }

        if (!exactCommand) {
            // Partial match or ambiguous (e.g., "b" matches "bet" and "buy")
            return 'COMMAND_MATCH';
        }

        // 3. Handle progressive commands (Swap, Sell, Buy, Copy, Bet, etc.)
        if (exactCommand.stages && exactCommand.stages.length > 0) {
            // Find the first stage that isn't satisfied yet
            for (const stageId of exactCommand.stages) {
                if (!this.isStageSatisfied(stageId as SuggestionStage, lower)) {
                    return stageId as SuggestionStage;
                }
            }
            // All stages satisfied?
            return 'COMPLETE';
        }

        // 4. Handle commands with options (What, Tell, Check, Cancel, etc.)
        if (exactCommand.options && exactCommand.options.length > 0) {
            // Map command IDs to their option stages
            const optionStageMap: Record<string, SuggestionStage> = {
                'what': 'ARGS_WHAT_OPTION',
                'tell': 'ARGS_TELL_OPTION',
                'check': 'ARGS_CHECK_OPTION',
                'cancel': 'ARGS_CANCEL_TARGET',
                'show': 'COMMAND_MATCH',  // Show has options but displays immediately
                'my': 'COMMAND_MATCH',    // My has options but displays immediately
                'how_much': 'COMMAND_MATCH',
                'analyze': 'COMMAND_MATCH',
                'price': 'COMMAND_MATCH',
                'gas': 'COMMAND_MATCH',
                'zora': 'COMMAND_MATCH',
                'trending': 'COMMAND_MATCH',
                'search': 'COMMAND_MATCH',
                'find': 'COMMAND_MATCH',
                'help': 'COMMAND_MATCH',
                'hi': 'COMMAND_MATCH'
            };

            return optionStageMap[exactCommand.id] || 'COMMAND_MATCH';
        }


        // Default fallthrough
        return 'COMMAND_MATCH';
    }

    /**
     * Get top suggestions when input is empty (e.g. on focus)
     */
    private static getTopSuggestions(onCommit: (text: string) => void, context?: SuggestionContext): SuggestionGroup[] {
        // Find most frequent/recent commands
        const topCommands = COMMAND_CONFIGS
            .map(cmd => {
                let score = cmd.score;
                score += UsageTracker.getScoreBoost(cmd.id);
                score += UsageTracker.getRecencyBoost(cmd.id);
                if (context) {
                    score += getContextualBoost(cmd.id, context);
                }
                return { cmd, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const items = topCommands.map(result => this.buildItem({
            id: `cmd-${result.cmd.id}`,
            label: result.cmd.label,
            actionText: result.cmd.actionText,
            score: result.score,
            type: 'command',
            category: result.cmd.category
        }, onCommit));

        return items.length > 0 ? [{ label: 'TOP COMMANDS', items }] : [];
    }

    // --- Suggestion Generators ---

    private static getCommandMatches(input: string, context?: SuggestionContext): MatchResult[] {
        const lower = input.toLowerCase().trim();
        if (!lower) return [];

        // Use Fuse.js for fuzzy matching
        const fuseResults = commandFuse.search(lower);

        // Also do prefix matching on triggers for better UX
        const prefixMatches = COMMAND_CONFIGS.filter(cmd =>
            cmd.triggers.some(t => t.startsWith(lower) || lower.startsWith(t))
        );

        // Combine and deduplicate
        const matchedIds = new Set<string>();
        const results: MatchResult[] = [];

        // Add prefix matches first (higher priority)
        for (const cmd of prefixMatches) {
            if (matchedIds.has(cmd.id)) continue;
            matchedIds.add(cmd.id);

            // Calculate final score with boosts
            let finalScore = cmd.score;
            finalScore += UsageTracker.getScoreBoost(cmd.id);
            finalScore += UsageTracker.getRecencyBoost(cmd.id);
            if (context) {
                finalScore += getContextualBoost(cmd.id, context);
            }

            // If command has options, only show the options (not the command itself)
            if (cmd.options && cmd.options.length > 0) {
                for (const option of cmd.options) {
                    // Build full action text from command actionText + option actionSuffix
                    const fullActionText = cmd.actionText + option.actionSuffix;

                    // Calculate option score (use command's full score for better ranking)
                    const optionScore = finalScore;

                    results.push({
                        id: option.id,
                        label: option.label,
                        actionText: fullActionText,
                        displayText: option.label,
                        score: optionScore,
                        type: 'command',
                        category: cmd.category,
                        suffix: option.requiresAddress || option.requiresLink ? ' ' : undefined
                    });
                }
            } else {
                // No options: show the command itself (for progressive commands like Swap, Buy, Sell)
                results.push({
                    id: `cmd-${cmd.id}`,
                    label: cmd.label,
                    actionText: cmd.actionText,
                    score: finalScore,
                    type: 'command',
                    category: cmd.category
                });
            }
        }

        // Add fuzzy matches (lower priority)
        for (const result of fuseResults) {
            const cmd = result.item;
            if (matchedIds.has(cmd.id)) continue;
            matchedIds.add(cmd.id);

            // Fuzzy matches get lower base score
            let finalScore = cmd.score * 0.8;
            finalScore += UsageTracker.getScoreBoost(cmd.id);
            if (context) {
                finalScore += getContextualBoost(cmd.id, context);
            }

            // If command has options, only show the options (not the command itself)
            if (cmd.options && cmd.options.length > 0) {
                for (const option of cmd.options) {
                    const fullActionText = cmd.actionText + option.actionSuffix;
                    const optionScore = finalScore;

                    results.push({
                        id: option.id,
                        label: option.label,
                        actionText: fullActionText,
                        displayText: option.label,
                        score: optionScore,
                        type: 'command',
                        category: cmd.category,
                        suffix: option.requiresAddress || option.requiresLink ? ' ' : undefined
                    });
                }
            } else {
                // No options: show the command itself
                results.push({
                    id: `cmd-${cmd.id}`,
                    label: cmd.label,
                    actionText: cmd.actionText,
                    score: finalScore,
                    type: 'command',
                    category: cmd.category
                });
            }
        }

        return results.sort((a, b) => b.score - a.score);
    }

    private static getAmountSuggestions(currentText: string, context?: SuggestionContext): MatchResult[] {
        const { amount: defaultAmount } = this.getUserDefaultSettings(); // Fixed: removed unused token
        const baseAmount = defaultAmount;

        // --- Static Native Token Defaults ---
        // Use context if available and it's a recognized native/stable token, otherwise default to ETH
        const contextToken = context?.tokenSymbol?.toUpperCase();
        const baseToken = (contextToken && NATIVE_TOKENS.includes(contextToken)) ? contextToken : 'ETH';

        // Detect Verb: Swap / Sell / Buy
        const lower = currentText.toLowerCase().trim();
        let verb = 'Swap';
        if (lower.startsWith('sell')) verb = 'Sell';
        else if (lower.startsWith('buy')) verb = 'Buy';
        else if (lower.startsWith('sw')) verb = 'Swap';

        const suggestions: MatchResult[] = [];

        // --- LOGIC FOR SELL ---
        if (verb === 'Sell') {
            const pctOptions = ['25%', '50%', '75%', 'All'];
            // Target is a native/stable token (use context if valid, else ETH)
            const targetToken = baseToken;

            pctOptions.forEach((pct, idx) => {
                // Check if this pct is already in the text
                if (!lower.includes(pct.toLowerCase())) {
                    suggestions.push({
                        id: `sell-${pct}`,
                        label: `Sell ${pct} [Paste Contract Address] to ${targetToken}`,
                        actionText: `Sell ${pct} `,
                        displayText: `Sell ${pct} [Paste Contract Address] to ${targetToken}`,
                        score: 1000 - (idx * 10),
                        type: 'progressive',
                        suffix: ` to ${targetToken}`
                    });
                }
            });
            if (suggestions.length > 0) return suggestions;
        }

        // --- LOGIC FOR BUY ---
        if (verb === 'Buy') {
            const buyAmounts = ['0.1', '0.5', '1', '5'];
            buyAmounts.forEach((amt, idx) => {
                if (!lower.includes(` ${amt} `) && !lower.endsWith(` ${amt}`)) {
                    suggestions.push({
                        id: `buy-${amt}`,
                        label: `Buy ${amt} ${baseToken} of [Paste Contract Address]`,
                        actionText: `Buy ${amt} ${baseToken} of `,
                        displayText: `Buy ${amt} ${baseToken} of [Paste Contract Address]`,
                        score: 1000 - (idx * 10),
                        type: 'progressive'
                    });
                }
            });
            if (suggestions.length > 0) return suggestions;
        }

        // --- LOGIC FOR SWAP / BUY ---

        // 1. Memory/Default
        const fallbackText = verb === 'Buy' ? `${verb} ${baseAmount} ${baseToken} of [Paste Contract Address]` : `${verb} ${baseAmount} ${baseToken} to [Paste Contract Address]`;
        const fallbackAction = verb === 'Buy' ? `${verb} ${baseAmount} ${baseToken} of ` : `${verb} ${baseAmount} ${baseToken} to `;

        suggestions.push({
            id: 'amt-default',
            label: fallbackText,
            actionText: fallbackAction,
            displayText: fallbackText,
            score: 1000,
            type: 'progressive'
        });

        // 2. Variants based on detected chain/token
        const amtMatch = currentText.match(new RegExp(`${verb}\\s+(\\d+(?:\\.\\d+)?)`, 'i'));
        if (amtMatch) {
            const typedAmount = amtMatch[1];
            const typedText = verb === 'Buy' ? `${verb} ${typedAmount} ${baseToken} of [Paste Contract Address]` : `${verb} ${typedAmount} ${baseToken} to [Paste Contract Address]`;
            const typedAction = verb === 'Buy' ? `${verb} ${typedAmount} ${baseToken} of ` : `${verb} ${typedAmount} ${baseToken} to `;

            suggestions.push({
                id: 'amt-typed',
                label: typedText,
                actionText: typedAction,
                score: 1100,
                type: 'progressive'
            });
        }

        return suggestions;
    }

    private static getPastePrompt(text: string): MatchResult[] {
        const results: MatchResult[] = [];
        results.push({
            id: 'paste-prompt',
            label: `${text} [Paste Contract Address]`,
            actionText: text,
            displayText: `[Paste Contract Address]`,
            score: 1000,
            type: 'progressive'
        });

        // Add popular tokens
        POPULAR_TOKENS.forEach(t => {
            results.push({
                id: `target-${t}`,
                label: `${text}${t}`,
                actionText: `${text}${t}`,
                score: 800,
                type: 'progressive'
            });
        });

        return results;
    }

    private static getChainSuggestions(text: string): MatchResult[] {
        // text: "Swap ... to 0x123..."
        // Predict chain based on TokenIn
        const lower = text.toLowerCase();
        const results: MatchResult[] = [];

        // Simple heuristic: ETH/USDC/USDT -> L2s. SOL -> Solana.
        // We need to look back at the string.
        let chains: string[] = [];

        if (lower.includes(' sol ') || lower.includes('solana')) {
            chains = ['Solana'];
        } else if (lower.includes(' bnb ') || lower.includes(' bsc ')) {
            chains = ['BSC'];
        } else {
            // Default ETH-like
            chains = ['Base', 'Ethereum', 'Arbitrum', 'Optimism'];
        }

        chains.forEach(chain => {
            const suffix = ` at ${chain}`;
            results.push({
                id: `chain-${chain}`,
                label: `${text}${suffix}`,
                actionText: `${text}${suffix}`,
                score: 900,
                type: 'progressive'
            });
        });

        return results;
    }

    // --- Copy Trade Generators ---

    private static getCopyTargetSuggestions(_text?: string): MatchResult[] {
        // text: "Copy Trade "
        const results: MatchResult[] = [];

        results.push({
            id: 'copy-target-paste',
            label: 'Copy Trade [Paste Wallet Address]',
            actionText: 'Copy Trade ',
            displayText: 'Copy Trade [Paste Wallet Address]',
            score: 1000,
            type: 'progressive'
        });

        return results;
    }

    private static getCopyAmountSuggestions(text: string): MatchResult[] {
        // text: "Copy Trade 0x..."
        const trimmed = text.trim();
        const { amount: defaultAmount } = this.getUserDefaultSettings();

        const results: MatchResult[] = [];
        const amounts = [defaultAmount, '0.5', '1', '5'];

        // Ensure unique
        const uniqueAmounts = Array.from(new Set(amounts));

        uniqueAmounts.forEach((amt, idx) => {
            const suffix = ` with ${amt} ETH per trade`;
            results.push({
                id: `copy-amt-${idx}`,
                label: `${trimmed}${suffix}`,
                actionText: `${trimmed}${suffix}`,
                score: 1000 - (idx * 10),
                type: 'progressive'
            });
        });

        return results;
    }

    private static getCopyConfigSuggestions(text: string): MatchResult[] {
        // text: "... with 0.1 ETH per trade"
        // Suggest Auto Sell / TP / SL
        const results: MatchResult[] = [];

        // Option 1: Auto Sell Default
        results.push({
            id: 'copy-conf-auto',
            label: 'Auto Sell: YES',
            displayText: 'Auto Sell: YES',
            actionText: `${text}, Auto Sell: YES`,
            score: 1000,
            type: 'progressive'
        });

        // Option 2: Manual Sell
        results.push({
            id: 'copy-conf-manual',
            label: 'Auto Sell: NO (Manual)',
            displayText: 'Auto Sell: NO (Manual)',
            actionText: `${text}, Auto Sell: NO`,
            score: 950,
            type: 'progressive'
        });

        // Option 3: Add TP/SL
        results.push({
            id: 'copy-conf-tpsl',
            label: 'Set TP: 50%, SL: 20%',
            displayText: 'Set TP: 50%, SL: 20%',
            actionText: `${text}, TP: 50%, SL: 20%`, // Example default
            score: 900,
            type: 'progressive'
        });

        return results;
    }

    // --- What Command Generators ---

    private static getWhatSuggestions(_text?: string): MatchResult[] {
        // text could be "What's " or "What's trend"
        const results: MatchResult[] = [];

        // STATIC OPTIONS
        const staticOpts = [
            'the trending bet',
            'the trending token',
            'the trending farcaster cast', // Corrected spelling
            'trending news',
            'Zora trending token',
            'Next Economic Calendar',
            'Market Overview'
        ];

        staticOpts.forEach((opt, idx) => {
            const label = `What's ${opt}`;
            results.push({
                id: `what-static-${idx}`,
                label: label,
                displayText: label,
                actionText: label,
                score: 1000 - (idx * 10),
                type: 'progressive'
            });
        });

        // ADDRESS BASED OPTIONS
        // Suggest "What's [Paste Address] PNL"
        const addrOpts = ['PNL', 'early buyer', 'risk', 'balance'];
        addrOpts.forEach((opt, idx) => {
            results.push({
                id: `what-addr-${idx}`,
                label: `What's [Paste Address] ${opt}`, // Triggers paste logic
                displayText: `What's [Paste Address] ${opt}`,
                actionText: `What's `,
                suffix: ` ${opt}`, // Metadata for buildItem
                score: 900 - (idx * 10),
                type: 'progressive'
            });
        });

        // CHAIN BASED OPTIONS
        // "What's the [Chain] gas price"
        const chains = ['Ethereum', 'Base', 'Solana', 'Arbitrum', 'Optimism', 'BSC'];
        chains.forEach((chain, idx) => {
            const label = `What's the ${chain} gas price`;
            results.push({
                id: `what-chain-${idx}`,
                label: label,
                displayText: label,
                actionText: label,
                score: 800 - (idx * 10),
                type: 'progressive'
            });
        });

        return results;
    }

    // --- Check Command Generators ---

    private static getCheckTargetSuggestions(_text?: string): MatchResult[] {
        // text: "Check "
        const results: MatchResult[] = [];

        results.push({
            id: 'check-target-paste',
            label: 'Check [Paste Wallet Address]',
            actionText: 'Check ',
            displayText: 'Check [Paste Wallet Address]',
            score: 1000,
            type: 'progressive'
        });

        // Add Polymarket Option
        results.push({
            id: 'check-polymarket',
            label: 'Check my polymarket order position',
            actionText: 'Check my polymarket order position',
            displayText: 'Check my polymarket order position',
            score: 950,
            type: 'progressive'
        });

        return results;
    }

    private static getCheckOptionSuggestions(text: string): MatchResult[] {
        // text: "Check 0x..."
        const results: MatchResult[] = [];
        const options = ['PNL 7D', 'PNL 30D', 'Risk', 'Balance', 'Launchpad', 'Information'];

        options.forEach((opt, idx) => {
            results.push({
                id: `check-opt-${idx}`,
                label: `${text} ${opt}`,
                displayText: opt, // Concise display
                actionText: `${text} ${opt}`,
                score: 1000 - (idx * 10),
                type: 'progressive'
            });
        });

        return results;
    }

    // --- Cancel Command Generators ---

    private static getCancelTargetSuggestions(_text?: string): MatchResult[] {
        const results: MatchResult[] = [];

        results.push({
            id: 'cancel-poly',
            label: 'Cancel my polymarket order',
            actionText: 'Cancel my polymarket order', // Auto-submit?
            displayText: 'Cancel my polymarket order',
            score: 1000,
            type: 'progressive'
        });

        return results;
    }

    // --- Tell Command Generators ---

    private static getTellSuggestions(_text?: string): MatchResult[] {
        const results: MatchResult[] = [];

        const options = [
            'about Farcaster trending topic',
            'what\'s guys talking about now',
            'Vitalik recently cast'
        ];

        options.forEach((opt, idx) => {
            const label = `Tell me ${opt}`;
            results.push({
                id: `tell-opt-${idx}`,
                label: label,
                displayText: label,
                actionText: label,
                score: 1000 - (idx * 10),
                type: 'progressive'
            });
        });

        return results;
    }

    // --- Bet Command Generators ---

    private static getBetLinkSuggestions(_text?: string): MatchResult[] {
        const results: MatchResult[] = [];

        results.push({
            id: 'bet-link-paste',
            label: 'Bet [Paste Polymarket Link]',
            actionText: 'Bet ',
            displayText: 'Bet [Paste Polymarket Link]',
            score: 1000,
            type: 'progressive'
        });

        return results;
    }

    private static getBetSideSuggestions(text: string): MatchResult[] {
        // text: "Bet https://polymarket.com/..."
        const results: MatchResult[] = [];

        results.push({
            id: 'bet-side-yes',
            label: 'YES',
            displayText: 'YES',
            actionText: `${text} YES`,
            score: 1000,
            type: 'progressive'
        });

        results.push({
            id: 'bet-side-no',
            label: 'NO',
            displayText: 'NO',
            actionText: `${text} NO`,
            score: 950,
            type: 'progressive'
        });

        return results;
    }

    private static getBetAmountSuggestions(text: string): MatchResult[] {
        // text: "Bet https://... YES"
        const results: MatchResult[] = [];
        const amounts = ['1', '5', '10', '25', '50'];

        amounts.forEach((amt, idx) => {
            results.push({
                id: `bet-amt-${idx}`,
                label: `With ${amt} USDC`,
                displayText: `With ${amt} USDC`,
                actionText: `${text} with ${amt} USDC`,
                score: 1000 - (idx * 10),
                type: 'progressive'
            });
        });

        return results;
    }

    // --- Helpers for Defaults ---

    private static getUserDefaultSettings() {
        // Load defaults
        const memory = ParamMemory.loadAll();

        // Priority: Settings > Memory > System Default ('0.1')
        let amount = memory.amount || '0.1';
        let token = 'ETH';

        // 1. Try User Settings (Override)
        try {
            const savedSettings = localStorage.getItem('kiko-custom-ai-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                if (parsed.defaultSwapAmount) {
                    amount = parsed.defaultSwapAmount.toString();
                }
                if (parsed.defaultSwapUnit && parsed.defaultSwapUnit !== 'native') {
                    token = parsed.defaultSwapUnit.toUpperCase();
                }
            }
        } catch (_e) { /* ignore */ }

        // 2. Fallback to Memory (if settings didn't explicitly override, or maybe we want memory to take precedence?)
        // Actually user explicit settings should take precedence over automatic memory.
        // But if settings are missing (default), memory is good.
        // For now, let's say settings > memory if settings exists.

        // However, if we just rely on the above logic: 
        // If user NEVER set settings, `parsed.defaultSwapAmount` might be missing/default.
        // Let's stick to the logic: Settings (if set) > Memory > '0.1'.

        return { amount, token };
    }

    // --- Address Action Generators ---

    private static getAddressSuggestions(text: string): MatchResult[] {
        // text is the raw address, e.g. "0x123..."
        const cleanAddr = text.trim();
        const results: MatchResult[] = [];

        // Load defaults
        // Load defaults
        const { amount: defaultAmt, token: defaultToken } = this.getUserDefaultSettings();
        const defaultBuyAmt = defaultAmt;

        // 1. Swap To
        results.push({
            id: 'addr-swap',
            label: `Swap ${defaultAmt} ${defaultToken} to [Address]`,
            displayText: `Swap ${defaultAmt} ${defaultToken} to [Address]`,
            actionText: `Swap ${defaultAmt} ${defaultToken} to ${cleanAddr}`,
            score: 1000,
            type: 'progressive'
        });

        // 2. Buy
        results.push({
            id: 'addr-buy',
            label: `Buy ${defaultBuyAmt} ${defaultToken} of [Address]`,
            displayText: `Buy ${defaultBuyAmt} ${defaultToken} of [Address]`,
            actionText: `Buy ${defaultBuyAmt} ${defaultToken} of ${cleanAddr}`,
            score: 950,
            type: 'progressive'
        });

        // 3. Copy Trade
        results.push({
            id: 'addr-copy',
            label: 'Copy Trade [Address]',
            displayText: 'Copy Trade [Address]',
            actionText: `Copy Trade ${cleanAddr}`,
            score: 900,
            type: 'progressive'
        });

        // 4. Check
        results.push({
            id: 'addr-check',
            label: 'Check [Address]',
            displayText: 'Check [Address]',
            actionText: `Check ${cleanAddr}`,
            score: 850,
            type: 'progressive'
        });

        // 5. What's PNL
        results.push({
            id: 'addr-what',
            label: "What's [Address] PNL",
            displayText: "What's [Address] PNL",
            actionText: `What's ${cleanAddr} PNL`,
            score: 800,
            type: 'progressive'
        });

        return results;
    }

    // --- Helpers ---

    private static isStageSatisfied(stage: SuggestionStage, text: string): boolean {
        const lower = text.toLowerCase();

        switch (stage) {
            case 'ARGS_AMOUNT':
                // Matches digits that aren't part of a hex address (simple heuristic)
                // Use a word boundary and ensure it's not followed by 'x'
                return /\b\d+(\.\d+)?\b/.test(lower.replace(/0x[a-fA-F0-9]+/g, ' '));

            case 'ARGS_TARGET':
            case 'ARGS_COPY_TARGET':
            case 'ARGS_CHECK_TARGET':
                // Matches exact address pattern
                return this.hasAddress(lower);

            case 'ARGS_COPY_AMOUNT':
                // Matches "with 0.1 eth"
                return lower.includes('with ') && /\d+(\.\d+)?/.test(lower);

            case 'ARGS_COPY_CONFIG': {
                // Persistence: Only satisfied if it has BOTH Auto Sell and some form of TP/SL
                const hasAutoSell = lower.includes('auto sell');
                const hasTPSL = lower.includes('tp:') || lower.includes('sl:');
                return hasAutoSell && hasTPSL;
            }

            case 'ARGS_CHAIN':
                // Matches "at base", "on solana", etc.
                return lower.includes(' at ') || lower.includes(' on ');

            case 'ARGS_BET_LINK':
                return lower.includes('polymarket.com/event/') || this.hasAddress(lower);

            case 'ARGS_BET_SIDE':
                return lower.endsWith(' yes') || lower.endsWith(' no') || lower.includes(' yes ') || lower.includes(' no ');

            case 'ARGS_BET_AMOUNT':
                return lower.includes('with ') && lower.includes('usdc');

            case 'ARGS_CHECK_OPTION': {
                // Check if any Check option is present
                const checkOptions = ['pnl', 'risk', 'balance', 'launchpad', 'information', 'early'];
                return checkOptions.some(opt => lower.includes(opt));
            }

            case 'ARGS_WHAT_OPTION': {
                // Check if any What option is present
                const whatOptions = ['trending', 'bet', 'token', 'farcaster', 'news', 'zora', 'calendar', 'market', 'pnl', 'early', 'risk', 'balance', 'gas'];
                return whatOptions.some(opt => lower.includes(opt));
            }

            case 'ARGS_TELL_OPTION': {
                // Check if any Tell option is present
                const tellOptions = ['farcaster', 'trending', 'news', 'crypto'];
                return tellOptions.some(opt => lower.includes(opt));
            }

            case 'ARGS_CANCEL_TARGET':
                // Check if cancel target is specified
                return lower.includes('polymarket') || lower.includes('order') || lower.includes('position');

            default:
                return false;
        }
    }

    private static hasAddress(text: string): boolean {
        // Strip everything except alphanumeric to handle newlines/spaces inside addresses
        const clean = text.replace(/[^a-zA-Z0-9]/g, '');
        // EVM or Solana/General regex (Relaxed Solana to [a-zA-Z0-9] to handle potential typos/variations during input)
        return /0x[a-fA-F0-9]{40}/.test(clean) || /[a-zA-Z0-9]{32,44}/.test(clean);
    }

    private static buildItem(match: MatchResult, onCommit: (t: string) => void): SuggestionItem {
        return {
            id: match.id,
            label: match.displayText || match.label,
            action: async () => {
                let finalText = match.actionText;

                // SPECIAL HANDLING: If suggestion includes prompt to paste, try to read clipboard
                if (match.label.includes('[Paste Contract Address]') || match.label.includes('[Paste Wallet Address]') || match.label.includes('[Paste Address]') || match.label.includes('[Paste Polymarket Link]')) {
                    try {
                        console.log('[SuggestionEngine] Attempting to read clipboard...');
                        const clipText = await navigator.clipboard.readText();
                        console.log('[SuggestionEngine] Clipboard content:', clipText);

                        // Validate if clipText looks like an address (simple length check or 0x)
                        if (clipText && (clipText.startsWith('0x') || clipText.length > 30)) {
                            finalText += clipText;

                            // APPEND SUFFIX IF PRESENT (e.g. " to ETH")
                            if (match.suffix) {
                                finalText += match.suffix;
                            }
                        } else {
                            console.warn('[SuggestionEngine] Clipboard content invalid for address:', clipText);
                        }
                    } catch (e) {
                        console.warn('[SuggestionEngine] Failed to read clipboard:', e);
                        // Fallback: just append the text, user can paste manually
                    }
                }

                // Track usage for personalized suggestions
                const cmdMatch = match.id.match(/^cmd-(.+)$/);
                if (cmdMatch) {
                    UsageTracker.record(cmdMatch[1]);
                }

                onCommit(finalText);
            }
        };
    }
}
