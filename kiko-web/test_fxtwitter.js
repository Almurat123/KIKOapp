async function test() {
    const url = "https://x.com/elonmusk/status/1764679717013807357";
    const tweetMatch = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i);
    const [, usernameMatch, tweetId] = tweetMatch;
    
    const endpoints = [
        `https://api.vxtwitter.com/Twitter/status/${tweetId}`,
        `https://api.fxtwitter.com/${usernameMatch}/status/${tweetId}`,
        `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}`
    ];
    
    for (const ep of endpoints) {
        console.log(`\nfetching ${ep}`);
        try {
            const response = await fetch(ep);
            console.log("status:", response.status);
            if (!response.ok) {
                console.log("Error status:", response.statusText);
                continue;
            }
            const text = await response.text();
            console.log("preview:", text.substring(0, 50));
            try {
                const data = JSON.parse(text);
                console.log("avatar:", data.user?.profile_image_url_https || data.author?.avatar_url || data.user_profile_image_url || data.author?.avatar);
            } catch (e) {
                console.log("not json");
            }
        } catch (e) {
            console.error("error:", e.message);
        }
    }
}
test();
