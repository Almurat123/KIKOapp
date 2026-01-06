
import { createParagraphAPI } from '@paragraph_xyz/sdk';

async function test() {
    console.log('Testing Paragraph SDK Connectivity...');
    try {
        const api = createParagraphAPI();

        const slug = 'decentralizedpictures';
        console.log(`Fetching publication: ${slug}`);

        const pub = await api.getPublicationBySlug(slug);
        console.log('Publication result:', pub ? 'Found' : 'Not Found');

        if (pub) {
            console.log('ID:', pub.id);
            console.log('Name:', pub.name);

            console.log(`Fetching posts for ID: ${pub.id}`);
            const posts = await api.getPosts(pub.id, { limit: 5 });
            console.log('Posts result:', posts ? (Array.isArray(posts) ? posts.length : 'Object') : 'Null');

            if (posts && Array.isArray(posts) && posts.length > 0) {
                console.log('First post title:', posts[0].title);
            } else if (posts && posts.data) { // Check if it's wrapped
                console.log('First post title (wrapped):', posts.data[0]?.title);
            }
        }
    } catch (error) {
        console.error('SDK Error:', error);
    }
}

test();
