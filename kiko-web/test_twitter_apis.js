// Test different approaches to get Twitter avatar
async function test() {
    // Test 1: Twitter syndication API with proper headers and token
    const tweetId = "1764679717013807357";
    
    console.log("\n=== Test 1: cdn.syndication.twimg.com with guest token ===");
    try {
        // First, get a guest token from twitter.com
        const activateRes = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
            }
        });
        if (activateRes.ok) {
            const token = await activateRes.json();
            console.log("Guest token obtained:", token.guest_token ? "yes" : "no");
        }
    } catch (e) {
        console.log("Guest token error:", e.message);
    }

    // Test 2: Twitter oEmbed HTML parse
    console.log("\n=== Test 2: Parse avatar from oEmbed HTML ===");
    try {
        const oEmbedUrl = `https://publish.twitter.com/oembed?url=https://x.com/elonmusk/status/${tweetId}&omit_script=true`;
        const res = await fetch(oEmbedUrl, { headers: {'Accept': 'application/json'} });
        if (res.ok) {
            const data = await res.json();
            console.log("author_url:", data.author_url);
            // The HTML may contain the author's avatar in the tweet embed
            const htmlSnippet = data.html?.substring(0, 300);
            console.log("html snippet:", htmlSnippet);
            
            // Extract the username from author_url
            const authorUrlMatch = data.author_url?.match(/twitter\.com\/([^/?]+)/i) || 
                                   data.author_url?.match(/x\.com\/([^/?]+)/i);
            if (authorUrlMatch) {
                console.log("author username:", authorUrlMatch[1]);
                
                // Try to build avatar URL using unavatar.io
                const avatarUrl = `https://unavatar.io/twitter/${authorUrlMatch[1]}`;
                console.log("Unavatar URL:", avatarUrl);
                
                const avatarResp = await fetch(avatarUrl, {redirect: 'manual'});
                console.log("Unavatar response status:", avatarResp.status);
                if (avatarResp.headers.get('location')) {
                    console.log("Redirects to:", avatarResp.headers.get('location'));
                }
            }
        }
    } catch(e) {
        console.log("oEmbed/unavatar error:", e.message);
    }
}
test();
