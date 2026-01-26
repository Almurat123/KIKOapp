/**
 * KiKo V2 State Machine Core
 * Defines the lifecycle of an AI Task with strict state transitions.
 */

import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

export type TaskState =
    | 'IDLE'
    | 'INTENT_ANALYSIS'
    | 'CONTEXT_ENRICHMENT'
    | 'PLANNING'
    | 'EXECUTION'
    | 'VERIFICATION'
    | 'COMPLETED'
    | 'FAILED';

export interface StateContext {
    sessionId: string;
    userId: string;
    userInput: string;
    intent?: any;
    marketData?: any;
    plan?: any;
    executionResult?: any;
    error?: Error;
}

export abstract class BaseStateMachine {
    protected state: TaskState = 'IDLE';
    protected context: StateContext;

    constructor(context: StateContext) {
        this.context = context;
    }

    public getState(): TaskState {
        return this.state;
    }

    public async transitionTo(newState: TaskState): Promise<void> {
        if (!this.isValidTransition(this.state, newState)) {
            throw new Error(`Invalid state transition from ${this.state} to ${newState}`);
        }

        logger.debug(LogCode.SYS_INFO, `State Transition: ${this.state} -> ${newState}`, {
            sessionId: this.context.sessionId
        });

        const previousState = this.state;
        this.state = newState;
        await this.onStateEnter(newState, previousState);
    }

    protected abstract onStateEnter(newState: TaskState, previousState: TaskState): Promise<void>;

    private isValidTransition(from: TaskState, to: TaskState): boolean {
        const transitions: Record<TaskState, TaskState[]> = {
            'IDLE': ['INTENT_ANALYSIS', 'FAILED'],
            'INTENT_ANALYSIS': ['CONTEXT_ENRICHMENT', 'EXECUTION', 'FAILED'], // EXECUTION shortcut for Fast Swap
            'CONTEXT_ENRICHMENT': ['PLANNING', 'EXECUTION', 'FAILED'],
            'PLANNING': ['EXECUTION', 'FAILED'],
            'EXECUTION': ['VERIFICATION', 'COMPLETED', 'FAILED'],
            'VERIFICATION': ['COMPLETED', 'EXECUTION', 'FAILED'], // execution back for retries
            'COMPLETED': [],
            'FAILED': []
        };

        return transitions[from]?.includes(to) ?? false;
    }
}
