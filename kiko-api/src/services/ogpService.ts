
import * as cheerio from 'cheerio';

export interface OGPMetadata {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    url?: string;
    type?: string;
    twitterCard?: string;
    video?: string;
}

export const ogpService = {
    /**
     * Fetch OGP metadata for a given URL
     */
    async fetchOGP(url: string): Promise<OGPMetadata | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; KiKoBot/1.0; +http://kiko.finance)'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                return null;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            const metadata: OGPMetadata = {
                url: url
            };

            // Helper to get content from meta tags
            const getMeta = (property: string) => {
                return $(`meta[property="${property}"]`).attr('content') ||
                    $(`meta[name="${property}"]`).attr('content');
            };

            metadata.title = getMeta('og:title') || $('title').text();
            metadata.description = getMeta('og:description') || getMeta('description');
            metadata.image = getMeta('og:image');
            metadata.siteName = getMeta('og:site_name');
            metadata.type = getMeta('og:type');
            metadata.twitterCard = getMeta('twitter:card');
            metadata.video = getMeta('og:video');

            // Basic validation: must have at least title or image
            if (!metadata.title && !metadata.image) {
                return null;
            }

            return metadata;

        } catch (error) {
            console.warn(`[OGPService] Failed to fetch OGP for ${url}:`, error);
            return null;
        }
    }
};
