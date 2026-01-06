
import { createParagraphAPI } from '@paragraph_xyz/sdk';

const POPULAR_PUBLICATION_SLUGS = [
    'decentralizedpictures', 'avc', 'debbie', 'assetux',
    'officercia', 'brandondonnelly', 'ethdaily', 'thumbsup', 'oddwritings', 'simonethg'
];

async function test() {
    console.log('Testing Publication Slugs...');
    const api = createParagraphAPI();

    for (const slug of POPULAR_PUBLICATION_SLUGS) {
        try {
            const pub = await api.getPublicationBySlug(slug);
            console.log(`[${slug}]: ${pub ? '✅ Found (ID: ' + pub.id + ')' : '❌ Not Found'}`);
            if (pub) {
                // Try fetching posts
                try {
                    const posts: any = await api.getPosts(pub.id, { limit: 1 });
                    const items = posts.items || posts.data;
                    console.log(`   -> Posts: ${items ? items.length : 0}`);
                } catch (e: any) {
                    console.log(`   -> Fetch Posts Failed: ${e.message}`);
                }
            }
        } catch (e: any) {
            console.log(`[${slug}]: ❌ Error (${e.message})`);
        }
    }
}

test();
