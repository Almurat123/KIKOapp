import React, { useState } from 'react';
import {
   Zap
} from 'lucide-react';
import { PageContainer } from '../components/Layout/PageContainer';
import styles from './TestCardsPage.module.css';
import { SwapCardIntegrated } from '../components/Swap/SwapCardIntegrated';
import { LaunchpadCard } from '../components/Launchpad/LaunchpadCard';
import { StrategyCard } from '../components/Trade/StrategyCard';
import type { TradingStrategy } from '../hooks/useStrategies';

// --- 1. Swap 卡片 ---
// --- 1. Swap 卡片 Wrapper (Modified for Debugging) ---
const SwapCardSection = () => {
   const isGenerating = false;
   const [key, setKey] = useState(0); // Force re-render

   const handleRefresh = () => {
      // setIsGenerating(true); // Removed old loading state
      setKey(prev => prev + 1);

      // Simulate generation delay
      // setTimeout(() => {
      //    setIsGenerating(false);
      // }, 2500);
   };

   return (
      <div className="flex flex-col gap-4">
         <div className="flex justify-between items-center">
            <span className={styles.sectionLabel}>Execution</span>
            <button
               onClick={handleRefresh}
               className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors flex items-center gap-1"
            >
               <Zap size={12} /> Refresh Animation
            </button>
         </div>

         {/* Use the actual Integrated Card with Fluid Animation */}
         <div className="w-full max-w-[320px] flex flex-col items-start">
            <div key={key} className={styles.animFluid}>
               <div className={styles.cardContent}>
                  <SwapCardIntegrated
                     isGenerating={isGenerating}
                     initialTokenIn={{ symbol: 'ETH', address: '', decimals: 18, name: 'Ethereum' }}
                     initialTokenOut={{ symbol: 'USDC', address: '', decimals: 6, name: 'USD Coin' }}
                     initialAmountIn="1"
                  />
               </div>
            </div>
         </div>


      </div>
   );
};

// --- 2. Strategy Card Wrapper ---
const StrategyCardWrapper = ({ isGenerating = false }: { isGenerating?: boolean }) => {
   const [showOverlay, setShowOverlay] = useState(isGenerating);
   const [isClearing, setIsClearing] = useState(false);

   // Mock strategy data
   const mockStrategy: TradingStrategy = {
      id: '8291-AC2',
      name: 'Mock Strategy',
      status: 'active' as const,
      type: 'auto_buy' as const,
      createdAt: Date.now() - 120000,
      updatedAt: Date.now() - 120000,
      executionAmount: '0.5',
      tokenIn: 'ETH',
      tokenOut: 'ANY',
      chain: 'base',
      chainId: 8453,
      amountAsset: 'ETH',
      triggerCondition: 'Buys ETH > 0',
      limits: {
         maxUsdPerDay: '1000',
         maxTradesPerDay: 10,
         cooldown: '1h'
      },
      copyTradeConfig: {
         id: 'mock-config-id',
         userId: 'mock-user-id',
         targetWallet: '0x7a2...3f91',
         chainId: 8453,
         buyAmountUsd: 100,
         maxSlippageBps: 100,
         minMarketCapUsd: null,
         minLiquidityUsd: null,
         minTargetValueUsd: null,
         takeProfitPct: null,
         stopLossPct: null,
         mirrorSell: false,
         status: 'active',
         aiAnalysisMode: 'disabled',
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString()
      },
      executionHistory: []
   };

   React.useEffect(() => {
      if (isGenerating) {
         setShowOverlay(true);
         setIsClearing(false);
      } else if (showOverlay) {
         setIsClearing(true);
         const timer = setTimeout(() => {
            setShowOverlay(false);
            setIsClearing(false);
         }, 1500);
         return () => clearTimeout(timer);
      }
   }, [isGenerating, showOverlay]);

   return (
      <div className="relative w-full">
         {showOverlay && (
            <div className={`${styles.blurOverlay} ${isClearing ? styles.clearing : ''}`} />
         )}
         <StrategyCard
            strategy={mockStrategy}
            onEdit={() => { }}
            onDelete={() => { }}
            onToggleStatus={() => { }}
            variant="card"
         />
      </div>
   );
};

{/* 3. Analytics section removed as ListCard is deprecated */ }

// --- 主演示界面 ---
export const TestCardsPage: React.FC = () => {
   const isGeneratingStrategy = false;
   const [strategyKey, setStrategyKey] = useState(0);

   const handleRefreshStrategy = () => {
      setStrategyKey(prev => prev + 1);
   };

   return (
      <PageContainer>
         <div className={styles.container}>
            <header className={styles.header}>
               <div className={styles.statusBadge}>
                  <div className={styles.statusDot}></div>
                  <span>System Online</span>
               </div>
               <h1 className={styles.title}>
                  AI Agent <span className={styles.titleGradient}>Capabilities</span>
               </h1>
               <p className={styles.description}>
                  Modular interface components for automated DeFi operations. Designed for high information density and clarity.
               </p>
            </header>

            {/* Grid Layout */}
            <div className={styles.grid}>

               {/* 1. Execution */}
               <div className={styles.section}>
                  <SwapCardSection />
               </div>

               {/* 2. Automation */}
               <div className={styles.section}>
                  <div className="flex justify-between items-center w-full max-w-[320px] mb-4">
                     <span className={styles.sectionLabel}>Automation</span>
                     <button
                        onClick={handleRefreshStrategy}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors flex items-center gap-1"
                     >
                        <Zap size={12} /> Refresh
                     </button>
                  </div>

                  {/* Fluid Animation Wrapper */}
                  <div className="w-full max-w-[320px] flex flex-col items-start">
                     <div key={strategyKey} className={styles.animFluid}>
                        <div className={styles.cardContent}>
                           <StrategyCardWrapper isGenerating={isGeneratingStrategy} />
                        </div>
                     </div>
                  </div>
               </div>

               {/* 3. Launchpad */}
               <div className={styles.section}>
                  {/* Zora Section */}
                  <div className="flex justify-between items-center w-full max-w-[320px] mb-4">
                     <span className={styles.sectionLabel}>Launchpad (Zora)</span>
                  </div>
                  <div className="w-full max-w-[320px] flex flex-col items-start mb-8">
                     <LaunchpadCard
                        provider="zora"
                        tokenAddress="0x9b13358e3a023507e7046c18f508a958cda75f54"
                        chainId={8453}
                        platformName="Base"
                     />
                  </div>

                  {/* Clanker Section */}
                  <div className="w-full mt-8">
                     <span className={`${styles.sectionLabel} block mb-4`}>Launchpad (Clanker)</span>
                     <div className="w-full max-w-[320px]">
                        <LaunchpadCard
                           provider="clanker"
                           tokenAddress="0x611Cbc29d1a19408b3Ff414c0CF692AD2bfD9B07"
                           platformName="Base"
                        />
                     </div>
                  </div>

                  {/* Paragraph Section */}
                  <div className="w-full mt-8">
                     <span className={`${styles.sectionLabel} block mb-4`}>Launchpad (Paragraph)</span>
                     <div className="w-full max-w-[320px]">
                        <LaunchpadCard
                           provider="paragraph"
                           tokenAddress="0x06fc3d5d2369561e28f261148576520f5e49d6ea"
                           platformName="Base"
                        />
                     </div>
                  </div>
                  {/* Four.meme Section */}
                  <div className="w-full mt-8">
                     <span className={`${styles.sectionLabel} block mb-4`}>Launchpad (Four.meme)</span>
                     <div className="w-full max-w-[320px]">
                        <LaunchpadCard
                           provider="fourmeme"
                           tokenAddress="0x82Ec31D69b3c289E541b50E30681FD1ACAd24444"
                           platformName="BSC"
                        />
                     </div>
                  </div>
                  {/* Pump.fun Section */}
                  <div className="w-full mt-8">
                     <span className={`${styles.sectionLabel} block mb-4`}>Launchpad (Pump.fun)</span>
                     <div className="w-full max-w-[320px]">
                        <LaunchpadCard
                           provider="pumpfun"
                           tokenAddress="GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump"
                           platformName="Solana"
                        />
                     </div>
                  </div>
                  {/* BonkFun Section */}
                  <div className="w-full mt-8">
                     <span className={`${styles.sectionLabel} block mb-4`}>Launchpad (BonkFun)</span>
                     <div className="w-full max-w-[320px] flex flex-col gap-4">
                        {/* BonkFun Token (FRANKLIN) */}
                        <LaunchpadCard
                           provider="raydium"
                           tokenAddress="CkfVxeuaZjo9xLBwLKgv42nLZ2ChsuGSCucNeQ1cbonk"
                           chainId={101}
                           platformName="Solana"
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </PageContainer>
   );
};
