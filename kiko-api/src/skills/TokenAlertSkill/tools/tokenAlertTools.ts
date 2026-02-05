import { prisma } from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { Tool } from '../../../tooling/registry.js';

/**
 * Tool to set a price or market cap alert for a token
 */
export const SetTokenAlertTool: Tool = {
    definition: {
        name: 'set_token_alert',
        description: 'Set a price or market cap alert for a token. Triggers a notification or an automated trade.',
        parameters: {
            type: 'object',
            properties: {
                tokenAddress: { type: 'string', description: 'The contract address of the token' },
                chainId: { type: 'number', description: 'The chain ID (default 8453 for Base)' },
                targetType: {
                    type: 'string',
                    enum: ['price', 'market_cap'],
                    description: 'The metric to monitor (price or market_cap)'
                },
                ruleType: {
                    type: 'string',
                    enum: ['above', 'below'],
                    description: 'The condition (above or below)'
                },
                conditionValue: { type: 'number', description: 'The target value to trigger the alert' },
                action: {
                    type: 'string',
                    enum: ['notify', 'buy', 'sell'],
                    description: 'The action to take when triggered'
                },
                actionAmount: {
                    type: 'number',
                    description: 'Optional: The USD amount to buy or sell'
                }
            },
            required: ['tokenAddress', 'targetType', 'ruleType', 'conditionValue', 'action']
        }
    },
    handler: async (args: any, context: any) => {
        const { userId } = context;
        const { tokenAddress, chainId = 8453, targetType, ruleType, conditionValue, action, actionAmount } = args;

        try {
            const rule = await prisma.tokenRule.create({
                data: {
                    userId,
                    address: tokenAddress.toLowerCase(),
                    chainId: Number(chainId),
                    targetType,
                    ruleType,
                    conditionValue,
                    action,
                    actionAmount: actionAmount ? Number(actionAmount) : null,
                    isActive: true
                }
            });

            logger.info(LogCode.SYS_INFO, 'Token Rule Created', { userId, ruleId: rule.id });

            return {
                success: true,
                message: `Alert set! I will ${action} when the ${targetType} of ${tokenAddress.slice(0, 6)} is ${ruleType} ${conditionValue.toLocaleString()}.`,
                ruleId: rule.id
            };
        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Failed to set token alert', { error: error.message });
            return { success: false, message: `Failed to set alert: ${error.message}` };
        }
    }
};

/**
 * Tool to list active alerts for a user
 */
export const ListTokenAlertsTool: Tool = {
    definition: {
        name: 'list_token_alerts',
        description: 'List all active price and market cap alerts for the user.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    handler: async (args: any, context: any) => {
        const { userId } = context;

        try {
            const rules = await prisma.tokenRule.findMany({
                where: { userId, isActive: true },
                orderBy: { createdAt: 'desc' }
            });

            if (rules.length === 0) {
                return { success: true, message: "You don't have any active alerts." };
            }

            const alertList = rules.map(r =>
                `- ${r.address.slice(0, 6)}: ${r.action} when ${r.targetType} is ${r.ruleType} ${Number(r.conditionValue).toLocaleString()}`
            ).join('\n');

            return {
                success: true,
                message: `Your active alerts:\n${alertList}`,
                alerts: rules
            };
        } catch (error: any) {
            return { success: false, message: `Error fetching alerts: ${error.message}` };
        }
    }
};

/**
 * Tool to remove a token alert
 */
export const RemoveTokenAlertTool: Tool = {
    definition: {
        name: 'remove_token_alert',
        description: 'Remove a specific token alert by its ID.',
        parameters: {
            type: 'object',
            properties: {
                ruleId: { type: 'number', description: 'The ID of the alert to remove' }
            },
            required: ['ruleId']
        }
    },
    handler: async (args: any, context: any) => {
        const { userId } = context;
        const { ruleId } = args;

        try {
            const rule = await prisma.tokenRule.delete({
                where: { id: ruleId, userId }
            });

            return { success: true, message: `Alert #${ruleId} has been removed.` };
        } catch (error: any) {
            return { success: false, message: `Failed to remove alert: ${error.message}` };
        }
    }
};
