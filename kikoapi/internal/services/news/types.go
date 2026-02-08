package news

// TrendingToken is a single trending token for news.
type TrendingToken struct {
	Name        string  `json:"name"`
	Symbol      string  `json:"symbol"`
	Address     string  `json:"address"`
	Chain       string  `json:"chain"`
	Price       string  `json:"price,omitempty"`
	PriceNum    float64 `json:"-"`
	PriceChange float64 `json:"priceChange"`
	Volume      float64 `json:"volume"`
	MarketCap   float64 `json:"marketCap"`
	ImageURL    string  `json:"imageUrl,omitempty"`
}

// NewsTrendingData is the result of collecting trending tokens.
type NewsTrendingData struct {
	Tokens    []TrendingToken `json:"tokens"`
	Chains    []string        `json:"chains"`
	Timestamp int64           `json:"timestamp"`
}
