
import { Resend } from 'resend';
import { env } from '../config/env.js';

let resend: Resend | null = null;

/**
 * Initialize Resend client
 */
function getResendClient(): Resend | null {
    if (resend) return resend;

    const apiKey = env.apiKeys.resendApiKey;
    if (!apiKey) {
        console.warn('[EmailService] RESEND_API_KEY not configured. Email notifications disabled.');
        return null;
    }

    resend = new Resend(apiKey);
    return resend;
}

export interface TradeNotification {
    type: 'success' | 'failure' | 'welcome';
    tokenSymbol?: string;
    tokenAddress?: string;
    amount?: string;
    usdValue?: string;
    txHash?: string;
    error?: string;
    targetWallet?: string;
    chainId?: number;
    userName?: string;
}

/**
 * Send trade notification email
 */
export async function sendTradeNotification(email: string, data: TradeNotification) {
    const client = getResendClient();
    if (!client) return;

    try {
        const chainName = data.chainId === 8453 ? 'Base' : data.chainId === 56 ? 'BSC' : 'Ethereum';
        let subject = '';

        // Modern Apple/Railway Style CSS and Layout implementation
        const styles = {
            body: "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;",
            container: "max-width: 600px; margin: 0 auto; padding: 48px 24px;",
            logo: "font-weight: 800; font-size: 24px; color: #111827; letter-spacing: -0.025em; margin-bottom: 48px; text-decoration: none; display: block;",
            heading: "font-size: 32px; font-weight: 700; color: #111827; letter-spacing: -0.04em; margin-bottom: 24px; line-height: 1.1;",
            text: "font-size: 16px; line-height: 24px; color: #4b5563; margin-bottom: 24px;",
            card: "background-color: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #f3f4f6;",
            item: "display: block; font-size: 14px; margin-bottom: 12px; color: #374151;",
            label: "font-weight: 600; color: #6b7280; width: 120px; display: inline-block;",
            value: "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #111827;",
            button: "display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; text-decoration: none; margin-top: 8px;",
            footer: "margin-top: 64px; padding-top: 32px; border-top: 1px solid #f3f4f6; text-align: left;",
            footerText: "font-size: 12px; color: #9ca3af; line-height: 18px;"
        };

        let contentHtml = '';

        if (data.type === 'welcome') {
            subject = 'Welcome to KIKO! 🎉';
            contentHtml = `
                <div style="${styles.container}">
                    <a href="https://kiko.trade" style="${styles.logo}">KIKO</a>
                    <h1 style="${styles.heading}">Welcome to the family! 🎉</h1>
                    <p style="${styles.text}">
                        Hi ${data.userName || 'there'},<br><br>
                        We're thrilled to have you here. KIKO is your new AI-powered companion for smarter, faster, and more social trading.
                    </p>
                    
                    <div style="${styles.card}">
                        <h3 style="margin-top: 0; font-size: 16px; color: #111827;">Your First Steps:</h3>
                        <div style="${styles.item}">• Have your first conversation with KIKO AI</div>
                        <div style="${styles.item}">• Explore the latest trending topics</div>
                        <div style="${styles.item}">• Configure your first copy trade</div>
                    </div>

                    <a href="https://kiko.trade" style="${styles.button}">Get Started Now</a>

                    <div style="${styles.footer}">
                        <p style="${styles.footerText}">
                            &copy; 2026 KIKO Trader. All rights reserved.<br>
                            To the moon! 🚀
                        </p>
                    </div>
                </div>
            `;
        } else {
            const isSuccess = data.type === 'success';
            subject = isSuccess
                ? `Trade Executed: Bought ${data.tokenSymbol}`
                : `Trade Failed: ${data.tokenSymbol}`;

            contentHtml = `
                <div style="${styles.container}">
                    <a href="https://kiko.trade" style="${styles.logo}">KIKO</a>
                    <h1 style="${styles.heading}">${isSuccess ? 'Trade successful.' : 'Trade failed.'}</h1>
                    <p style="${styles.text}">
                        ${isSuccess
                    ? `Your copy trade for <strong>${data.tokenSymbol}</strong> was executed successfully.`
                    : `We couldn't complete your trade for <strong>${data.tokenSymbol}</strong>.`}
                    </p>

                    <div style="${styles.card}">
                        <div style="${styles.item}"><span style="${styles.label}">Token</span><span style="${styles.value}">${data.tokenSymbol}</span></div>
                        <div style="${styles.item}"><span style="${styles.label}">Network</span><span style="${styles.value}">${chainName}</span></div>
                        ${data.amount ? `<div style="${styles.item}"><span style="${styles.label}">Amount</span><span style="${styles.value}">${data.amount}</span></div>` : ''}
                        ${data.usdValue ? `<div style="${styles.item}"><span style="${styles.label}">Value</span><span style="${styles.value}">$${data.usdValue}</span></div>` : ''}
                        <div style="${styles.item}"><span style="${styles.label}">Trader</span><span style="${styles.value}">${data.targetWallet?.slice(0, 6)}...${data.targetWallet?.slice(-4)}</span></div>
                        ${data.error ? `<div style="${styles.item}; margin-top: 12px; color: #ef4444;"><span style="${styles.label}">Error</span><span>${data.error}</span></div>` : ''}
                    </div>

                    ${data.txHash ? `
                        <a href="https://basescan.org/tx/${data.txHash}" style="${styles.button}">View details</a>
                    ` : `
                        <a href="https://kiko.trade" style="${styles.button}">Go to dashboard</a>
                    `}

                    <div style="${styles.footer}">
                        <p style="${styles.footerText}">
                            KIKO Trader — AI-Powered Social Trading.<br>
                            This is an automated notification based on your account settings.
                        </p>
                    </div>
                </div>
            `;
        }

        const html = `
            <!DOCTYPE html>
            <html>
                <head><meta charset="utf-8"></head>
                <body style="${styles.body}">
                    ${contentHtml}
                </body>
            </html>
        `;

        // Generate plain text version for better deliverability (Anti-Spam)
        const text = data.type === 'welcome'
            ? `Welcome to KIKO. Ready to trade with AI. Dashboard: https://kiko.trade`
            : `${data.type === 'success' ? 'Trade Successful' : 'Trade Failed'}: ${data.tokenSymbol}. Explorer: https://basescan.org/tx/${data.txHash}`;

        // Dynamic explorer URL based on chain
        let explorerUrl = 'https://basescan.org/tx/';
        if (data.chainId === 1) explorerUrl = 'https://etherscan.io/tx/';
        if (data.chainId === 56) explorerUrl = 'https://bscscan.com/tx/';
        if (data.chainId === 137) explorerUrl = 'https://polygonscan.com/tx/';
        if (data.chainId === 10) explorerUrl = 'https://optimistic.etherscan.io/tx/';

        const finalExplorerLink = data.txHash ? `${explorerUrl}${data.txHash}` : 'https://kiko.trade';

        const result = await client.emails.send({
            from: 'KIKO <notifications@kikoapp.app>',
            to: email,
            subject: subject,
            html: html,
            text: text, // Critical for SPF/DKIM validation
            headers: {
                'X-Entity-Ref-ID': Date.now().toString(),
            }
        });

        if (result.error) {
            const errorMsg = String(result.error.message || '');
            // Check for verification errors or 403
            if (errorMsg.includes('verified domain') || (result.error as any).statusCode === 403) {
                console.log('[EmailService] Domain kikoapp.app might not be fully propagated, falling back...');
                await client.emails.send({
                    from: 'onboarding@resend.dev',
                    to: email,
                    subject: subject,
                    html: html,
                    text: text,
                });
            } else {
                console.error('[EmailService] Error sending email:', result.error);
            }
        } else {
            console.log('[EmailService] Email sent successfully via kikoapp.app:', result.data?.id);
        }
    } catch (error) {
        console.error('[EmailService] Error in sendTradeNotification:', error);
    }
}

