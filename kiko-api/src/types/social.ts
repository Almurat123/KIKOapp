
export interface TrendingCast {
    hash: string;
    fid: number;
    author: {
        fid: number;
        username: string;
        displayName: string;
        avatar: string;
        pfp?: string;
        bio?: string;
        creatorCoin?: any;
        twitter?: string;
        verified?: boolean;
        // New Hub fields
        url?: string;            // USER_DATA_TYPE_URL — personal website
        banner?: string;         // USER_DATA_TYPE_BANNER — profile banner image
        primaryAddress?: string; // USER_DATA_PRIMARY_ADDRESS_ETHEREUM
        location?: string;       // USER_DATA_TYPE_LOCATION — geo:lat,lng
    };
    text: string;
    timestamp: Date | string;
    embeds: any[];
    parentCastId?: {
        fid: number;
        hash: string;
    };
    parentUrl?: string;          // Farcaster channel URL
    mentionsPositions?: number[]; // Char positions of @mentions in text
    stats: {
        likes: number | string;
        recasts: number | string;
        replies: number | string;
    };
    heatScore: number | string;
    rank: number;
    baseAppCoinMetadata?: any;
    coinValue?: string;
    mentions?: any;
    isBaseAppCoin?: boolean;
}

export interface SocialFeedItem {
    id: string;
    hash: string;
    text: string;
    author: {
        username: string;
        displayName: string;
        avatar: string;
    };
    timestamp: string;
    likes: number;
    recasts: number;
    replies: number;
    isBaseAppCoin?: boolean;
    castTwitter?: string;
}
