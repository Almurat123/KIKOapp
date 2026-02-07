// Package db: GORM models matching Prisma schema (kiko-api prisma/schema.prisma).

package db

import "time"

// Chain maps to Chain table.
type Chain struct {
	ID          int       `gorm:"primaryKey"`
	Name        string    `gorm:"uniqueIndex"`
	Symbol      string    `gorm:"column:symbol"`
	RpcURL      *string   `gorm:"column:rpcUrl"`
	ExplorerURL *string   `gorm:"column:explorerUrl"`
	LogoURL     *string   `gorm:"column:logoUrl"`
	IsActive    bool      `gorm:"column:isActive;default:true"`
	CreatedAt   time.Time `gorm:"column:createdAt"`
}

func (Chain) TableName() string { return "Chain" }

// Token maps to Token table.
type Token struct {
	ID        string    `gorm:"primaryKey"`
	ChainID   int       `gorm:"column:chainId;uniqueIndex:Token_chainId_address"`
	Address   string    `gorm:"column:address;uniqueIndex:Token_chainId_address"`
	Symbol    string    `gorm:"column:symbol;index"`
	Name      *string   `gorm:"column:name"`
	Decimals  *int      `gorm:"column:decimals"`
	LogoURL   *string   `gorm:"column:logoUrl"`
	CreatedAt time.Time `gorm:"column:createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt"`
}

func (Token) TableName() string { return "Token" }

// User maps to User table.
type User struct {
	ID                  string    `gorm:"primaryKey"`
	PrivyDid            string    `gorm:"column:privyDid;uniqueIndex"`
	WalletAddress       string    `gorm:"column:walletAddress;uniqueIndex"`
	SolanaWalletAddress *string   `gorm:"column:solanaWalletAddress"`
	FarcasterFid        *int      `gorm:"column:farcasterFid"`
	FarcasterUsername   *string   `gorm:"column:farcasterUsername"`
	CreatedAt           time.Time `gorm:"column:createdAt"`
	Email               *string   `gorm:"column:email;uniqueIndex"`
	ReferralCode        *string   `gorm:"column:referralCode;uniqueIndex"`
	ReferredBy          *string   `gorm:"column:referredBy"`
}

func (User) TableName() string { return "User" }

// UserSettings maps to UserSettings table.
type UserSettings struct {
	ID                   string    `gorm:"primaryKey"`
	UserID               string    `gorm:"column:userId;uniqueIndex"`
	DefaultSwapAmount    float64   `gorm:"column:defaultSwapAmount;default:100"`
	DefaultSwapUnit      string    `gorm:"column:defaultSwapUnit;default:native"`
	CheckTokenBeforeSwap bool      `gorm:"column:checkTokenBeforeSwap;default:true"`
	QuickSwapMode        bool      `gorm:"column:quickSwapMode;default:false"`
	SwapMethod           string    `gorm:"column:swapMethod;default:allowance_trade"`
	SlippageMode         string    `gorm:"column:slippageMode;default:auto"`
	CustomSlippage       float64   `gorm:"column:customSlippage;default:0.5"`
	MevProtection        bool      `gorm:"column:mevProtection;default:true"`
	PriceDeviationCheck  bool      `gorm:"column:priceDeviationCheck;default:true"`
	CopyTradeAIMode      string    `gorm:"column:copyTradeAIMode;default:disabled"`
	FastSwapMode         bool      `gorm:"column:fastSwapMode;default:false"`
	UpdatedAt            time.Time `gorm:"column:updatedAt"`
	CreatedAt            time.Time `gorm:"column:createdAt"`
}

func (UserSettings) TableName() string { return "UserSettings" }

// CopyTradeConfig maps to CopyTradeConfig table.
type CopyTradeConfig struct {
	ID                string    `gorm:"primaryKey"`
	UserID            string    `gorm:"column:userId;index"`
	TargetWallet      string    `gorm:"column:targetWallet;index"`
	ChainID           int       `gorm:"column:chainId;default:8453"`
	BuyAmountUsd      float64   `gorm:"column:buyAmountUsd"`
	MaxSlippageBps    int       `gorm:"column:maxSlippageBps;default:300"`
	MinMarketCapUsd   *float64  `gorm:"column:minMarketCapUsd"`
	MinLiquidityUsd   *float64  `gorm:"column:minLiquidityUsd"`
	MinTargetValueUsd *float64  `gorm:"column:minTargetValueUsd"`
	Status            string    `gorm:"column:status;default:active"`
	AiAnalysisMode    string    `gorm:"column:aiAnalysisMode;default:disabled"`
	CreatedAt         time.Time `gorm:"column:createdAt"`
	UpdatedAt         time.Time `gorm:"column:updatedAt"`
}

func (CopyTradeConfig) TableName() string { return "CopyTradeConfig" }

// Position maps to Position table.
type Position struct {
	ID             string     `gorm:"primaryKey"`
	UserID         string     `gorm:"column:userId;index"`
	ConfigID       string     `gorm:"column:configId;index"`
	TokenAddress   string     `gorm:"column:tokenAddress;index"`
	TokenSymbol    *string    `gorm:"column:tokenSymbol"`
	ChainID        int        `gorm:"column:chainId"`
	EntryPrice     float64    `gorm:"column:entryPrice"`
	EntryAmount    string     `gorm:"column:entryAmount"`
	EntryTxHash    string     `gorm:"column:entryTxHash"`
	EntryUsdValue  float64    `gorm:"column:entryUsdValue"`
	Status         string     `gorm:"column:status;default:open"`
	CreatedAt      time.Time  `gorm:"column:createdAt"`
	ClosedAt       *time.Time `gorm:"column:closedAt"`
	ExitTxHash     *string    `gorm:"column:exitTxHash"`
	LeaderTxHash   *string   `gorm:"column:leaderTxHash"`
}

func (Position) TableName() string { return "Position" }

// SwapHistory maps to SwapHistory table.
type SwapHistory struct {
	ID             string     `gorm:"primaryKey"`
	UserID         string     `gorm:"column:userId;index"`
	ChainID        int        `gorm:"column:chainId;index"`
	TxHash         *string    `gorm:"column:txHash"`
	TokenInAddress string     `gorm:"column:tokenInAddress"`
	TokenInSymbol  *string    `gorm:"column:tokenInSymbol"`
	TokenInAmount  string     `gorm:"column:tokenInAmount"`
	TokenOutAddress string    `gorm:"column:tokenOutAddress"`
	TokenOutSymbol *string    `gorm:"column:tokenOutSymbol"`
	TokenOutAmount *string    `gorm:"column:tokenOutAmount"`
	Status         string     `gorm:"column:status;default:pending"`
	Source         string     `gorm:"column:source;default:manual"`
	CreatedAt      time.Time  `gorm:"column:createdAt"`
	ConfirmedAt    *time.Time `gorm:"column:confirmedAt"`
}

func (SwapHistory) TableName() string { return "SwapHistory" }

// FavoriteToken maps to FavoriteToken table.
type FavoriteToken struct {
	ID        string    `gorm:"primaryKey"`
	UserID    string    `gorm:"column:userId;index;uniqueIndex:FavoriteToken_userId_chain_address"`
	Chain     string    `gorm:"column:chain;uniqueIndex:FavoriteToken_userId_chain_address"`
	Address  string    `gorm:"column:address;uniqueIndex:FavoriteToken_userId_chain_address"`
	CreatedAt time.Time `gorm:"column:createdAt"`
}

func (FavoriteToken) TableName() string { return "FavoriteToken" }
