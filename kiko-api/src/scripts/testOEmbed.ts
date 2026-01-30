async function testOEmbed() {
    const url = 'https://x.com/VitalikButerin/status/1877640248560000000';
    const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;

    console.log(`Testing oEmbed for X: ${oEmbedUrl}\n`);

    try {
        const response = await fetch(oEmbedUrl);
        if (response.ok) {
            const data = await response.json();
            console.log('Result:', JSON.stringify(data, null, 2));
        } else {
            console.log('Failed:', response.status);
        }
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

testOEmbed();
