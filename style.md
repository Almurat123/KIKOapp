import React, { useState } from 'react';
import { 
  LayoutGrid, Search, Bell, Settings, Star, 
  TrendingUp, BarChart3, Scale, ChevronRight,
  Sun, Moon, Activity
} from 'lucide-react';

const CryptoDashboard = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 1. 顶部市场指标
  const marketMetrics = [
    { label: 'GLOBAL MARKET CAP', value: '$2.89T', change: '+1.2%', isUp: true },
    { label: '24H VOLUME', value: '$186.38B', change: '-5.4%', isUp: false },
    { label: 'TOTAL ACTIVE USERS', value: '19.0K', change: '+0.1%', isUp: true },
    { label: 'ETH GAS', value: '0.40 Gwei', status: 'Low', isUp: true },
  ];

  // 2. 热门涨幅 (Top Gainers)
  const topGainers = [
    { rank: 1, name: 'USDC', change: '+0.0%', isUp: true },
    { rank: 2, name: 'Tether', change: '-0.0%', isUp: false },
    { rank: 3, name: 'TRON', change: '-0.6%', isUp: false },
  ];

  // 3. 趋势代币 (Trending)
  const trendingList = [
    { rank: '#1', name: 'GMX', price: '$6.97', trend: 'M0,15 L20,10 L40,12 L60,5 L80,8 L100,2', color: 'stroke-rose-500' },
    { rank: '#2', name: 'Moltbook', price: '$0.00', trend: 'M0,10 L20,15 L40,8 L60,12 L80,5 L100,10', color: 'stroke-rose-500' },
    { rank: '#3', name: 'Moonbirds', price: '$0.25', trend: 'M0,12 L20,8 L40,10 L60,2 L80,5 L100,0', color: 'stroke-rose-500' },
  ];

  // 4. 宏观指标列表 (单色背景 + 彩色点缀)
  const macroIndicators = [
    { title: 'Fear & Greed Index', value: '50', total: '100', desc: 'Market is currently neutral.', badge: 'NEUTRAL', progress: 50, leftLabel: 'Fear', rightLabel: 'Greed', accent: 'bg-amber-500' },
    { title: 'Altcoin Season Index', value: '43', total: '100', desc: 'Market is in a neutral state.', badge: 'NEUTRAL', progress: 43, leftLabel: 'BTC Season', rightLabel: 'Alt Season', accent: 'bg-indigo-500' },
    { title: 'Bitcoin Dominance', value: '56.8', total: '100', desc: 'Market dominance is balanced.', badge: 'NORMAL', progress: 56.8, leftLabel: 'Low', rightLabel: 'High', accent: 'bg-blue-500' },
    { title: 'Perp Open Interest', value: '$48.80B', total: '', desc: 'Moderate perpetual trading activity.', badge: 'MODERATE', progress: 65, leftLabel: 'Low', rightLabel: 'High', accent: 'bg-emerald-500' },
  ];

  const theme = {
    bg: isDarkMode ? 'bg-black' : 'bg-zinc-50',
    container: isDarkMode ? 'bg-[#050505]' : 'bg-zinc-200',
    card: isDarkMode ? 'bg-black' : 'bg-white',
    textMain: isDarkMode ? 'text-white' : 'text-zinc-900',
    textSub: isDarkMode ? 'text-zinc-500' : 'text-zinc-400',
    textMuted: isDarkMode ? 'text-zinc-800' : 'text-zinc-300',
    border: isDarkMode ? 'border-zinc-900' : 'border-zinc-200',
    navBg: isDarkMode ? 'bg-black/80' : 'bg-white/80',
    gridLine: isDarkMode ? 'bg-zinc-900' : 'bg-zinc-200',
    innerCard: isDarkMode ? 'bg-zinc-950/50' : 'bg-white shadow-sm border-zinc-100',
  };

  return (
    <div className={`flex justify-center ${theme.container} min-h-screen p-0 sm:p-4 font-sans transition-colors duration-500`}>
      <div className={`w-full max-w-[440px] ${theme.bg} ${theme.textMain} flex flex-col min-h-[932px] border-x ${theme.border} shadow-2xl relative overflow-y-auto pb-32 transition-colors`}>
        
        {/* 顶部导航 */}
        <div className="pt-14 px-6 flex justify-between items-center mb-8">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-10 h-10 rounded-xl ${isDarkMode ? 'bg-zinc-900' : 'bg-white shadow-sm'} flex items-center justify-center border ${theme.border} transition-all active:scale-95`}
          >
            {isDarkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-indigo-600" />}
          </button>
          <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-white'} border flex items-center justify-center text-[10px] font-black tracking-tighter`}>
            <span className="text-emerald-500">●</span>
          </div>
        </div>

        {/* 1. 市场概览 (单色网格 + 极小彩色点缀) */}
        <div className="px-4 mb-10">
          <div className={`grid grid-cols-2 gap-px ${theme.gridLine} border ${theme.border} rounded-2xl overflow-hidden`}>
            {marketMetrics.map((item, i) => (
              <div key={i} className={`${theme.card} p-6 flex flex-col gap-2 relative`}>
                <span className={`text-[10px] font-black ${theme.textSub} tracking-[0.2em] uppercase`}>{item.label}</span>
                <div className="flex justify-between items-end">
                  <span className="text-xl font-bold tracking-tighter italic">{item.value}</span>
                  <span className={`text-[10px] font-black ${item.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {item.status || item.change}
                  </span>
                </div>
                {item.label === 'ETH GAS' && (
                  <div className="absolute top-3 right-3 w-1 h-1 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 2. Top Gainers Section */}
        <div className="px-4 mb-10">
          <div className="flex justify-between items-end mb-4 px-2">
            <h2 className={`text-[10px] font-black tracking-[0.3em] uppercase ${theme.textMuted}`}>Top Gainers</h2>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          <div className={`${theme.innerCard} border ${theme.border} p-4 rounded-3xl`}>
            <div className={`divide-y ${isDarkMode ? 'divide-zinc-900/50' : 'divide-zinc-100'}`}>
              {topGainers.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-4 first:pt-1 last:pb-1">
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-black ${theme.textMuted} w-4`}>{item.rank}</span>
                    <div className={`w-9 h-9 rounded-full ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50'} border ${theme.border} flex items-center justify-center text-[7px] font-black tracking-tighter uppercase relative`}>
                       Asset
                       <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 ${isDarkMode ? 'border-black' : 'border-white'} ${item.isUp ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    </div>
                    <span className="text-sm font-bold tracking-tight">{item.name}</span>
                  </div>
                  <span className={`text-xs font-black italic ${item.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>{item.change}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Trending Section */}
        <div className="px-4 mb-10">
          <div className="flex justify-between items-end mb-4 px-2">
            <h2 className={`text-[10px] font-black tracking-[0.3em] uppercase ${theme.textMuted}`}>Trending</h2>
            <Activity size={14} className="text-rose-500" />
          </div>
          <div className={`${theme.innerCard} border ${theme.border} p-4 rounded-3xl`}>
            <div className={`divide-y ${isDarkMode ? 'divide-zinc-900/50' : 'divide-zinc-100'}`}>
              {trendingList.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-4 first:pt-1 last:pb-1">
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-black ${theme.textMuted} w-4`}>{item.rank.replace('#','')}</span>
                    <div className={`w-9 h-9 rounded-full ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50'} border ${theme.border} flex items-center justify-center text-[7px] font-black tracking-tighter uppercase`}>Token</div>
                    <span className="text-sm font-bold tracking-tight">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <svg className="w-16 h-8" viewBox="0 0 100 20">
                      <path d={item.trend} fill="none" className={item.color} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="text-xs font-mono font-bold w-12 text-right">{item.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Macro Indicators Section (单色卡片 + 核心彩色游标) */}
        <div className="px-4 mb-12">
          <div className="flex justify-between items-end mb-4 px-2">
            <h2 className={`text-[10px] font-black tracking-[0.3em] uppercase ${theme.textMuted}`}>Macro Indicators</h2>
            <Scale size={14} className="text-indigo-500" />
          </div>
          <div className="space-y-4">
            {macroIndicators.map((indicator, idx) => (
              <div key={idx} className={`${theme.innerCard} border ${theme.border} p-6 rounded-[2rem] relative overflow-hidden`}>
                {/* 隐藏的彩色微光背景点缀 */}
                <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full blur-[40px] opacity-10 ${indicator.accent}`}></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xs font-black italic uppercase tracking-wider">{indicator.title}</h3>
                    <p className={`text-[9px] ${theme.textSub} font-medium mt-1 uppercase tracking-tight`}>{indicator.desc}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black italic">{indicator.value}</span>
                    {indicator.total && <span className={`text-[10px] ${theme.textMuted} font-bold ml-1 tracking-tighter`}>/ {indicator.total}</span>}
                  </div>
                </div>

                {/* 极简进度条 + 彩色点缀游标 */}
                <div className={`relative h-px w-full ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-200'} mb-2`}>
                   <div 
                    className={`absolute top-1/2 -translate-y-1/2 h-3 ${indicator.accent} z-10 transition-all duration-700 shadow-[0_0_8px_rgba(255,255,255,0.2)]`} 
                    style={{ left: `${indicator.progress}%`, width: '2px' }}
                   ></div>
                </div>

                <div className="flex justify-between mb-6">
                  <span className={`text-[8px] font-black ${theme.textMuted} uppercase tracking-widest`}>{indicator.leftLabel}</span>
                  <span className={`text-[8px] font-black ${theme.textMuted} uppercase tracking-widest`}>{indicator.rightLabel}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-600'} text-[9px] px-4 py-1.5 rounded-full font-black border tracking-tighter uppercase`}>
                    {indicator.badge}
                  </span>
                  <ChevronRight size={14} className={theme.textMuted} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部导航 */}
        <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] h-24 ${theme.navBg} backdrop-blur-xl border-t ${theme.border} px-12 flex justify-between items-center z-50`}>
          <LayoutGrid size={22} className={isDarkMode ? 'text-white' : 'text-zinc-900'} />
          <Search size={22} className={theme.textMuted} />
          <div className={`w-14 h-14 ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'} rounded-2xl flex items-center justify-center border shadow-sm relative group`}>
             <Star size={22} className={isDarkMode ? 'text-zinc-700' : 'text-zinc-400'} />
             <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
          </div>
          <Bell size={22} className={theme.textMuted} />
          <Settings size={22} className={theme.textMuted} />
        </nav>
      </div>
    </div>
  );
};

export default App = () => <CryptoDashboard />;