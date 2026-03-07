import { prisma } from '../src/db/prisma.js';

async function main() {
  const articles = [
    {
      title: "Welcome to KiKo: AI-Powered Trading for Web3",
      slug: "welcome-to-kiko",
      summary: "KiKo deeply integrates large language models into the Web3 ecosystem to replace interface complexity with natural language.",
      content: `## What is KiKo?

**KiKo** is a Labs project that deeply integrates large language models (LLMs) into the Web3 trading ecosystem. Our mission is simple: **Replace interface complexity with natural language**.

Instead of navigating bloated, complex trading interfaces, you only need to describe your needs in everyday language. KiKo orchestrates the appropriate tools to complete your entire workflow, from information gathering to on-chain execution.

### Multi-Model Orchestration
KiKo isn't bound to a single model; it intelligently selects the most suitable 'brain' for every task:
- **DeepSeek**: Deployed for deep reasoning and complex analysis scenarios.
- **Grok (xAI)**: Leveraged for real-time X (Twitter) data, web searches, and multi-modal understanding.
- **GPT Series**: Orchestrates general tasks and tool interactions.

### Core Capabilities
- **Information Analysis**: Real-time aggregation of market data, social intelligence (Farcaster/X), and prediction markets (Polymarket).
- **Trade Execution**: Smart swaps with automatic routing optimization across **Base**, **Ethereum**, and **Solana**.
- **Risk Scan**: Automatically detect contract security (honeypots, rugs) before you trade.
- **Copy Trading**: Effortlessly mirror the behavior of smart money wallets.

### Your Safety, Your Keys
KiKo uses **Privy** for non-custodial key management. Your private key is managed and encrypted with HSM-level security by Privy. Every transaction requires your explicit confirmation, and KiKo will never initiate a signature without your authorization.`,
      coverImage: "/news-covers/zora-canvas-1772115882998.png",
      status: "published",
      publishedAt: new Date()
    },
    {
      title: "Quickstart: Start Your KiKo Journey in Three Steps",
      slug: "ai-renaissance-kiko",
      summary: "From logging in to your first AI-assisted trade, here is how to get started with KiKo.",
      content: `## Three Steps to Trading with AI

Getting started with KiKo is designed to be as seamless as the trading experience itself.

### 1. Login and Create Wallet
KiKo supports multiple login methods including **Google**, **Farcaster**, **Email**, and **Twitter (X)**. We use **Privy** for non-custodial wallet creation. Your wallet always belongs to you, and you can export your private key at any time from the Settings page.

### 2. Fund Your Wallet
Top up your wallet to start trading. We recommend using the **Base network** for its extremely low gas fees. You can fund your EVM or Solana wallets via exchange withdrawals or cross-chain bridges.

### 3. Let AI Guide Your Setup
Once funded, interacting with KiKo is incredibly intuitive.

**Interactive Chat Recommendations**
Simply click on the chat input box at the bottom of the screen. KiKo will instantly pop up a list of intelligent recommendations to help you get started:

![Chat Recommendations](/news-covers/2026-03-07%2012.13.17.png)

**Guided Feature Setup**
Clicking on any of these recommendations—such as "Set an alert for ETH price" or "Help me set up copy trading"—will automatically input the command and guide you step-by-step through the feature setup flow.

![Feature Input Setup](/news-covers/2026-03-07%2012.16.05.png)

Through this conversational interface, you can easily configure all your personalized settings:
- **User Preferences**: Set your slippage, gas priority, and default chains.
- **Price Alerts**: Configure target prices for automatic notifications.
- **Copy Trading**: Configure target addresses, amount limits, and filters.
- **Agent Mode**: Enable the AI to monitor markets and execute strategies on your behalf.

For a deep dive into advanced settings and all feature capabilities, please refer to our full [Official Documentation](/docs).`,
      coverImage: "/news-covers/2026-03-07 17.59.33.png",
      status: "published",
      publishedAt: new Date()
    }
  ];

  for (const art of articles) {
    await prisma.newsArticle.upsert({
      where: { slug: art.slug },
      update: art,
      create: (art as any)
    });
    console.log(`Upserted article: ${art.title}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
