import { getTrendingEvents, getEventDetails, searchEvents } from './src/services/polymarket.js';

async function testPolymarket() {
    console.log('--- Testing Trending Events (volume24hr) ---');
    try {
        const url = 'https://gamma-api.polymarket.com/events?limit=3&active=true&closed=false&order=volume24hr&ascending=false';
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('Trending Events:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Trending Events failed:', e.message);
    }

    console.log('\n--- Testing Trending Markets (volume24hr) ---');
    try {
        const url = 'https://gamma-api.polymarket.com/markets?limit=3&active=true&closed=false&order=volume24hr&ascending=false';
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('Trending Markets:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Trending Markets failed:', e.message);
    }

    console.log('\n--- Testing Public Search (Trump) ---');
    try {
        const url = 'https://gamma-api.polymarket.com/public-search?q=Trump&limit=3&events_status=active';
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('Search Results:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Search failed:', e.message);
    }
}

testPolymarket();
