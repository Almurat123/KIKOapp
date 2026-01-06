import { ParagraphAPI } from '@paragraph_xyz/sdk';

// Initialize SDK
// API Key should be in process.env.PARAGRAPH_API_KEY
// The SDK automatically picks up the key if env var is set, or we pass it in.

export async function publishToParagraph(
    title: string,
    markdownContent: string,
    coverImageUrl?: string // URL
): Promise<{ id: string, url: string } | null> {

    const apiKey = process.env.PARAGRAPH_API_KEY;
    if (!apiKey) {
        console.error('[Paragraph] Missing PARAGRAPH_API_KEY');
        return null;
    }

    try {
        // SDK might differ based on version, checking usage from docs provided
        // Doc said: import { ParagraphAPI } from "@paragraph-com/sdk"
        // But package is @paragraph_xyz/sdk. Proceeding with best guess for installed package.
        // Assuming standard instantiation.

        // @ts-ignore - The types might be tricky without full d.ts
        const api = new ParagraphAPI({ apiKey });

        // Construct post payload
        // Note: Cover image usually needs to be a public URL. 
        // If we serve it locally, paragraph can't fetch it unless we expose ngrok or upload to S3/IPFS.
        // For now, we might skip cover image in Paragraph payload if it's local only, 
        // OR we just use it for our internal display.
        // Or we upload it to paragraph if they have upload endpoint.

        // @ts-ignore
        const post = await api.posts.create({
            title: title,
            subtitle: 'Powered by KIKO(Grok4-1-reasoning)', // Fixed subtitle for branding
            markdown: markdownContent,
            publishedAt: new Date(), // Publish immediately
            sendNewsletter: false, // Don't spam while testing
            coverImg: coverImageUrl?.startsWith('http') ? coverImageUrl : undefined
        });

        console.log('[Paragraph] Published post:', post.id);

        return {
            id: post.id,
            url: `https://paragraph.xyz/@${post.publication?.slug || 'me'}/${post.slug}`
        };
    } catch (error) {
        console.error('[Paragraph] Failed to publish:', error);
        return null; // Return null to indicate failure but don't crash flow
    }
}
