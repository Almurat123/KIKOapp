import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  ShieldCheck,
  ChevronRight,
  CircleDashed,
  ArrowUpRight,
  Sparkles,
  Layers
} from 'lucide-react';

const App = () => {
  const [status, setStatus] = useState('pending');
  const [step, setStep] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // 模拟数据初始加载
  useEffect(() => {
    const dataTimer = setTimeout(() => {
      setIsLoadingData(false);
    }, 3000);
    return () => clearTimeout(dataTimer);
  }, [status]);

  // 交易步骤
  const steps = [
    { label: "Preparing Transaction", sub: "Constructing payload...", icon: <Layers className="w-3.5 h-3.5 text-white/40" /> },
    { label: "Sending Transaction", sub: "Broadcasting to nodes...", icon: <ArrowUpRight className="w-3.5 h-3.5 text-white/40" /> },
    { label: "Checking Status", sub: "Waiting for confirmation...", icon: <ShieldCheck className="w-3.5 h-3.5 text-white/40" /> }
  ];

  useEffect(() => {
    const statusTimer = setInterval(() => {
      setStatus(s => s === 'pending' ? 'success' : 'pending');
      setStep(0); 
      setIsLoadingData(true);
    }, 15000); 

    return () => clearInterval(statusTimer);
  }, []);

  useEffect(() => {
    if (status === 'pending') {
      const stepTimer = setInterval(() => {
        setStep(s => (s + 1) % steps.length);
      }, 4000); 
      return () => clearInterval(stepTimer);
    }
  }, [status, steps.length]);

  return (
    <div className="min-h-screen bg-[#020202] text-white p-8 flex items-center justify-center font-sans tracking-tight">
      <div className="w-full max-w-md relative">
        {/* 背景光晕 */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/5 blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-600/5 blur-[100px] pointer-events-none"></div>

        <div className="relative group">
          {/* 极致毛玻璃卡片 */}
          <div className="bg-white/[0.02] backdrop-blur-[50px] border border-white/10 rounded-[32px] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-500">
            
            {/* 交易金额区域 */}
            <div className="flex flex-col gap-1 mb-10 mt-2">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold">Swap Amount</p>
                <p className="text-4xl font-light tracking-tighter italic leading-none">
                  1.250 <span className="text-white/10 text-xl not-italic ml-1 font-medium">ETH</span>
                </p>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent my-7"></div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold">Estimated Receive</p>
                {isLoadingData ? (
                  /* 极简骨架屏：呼吸感矩形 */
                  <div className="h-9 w-44 bg-white/[0.05] rounded-xl animate-pulse mt-1"></div>
                ) : (
                  <p className="text-4xl font-light tracking-tighter italic leading-none text-blue-400/80 animate-in fade-in zoom-in-95 duration-1000">
                    3,850.42 <span className="text-white/10 text-xl not-italic ml-1 font-medium">USDC</span>
                  </p>
                )}
              </div>
            </div>

            {/* 动态状态组件 */}
            <div className="relative">
              {status === 'pending' ? (
                <div className="py-4 px-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* 圆形图标容器 */}
                      <div className="w-8 h-8 flex items-center justify-center border border-white/5 rounded-full bg-white/[0.01]">
                        {steps[step].icon}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-white/70 tracking-wide">{steps[step].label}</p>
                        <p className="text-[10px] text-white/20 italic">{steps[step].sub}</p>
                      </div>
                    </div>
                    {/* 经典旋转 Loading */}
                    <CircleDashed className="w-4 h-4 text-white/20 animate-spin" />
                  </div>
                </div>
              ) : (
                <div className="py-4 px-1 animate-in fade-in slide-in-from-bottom-2 duration-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 flex items-center justify-center border border-emerald-500/20 rounded-full bg-emerald-500/5 text-emerald-500/80">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-emerald-500/80 tracking-wide">Success</p>
                        <p className="text-[10px] text-emerald-500/30 italic">On-chain confirmation complete.</p>
                      </div>
                    </div>
                    <Sparkles className="w-4 h-4 text-emerald-500/30 animate-pulse" />
                  </div>
                </div>
              )}
            </div>

            {/* 底部哈希值 */}
            <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] text-white/20 tracking-[0.1em] font-bold uppercase">
              <div className="flex items-center gap-2 hover:text-white/40 transition-colors cursor-pointer group/link">
                <span>View Hash</span>
                <ChevronRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
              </div>
              
              {isLoadingData ? (
                /* 哈希值骨架屏 */
                <div className="w-20 h-2.5 bg-white/[0.05] rounded-full animate-pulse"></div>
              ) : (
                <span className="font-mono opacity-30 animate-in fade-in duration-1000">0x72...9f2</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;