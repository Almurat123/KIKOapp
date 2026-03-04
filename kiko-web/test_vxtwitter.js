async function test() {
    const url = "https://x.com/elonmusk/status/1764679717013807357";
    const tweetMatch = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i);
    if (!tweetMatch) {
        console.log("no match");
        return;
    }
    const [, usernameMatch, tweetId] = tweetMatch;
    console.log(`fetching https://api.vxtwitter.com/${usernameMatch}/status/${tweetId}`);
    try {
        const response = await fetch(`https://api.vxtwitter.com/${usernameMatch}/status/${tweetId}`);
        console.log("status:", response.status);
        const data = await response.json();
        console.log("data keys:", Object.keys(data));
        console.log("avatar:", data.user_profile_image_url);
        console.log("name:", data.user_name);
        console.log("text snippet:", data.text?.substring(0, 50));
    } catch (e) {
        console.error("error:", e.message);
    }
}
test();
