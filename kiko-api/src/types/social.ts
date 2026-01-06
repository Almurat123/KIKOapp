
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
    };
    text: string;
    timestamp: Date | string;
    embeds: any[];
    parentCastId?: {
        fid: number;
        hash: string;
    };
    stats: {
        likes: number | string;
        recasts: number | string;
        replies: number | string;
    };
    heatScore: number | string;
    rank: number;
    baseAppCoinMetadata?: any;
    coinValue?: string;
    authorBio?: string;
    mentions?: any;
    authorCreatorCoin?: string;
    authorTwitter?: string;
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
