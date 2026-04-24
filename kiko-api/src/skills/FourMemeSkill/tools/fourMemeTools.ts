import { Tool, type ToolContext } from '../../../tooling/registry.js';
import { deployFourMemeToken } from '../../../services/fourMemeTokenDeployService.js';

function toolError(error: unknown) {
    return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
    };
}

function resolveXSourceTweetUrl(context?: ToolContext): string | undefined {
    const currentPage = String(context?.currentPage || '').trim().toLowerCase();
    const pageContext = String(context?.pageContext || '').trim().toLowerCase();
    const socialPlatform = String((context as any)?.socialInput?.platform || '').trim().toLowerCase();
    if (socialPlatform !== 'x' && currentPage !== 'x' && pageContext !== 'x_agent') return undefined;

    const tweetId = String(
        (context as any)?.x?.sourceMessageId
        || (context as any)?.x?.rootTweetId
        || '',
    ).trim();
    if (!tweetId) return undefined;
    return `https://x.com/i/web/status/${encodeURIComponent(tweetId)}`;
}

export const DeployFourMemeTokenTool: Tool = {
    definition: {
        name: 'deploy_fourmeme_token',
        description: 'Prepare or execute a Four.meme token deployment on BNB Chain only. Use this for BSC/BNB Chain token launches, not for Base. Four.meme requires a token image and a user-chosen initial BNB launch amount. In ordinary web chat, prefer a dry-run first and set confirmDeploy=true only after explicit confirmation. In X/Farcaster @mention agent mode, set confirmDeploy=true in the same turn when the mention explicitly asks to launch and required fields are present.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Human-readable token name.' },
                symbol: { type: 'string', description: 'Token symbol / short name.' },
                description: { type: 'string', description: 'Token description. If omitted, KiKo uses a minimal fallback description.' },
                image: { type: 'string', description: 'Required token logo/art image URL or IPFS URI. If the current user turn includes a clear matching upload/social-post image, use that image; otherwise ask for an image URL/upload.' },
                chainId: { type: 'number', description: 'Deployment chain ID. Must be 56 for BNB Chain / BSC.' },
                bnbAmount: { type: 'number', description: 'Required initial BNB paid from the user wallet in the launch transaction to buy/fund the token at creation time. This is separate from gas and must not be invented or defaulted.' },
                launchTimeFromNow: { type: 'number', description: 'Launch delay in seconds from now. Omit or use 0 to launch immediately.' },
                category: {
                    type: 'string',
                    enum: ['Meme', 'AI', 'Defi', 'Games', 'Infra', 'De-Sci', 'Social', 'Depin', 'Charity', 'Others'],
                    description: 'Four.meme category label. Defaults to Meme.',
                },
                websiteUrl: { type: 'string', description: 'Optional project website URL.' },
                twitterUrl: { type: 'string', description: 'Optional X/Twitter profile URL.' },
                telegramUrl: { type: 'string', description: 'Optional Telegram URL.' },
                confirmDeploy: {
                    type: 'boolean',
                    description: 'Must be true to execute the real Four.meme deploy flow. Defaults to false.',
                },
            },
            required: ['name', 'symbol', 'image', 'bnbAmount'],
        },
    },
    permissions: 'authenticated',
    handler: async (args, context) => {
        try {
            const { confirmDeploy, ...input } = args || {};
            const xSourceTweetUrl = input?.twitterUrl ? undefined : resolveXSourceTweetUrl(context);
            const deployInput = xSourceTweetUrl
                ? { ...input, twitterUrl: xSourceTweetUrl }
                : input;
            return deployFourMemeToken(deployInput, {
                confirmDeploy: confirmDeploy === true,
                userId: context?.userId,
                accessToken: context?.accessToken,
            });
        } catch (error) {
            return toolError(error);
        }
    },
};
