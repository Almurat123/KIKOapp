
export interface FourMemeToken {
    id: number;
    address: string;
    image: string;
    name: string;
    shortName: string; // Symbol
    symbol: string; // "BNB" (Base currency)
    descr: string;
    twitterUrl?: string;
    userAddress: string; // Creator
    status: string;
    tokenPrice?: {
        price: string;
        marketCap: string;
    };
    createdDate?: string; // from createDate
    createdAt?: number;   // timestamp alias for consistency
}

export interface FourMemeResponse {
    code: number;
    msg: string;
    data: FourMemeToken;
}

export const getFourMemeToken = async (address: string): Promise<FourMemeToken | null> => {
    try {
        // Use proxy path /fourmeme-api
        const response = await fetch(`/fourmeme-api/v1/private/token/get?address=${address}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch Four.meme token: ${response.statusText}`);
        }
        const json: FourMemeResponse = await response.json();

        if (json.code === 0 && json.data) {
            return json.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching Four.meme token:', error);
        return null;
    }
};
