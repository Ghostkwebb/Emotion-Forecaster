"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ReferenceLine
} from "recharts";
import { AlertTriangle, Activity, Play, Info, Moon, Sun, RefreshCw, Pause, StepForward, GitBranch, Loader2, MousePointerClick, BarChart3, Hexagon, Zap, TrendingUp, Sparkles, Shield, Brain, Sliders, ArrowRight, Terminal, Database, ExternalLink, Target, ArrowDownRight, ArrowUpRight, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MarketForecasterDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [darkMode, setDarkMode] = useState(true);

  // === SANDBOX STATE ===
  const [price, setPrice] = useState(7126.06);
  const [sentiment, setSentiment] = useState(0.3);
  const [hype, setHype] = useState(500000);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [isFetchingForecast, setIsFetchingForecast] = useState(false);

  // === LIVE SYNC STATE ===
  const [liveSyncData, setLiveSyncData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [livePrice, setLivePrice] = useState(7126.06);
  const [liveSentiment, setLiveSentiment] = useState(0.3);
  const [liveHype, setLiveHype] = useState(500000);
  const [liveForecastData, setLiveForecastData] = useState<any[]>([]);
  const [isFetchingLiveForecast, setIsFetchingLiveForecast] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [chartKey, setChartKey] = useState(0);
  const [activeTab, setActiveTab] = useState("home");
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(true);
  const [isLiveControlsOpen, setIsLiveControlsOpen] = useState(true);

  const [radarAlerts, setRadarAlerts] = useState<{ day: string, z: number, type: string }[]>([]);
  const [flashDanger, setFlashDanger] = useState(false);
  const [narrative, setNarrative] = useState<{ date: string, text: string, upvotes: number } | null>(null);

  const runForecastSimulation = async () => {
    setIsFetchingForecast(true);
    setChartKey(prev => prev + 1);
    try {
      setError(null);
      const res = await fetch("https://hive-backend-yp5d.onrender.com/forecast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_price: price, current_sentiment: sentiment, current_hype_volume: hype, days_to_forecast: 30 }),
      });
      if (!res.ok) throw new Error("Forecast API fail");
      const data = await res.json();
      setForecastData(data.forecast);
    } catch (err) { setError("API Offline"); } finally { setIsFetchingForecast(false); }
  };

  const runLiveForecastSimulation = async () => {
    setIsFetchingLiveForecast(true);
    setChartKey(prev => prev + 1);
    try {
      setError(null);
      const res = await fetch("https://hive-backend-yp5d.onrender.com/forecast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_price: livePrice, current_sentiment: liveSentiment, current_hype_volume: liveHype, days_to_forecast: 30 }),
      });
      if (!res.ok) throw new Error("Forecast API fail");
      const data = await res.json();
      setLiveForecastData(data.forecast);
    } catch (err) { setError("API Offline"); } finally { setIsFetchingLiveForecast(false); }
  };

  const initiateLiveSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("https://hive-backend-yp5d.onrender.com/live-sync");
      if (!res.ok) throw new Error("Failed to sync");
      const data = await res.json();
      setLiveSyncData(data);
      setLivePrice(data.latest_actual_price);
      setLiveSentiment(data.live_sentiment_score);
      setTimeout(() => runLiveForecastSimulation(), 500);
    } catch (err) { setError("Live Sync Failed."); } finally { setIsSyncing(false); }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("https://hive-backend-yp5d.onrender.com/simulation-data");
        if (res.ok) {
          const data = await res.json();
          setHistoryData(data.simulation_data);
        }
      } catch (err) { console.error(err); }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    if (isPlayingHistory && historyIndex < historyData.length - 1) {
      const timer = setTimeout(() => setHistoryIndex((prev) => prev + 1), 120);
      return () => clearTimeout(timer);
    } else setIsPlayingHistory(false);
  }, [isPlayingHistory, historyIndex, historyData]);

  useEffect(() => {
    if (activeTab !== "history" || historyData.length === 0) return;
    const current = historyData[historyIndex];
    if (!current) return;

    const isFear = current.anomaly_status === "CRITICAL_FEAR" || current.z_score <= -1.5;
    const isHype = current.anomaly_status === "EXTREME_HYPE" || current.z_score >= 1.5;

    if (isFear) {
      setRadarAlerts(prev => { if (prev.some(a => a.day === current.date)) return prev; return [{ day: current.date, z: current.z_score, type: "fear" }, ...prev]; });
      setFlashDanger(true); setTimeout(() => setFlashDanger(false), 400);
    } else if (isHype) {
      setRadarAlerts(prev => { if (prev.some(a => a.day === current.date)) return prev; return [{ day: current.date, z: current.z_score, type: "hype" }, ...prev]; });
    }
  }, [historyIndex, historyData, activeTab]);

  const combinedChartData = useMemo(() => {
    const data = [];
    let pastPrices = [];
    if (historyData.length > 0 && liveSyncData?.root_cause_headline === historyData[historyIndex]?.root_cause_text) {
      pastPrices = historyData.slice(Math.max(0, historyIndex - 30), historyIndex).map(d => d.actual_price);
    } else {
      let tempPrice = price;
      for (let i = 0; i < 30; i++) { pastPrices.unshift(tempPrice); tempPrice = tempPrice * (1 + (Math.random() * 0.02 - 0.01)); }
    }
    pastPrices.forEach((p, i) => data.push({ day: i - pastPrices.length, past_price: p }));
    data.push({ day: 0, past_price: price, likely_price: price, uncertainty: [price, price] });
    if (forecastData.length > 0) forecastData.forEach((d, i) => data.push({ day: i + 1, likely_price: d.likely_price, uncertainty: [d.lower_bound, d.upper_bound] }));
    return data;
  }, [forecastData, historyData, historyIndex, price, liveSyncData]);

  const liveCombinedChartData = useMemo(() => {
    const data = [];
    let pastPrices = [];
    const backendHistory = liveSyncData?.historical_prices || liveSyncData?.past_prices || liveSyncData?.history;
    if (backendHistory && Array.isArray(backendHistory)) pastPrices = backendHistory;
    else {
      let tempPrice = livePrice;
      for (let i = 0; i < 30; i++) { pastPrices.unshift(tempPrice); tempPrice = tempPrice * (1 + (Math.random() * 0.02 - 0.01)); }
    }
    pastPrices.forEach((p, i) => data.push({ day: i - pastPrices.length, past_price: p }));
    data.push({ day: 0, past_price: livePrice, likely_price: livePrice, uncertainty: [livePrice, livePrice] });
    if (liveForecastData.length > 0) liveForecastData.forEach((d, i) => data.push({ day: i + 1, likely_price: d.likely_price, uncertainty: [d.lower_bound, d.upper_bound] }));
    return data;
  }, [liveForecastData, liveSyncData, livePrice]);

  const handleThemeToggle = (e: React.MouseEvent) => {
    const nextIsDark = !darkMode;
    if (!document.startViewTransition) { setDarkMode(nextIsDark); return; }
    const x = e.clientX, y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => setDarkMode(nextIsDark));
    transition.ready.then(() => {
      document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] }, { duration: 500, easing: "ease-out", pseudoElement: "::view-transition-new(root)" });
    });
  };

  const getAxisBounds = (data: any[]) => {
    const allPrices = data.flatMap(d => [d.past_price, d.likely_price, d.uncertainty?.[0], d.uncertainty?.[1]].filter(Boolean));
    return { min: allPrices.length > 0 ? Math.floor(Math.min(...allPrices) * 0.98) : 3000, max: allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) * 1.02) : 6000 };
  };

  const sbBounds = getAxisBounds(combinedChartData);
  const liveBounds = getAxisBounds(liveCombinedChartData);

  const handleChartClick = React.useCallback((data: any) => {
    if (!data) return;
    let p = data?.activePayload?.[0]?.payload || data?.payload || data;
    if (p && p.root_cause_text) setNarrative({ date: p.date, text: p.root_cause_text, upvotes: p.root_cause_upvotes || 0 });
  }, []);

  const branchToSandbox = () => {
    const current = historyData[historyIndex];
    if (current) { setPrice(current.actual_price); setSentiment(current.sentiment_score); }
    setIsPlayingHistory(false); setActiveTab("sandbox");
    setTimeout(() => runForecastSimulation(), 500);
  };

  const containerVariants: any = React.useMemo(() => ({ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }), []);
  const itemVariants: any = React.useMemo(() => ({ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 15 } } }), []);

  const CustomRadarTooltip = React.useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) return (
      <div className={`px-3 py-2 rounded-xl shadow-lg border ${darkMode ? "bg-[#0F172A] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
        <p className="font-bold text-sm">{payload[0].payload.subject}</p>
        <p className="text-xs">Sentiment: <span className={payload[0].payload.raw >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}>{payload[0].payload.raw > 0 ? "+" : ""}{payload[0].payload.raw.toFixed(2)}</span></p>
      </div>
    );
    return null;
  }, [darkMode]);

  const Card = React.useCallback(({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <motion.div variants={itemVariants} className={`rounded-[32px] p-6 shadow-sm relative overflow-hidden transition-colors ${darkMode ? "bg-[#111318] border border-white/5 shadow-black/50" : "bg-white border border-slate-200 shadow-slate-200/50"} ${className}`}>{children}</motion.div>
  ), [darkMode, itemVariants]);

  if (!isMounted) return null;

  const currentFrame = historyData[historyIndex] || {};
  const normalizeForRadar = (val: number) => ((val || 0) + 1) * 50;

  const megaCapRadarData = [
    { subject: 'Apple', value: normalizeForRadar(currentFrame.apple_sentiment), raw: currentFrame.apple_sentiment || 0 },
    { subject: 'Tesla', value: normalizeForRadar(currentFrame.tesla_sentiment), raw: currentFrame.tesla_sentiment || 0 },
    { subject: 'Microsoft', value: normalizeForRadar(currentFrame.microsoft_sentiment), raw: currentFrame.microsoft_sentiment || 0 },
    { subject: 'Nvidia', value: normalizeForRadar(currentFrame.nvidia_sentiment), raw: currentFrame.nvidia_sentiment || 0 },
    { subject: 'Amazon', value: normalizeForRadar(currentFrame.amazon_sentiment), raw: currentFrame.amazon_sentiment || 0 },
  ];

  const sectorRadarData = [
    { subject: 'Technology', value: normalizeForRadar(currentFrame.tech_sector), raw: currentFrame.tech_sector || 0 },
    { subject: 'EV & Auto', value: normalizeForRadar(currentFrame.ev_sector), raw: currentFrame.ev_sector || 0 },
    { subject: 'Finance', value: normalizeForRadar(currentFrame.finance_sector), raw: currentFrame.finance_sector || 0 },
    { subject: 'Meme Stocks', value: normalizeForRadar(currentFrame.meme_sector), raw: currentFrame.meme_sector || 0 },
  ];

  const tickerString = currentFrame.date
    ? `H.I.V.E. LIVE SYNC • TSLA SENTIMENT: ${currentFrame.tesla_sentiment > 0 ? "+" : ""}${(currentFrame.tesla_sentiment || 0).toFixed(2)} (${currentFrame.tesla_sentiment > 0 ? 'HYPE' : 'COOLING'}) • AAPL SENTIMENT: ${currentFrame.apple_sentiment > 0 ? "+" : ""}${(currentFrame.apple_sentiment || 0).toFixed(2)} • MEME SECTOR RADAR: ${currentFrame.anomaly_status || "NORMAL"} • SPY PROJECTION: ${forecastData[29]?.likely_price > price ? "BULLISH" : "BEARISH"} `
    : `H.I.V.E. LIVE SYNC • TSLA SENTIMENT: +0.81 (HYPE) • AAPL SENTIMENT: -0.21 (COOLING) • MEME SECTOR RADAR: NORMAL • ESTABLISHING SECURE CONNECTION TO DATA STREAM... `;

  const dynamicBgSandbox = sentiment > 0 ? `radial-gradient(circle at 50% 100%, rgba(0, 255, 136, ${Math.abs(sentiment) * 0.15}), transparent 70%)` : `radial-gradient(circle at 50% 100%, rgba(255, 51, 102, ${Math.abs(sentiment) * 0.15}), transparent 70%)`;
  const dynamicBgLive = liveSentiment > 0 ? `radial-gradient(circle at 50% 100%, rgba(0, 255, 136, ${Math.abs(liveSentiment) * 0.15}), transparent 70%)` : `radial-gradient(circle at 50% 100%, rgba(255, 51, 102, ${Math.abs(liveSentiment) * 0.15}), transparent 70%)`;

  return (
    <div className={`xl:h-screen min-h-screen flex flex-col font-sans transition-colors duration-500 xl:overflow-hidden relative ${darkMode ? "bg-[#050608] text-slate-100" : "bg-[#F3F4F6] text-slate-900"}`}>
      {activeTab === "sandbox" && <div className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out z-0" style={{ background: dynamicBgSandbox }}></div>}
      {activeTab === "live" && <div className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out z-0" style={{ background: dynamicBgLive }}></div>}
      <style dangerouslySetInnerHTML={{ __html: `::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; } @keyframes infinite-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } .animate-marquee { animation: infinite-scroll 25s linear infinite; }` }} />
      <svg className="w-0 h-0 absolute"><defs><filter id="neonGlowPurple" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter><filter id="neonGlowBlue" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter></defs></svg>

      <div className={`shrink-0 w-full overflow-hidden border-b flex whitespace-nowrap py-1.5 relative z-50 ${darkMode ? "bg-[#0A0C10] border-white/5 text-[#00FF88]" : "bg-slate-900 border-black text-[#00FF88]"}`}>
        <div className="animate-marquee flex w-max text-[10px] md:text-xs font-mono font-bold tracking-widest"><span className="mx-8">{tickerString}</span><span className="mx-8">{tickerString}</span><span className="mx-8">{tickerString}</span><span className="mx-8">{tickerString}</span></div>
      </div>

      <div className="p-3 md:p-5 max-w-[1600px] mx-auto w-full flex-1 flex flex-col xl:min-h-0 relative z-10 gap-3">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-10 h-10 relative flex items-center justify-center"><img src="/HIVE.png" alt="Pulse AI" className="w-full h-full object-contain rounded-xl" /><span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF88] opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-[#00FF88] border-2 border-[#050608]"></span></span></div>
            <div className="flex flex-col"><h1 className={`text-xl font-extrabold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>H.I.V.E.</h1><div className="flex items-center space-x-2"><div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${darkMode ? "bg-[#1A1D24] text-slate-400 border border-white/5" : "bg-slate-200 text-slate-500"}`}>Quantile Engine</div><div className="flex items-center text-[8px] font-bold text-[#00FF88] uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] mr-1"></span> Live Sync</div></div></div>
          </div>
          <div className={`flex items-center p-1 rounded-full relative shadow-sm transition-colors ${darkMode ? "bg-[#111318] border border-white/5" : "bg-white border border-slate-200"}`}>
            <div className="flex relative">
              {['home', 'history', 'sandbox', 'live'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`relative px-3 md:px-5 py-1.5 rounded-full text-xs font-bold transition-all z-10 ${activeTab === tab ? (darkMode ? "text-white" : "text-slate-900") : (darkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700")}`}>
                  {activeTab === tab && <motion.div layoutId="activeTab" className={`absolute inset-0 rounded-full shadow-sm -z-10 ${darkMode ? "bg-[#1A1D24] border border-white/5" : "bg-slate-100"}`} transition={{ type: "spring", stiffness: 300, damping: 25 }} />}
                  {tab === 'home' ? 'Overview' : tab === 'history' ? 'History' : tab === 'sandbox' ? 'Sandbox' : 'Live Sync'}
                </button>
              ))}
            </div>
            <div className={`w-px h-4 mx-2 ${darkMode ? "bg-white/10" : "bg-slate-200"}`}></div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={handleThemeToggle} className={`relative w-7 h-7 flex items-center justify-center rounded-full transition-colors focus:outline-none ${darkMode ? "hover:bg-[#1A1D24] text-[#FCAF45]" : "hover:bg-slate-100 text-slate-600"}`}>
              <AnimatePresence mode="wait" initial={false}><motion.div key={darkMode ? "dark" : "light"} initial={{ opacity: 0, rotate: -90, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.5 }} transition={{ duration: 0.15 }} className="absolute">{darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}</motion.div></AnimatePresence>
            </motion.button>
          </div>
        </motion.div>

        {error && <div className="shrink-0 p-3 bg-[#FF3366]/10 border border-[#FF3366]/30 text-[#FF3366] text-sm rounded-xl shadow-sm font-semibold">{error}</div>}

        <AnimatePresence>{flashDanger && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none z-50 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#FF3366]/20 to-transparent" />}</AnimatePresence>
        <AnimatePresence>
          {narrative && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setNarrative(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} className={`w-full max-w-lg p-8 rounded-[32px] shadow-2xl border ${darkMode ? "bg-[#111318] border-white/10" : "bg-white border-slate-200"}`}>
                <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-[#7209B7] to-[#4361EE] flex items-center justify-center mb-6 shadow-lg"><Info className="w-7 h-7 text-white" /></div>
                <h3 className="text-2xl font-bold mb-2">AI Root Cause Analysis</h3><p className={`text-sm mb-6 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>The social narrative driving the market logic.</p>
                <div className={`p-6 rounded-[24px] border border-white/5 mb-6 relative overflow-hidden ${darkMode ? "bg-[#1A1D24]" : "bg-slate-50"}`}><div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#7209B7] to-[#4361EE]"></div><p className={`italic leading-relaxed ${darkMode ? "text-slate-200" : "text-slate-800"}`}>"{narrative.text}"</p></div>
                <div className={`flex justify-between items-center text-sm font-bold px-2 ${darkMode ? "text-slate-400" : "text-slate-500"}`}><span>{narrative.date}</span><span className="flex items-center text-[#FCAF45] bg-[#FCAF45]/10 px-4 py-1.5 rounded-full border border-[#FCAF45]/20">🔥 {narrative.upvotes} Upvotes</span></div>
                <button onClick={() => setNarrative(null)} className={`mt-8 w-full py-4 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-95 ${darkMode ? "bg-white text-black" : "bg-slate-900 text-white"}`}>Acknowledge</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="flex-1 xl:min-h-0 relative w-full flex flex-col">
          {/* ================= TAB 0: HOME ================= */}
          {activeTab === "home" && (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col h-full xl:overflow-y-auto pb-20 scrollbar-hide pr-2">
              <div className="relative w-full flex flex-col items-center text-center py-12 md:py-20 mb-12 shrink-0">
                <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none"><div className={`w-[250px] h-[250px] md:w-[400px] md:h-[400px] rounded-full blur-[100px] md:blur-[150px] ${darkMode ? "bg-[#7209B7]/20" : "bg-[#4361EE]/10"}`}></div></div>
                <img src="/HIVE.png" className="w-20 h-20 md:w-28 md:h-28 mb-6 drop-shadow-[0_0_30px_rgba(114,9,183,0.5)] animate-pulse" alt="HIVE Logo" />
                <h1 className={`text-5xl md:text-7xl font-black mb-3 tracking-tighter bg-clip-text text-transparent ${darkMode ? "bg-gradient-to-b from-white to-slate-400" : "bg-gradient-to-b from-slate-900 to-slate-500"}`}>H.I.V.E.</h1>
                <h2 className="text-lg md:text-2xl font-bold text-[#4361EE] mb-6">Heuristic Internet Volatility Engine</h2>
                <p className={`text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Institutional market forecasting driven entirely by the chaotic speed of internet sentiment.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full px-4">
                  <button onClick={() => setActiveTab('history')} className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center bg-gradient-to-r from-[#7209B7] to-[#4361EE] text-white hover:shadow-[0_8px_30px_-6px_rgba(67,97,238,0.5)] transition-all active:scale-95 text-base"><Play className="w-4 h-4 mr-2 fill-current" /> 2021 Simulation</button>
                  <button onClick={() => setActiveTab('sandbox')} className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center border-2 transition-all active:scale-95 text-base ${darkMode ? "border-white/10 hover:border-white/20 bg-[#111318] text-white" : "border-slate-300 hover:border-slate-400 bg-white text-slate-900"}`}><Sliders className="w-4 h-4 mr-2" /> Live Sandbox</button>
                </div>
              </div>
              <Card className={`text-center py-12 mb-16 max-w-4xl mx-auto border-t-4 border-t-[#FF3366] shrink-0 ${darkMode ? "bg-gradient-to-b from-[#1A1D24] to-transparent" : "bg-gradient-to-b from-slate-100 to-transparent"}`}>
                <h3 className="text-2xl md:text-3xl font-black text-[#FF3366] mb-4">Traditional math failed in 2021. Sentiment took over.</h3>
                <p className={`text-base md:text-lg leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-700"}`}>When millions of retail investors mobilized online, Wall Street hedge funds were blindsided. Standard financial models simply cannot predict social media hype. H.I.V.E. exists to translate the chaos of the internet into quantifiable, actionable risk metrics.</p>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 shrink-0">
                <Card className={`group hover:-translate-y-1 transition-all duration-300 ${darkMode ? "bg-[#111318]" : "bg-white"}`}><div className="w-12 h-12 rounded-xl bg-[#FF3366]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Shield className="w-6 h-6 text-[#FF3366]" /></div><h4 className="text-lg font-bold mb-2">Early Warning Radar</h4><p className={`text-sm leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Don't wait for the crash. Our Z-Score anomaly detector continuously scans Reddit, flagging 'Critical Fear' and 'Extreme Hype' days before the broader market reacts.</p></Card>
                <Card className={`group hover:-translate-y-1 transition-all duration-300 ${darkMode ? "bg-[#111318]" : "bg-white"}`}><div className="w-12 h-12 rounded-xl bg-[#00FF88]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Brain className="w-6 h-6 text-[#00FF88]" /></div><h4 className="text-lg font-bold mb-2">Root Cause XAI</h4><p className={`text-sm leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>No black boxes. Click any market anomaly spike on our timeline to instantly reveal the exact social media narrative (and raw post) that drove the volatility.</p></Card>
                <Card className={`group hover:-translate-y-1 transition-all duration-300 ${darkMode ? "bg-[#111318]" : "bg-white"}`}><div className="w-12 h-12 rounded-xl bg-[#4361EE]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Database className="w-6 h-6 text-[#4361EE]" /></div><h4 className="text-lg font-bold mb-2">Live ETL Pipeline</h4><p className={`text-sm leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Instantly sync with live market data. Generate quantile-bounded 30-day forward projections and stress-test your portfolio against Black Swan internet events.</p></Card>
              </div>
              <div className="mb-12 flex flex-col items-center shrink-0">
                <h3 className="text-xl font-bold mb-8 text-center">Powered by Institutional-Grade Architecture</h3>
                <div className="flex flex-col md:flex-row flex-wrap items-center justify-center gap-3 text-xs font-mono font-bold text-center">
                  <div className={`px-4 py-3 rounded-xl border shadow-sm ${darkMode ? "bg-[#1A1D24] text-slate-300 border-white/5" : "bg-white text-slate-700 border-slate-200"}`}>53k Raw Posts</div><ArrowRight className="w-5 h-5 text-[#4361EE] hidden md:block" />
                  <div className={`px-4 py-3 rounded-xl border shadow-sm ${darkMode ? "bg-[#1A1D24] text-slate-300 border-white/5" : "bg-white text-slate-700 border-slate-200"}`}>VADER NLP</div><ArrowRight className="w-5 h-5 text-[#4361EE] hidden md:block" />
                  <div className={`px-4 py-3 rounded-xl border shadow-sm ${darkMode ? "bg-[#1A1D24] text-slate-300 border-white/5" : "bg-white text-slate-700 border-slate-200"}`}>Quantile Regression</div><ArrowRight className="w-5 h-5 text-[#4361EE] hidden md:block" />
                  <div className={`px-4 py-3 rounded-xl border shadow-sm ${darkMode ? "bg-[#1A1D24] text-slate-300 border-white/5" : "bg-white text-slate-700 border-slate-200"}`}>FastAPI Backend</div><ArrowRight className="w-5 h-5 text-[#4361EE] hidden md:block" />
                  <div className={`px-4 py-3 rounded-xl border-2 shadow-md ${darkMode ? "bg-[#4361EE]/10 text-[#4361EE] border-[#4361EE]/50" : "bg-blue-50 text-blue-700 border-blue-300"}`}>Next.js UI</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= TAB 1: HISTORY ================= */}
          {activeTab === "history" && (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="xl:h-full flex flex-col xl:grid xl:grid-cols-12 gap-3">
              <div className="xl:col-span-8 flex flex-col gap-3 xl:min-h-0">
                <Card className="xl:flex-[5] min-h-[300px] xl:min-h-0 flex flex-col !p-4">
                  <div className="flex justify-between items-center mb-2"><div><h2 className="text-base font-bold">2021 Meme-Stock Simulation</h2><p className={`text-[10px] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Click lines for Root Cause XAI.</p></div></div>
                  <div className="w-full flex-1 xl:min-h-0 min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={historyData.slice(0, historyIndex + 1)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={handleChartClick} className="cursor-pointer">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#2A2E37" : "#e2e8f0"} opacity={0.6} />
                        <XAxis dataKey="date" tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} tickMargin={6} />
                        <YAxis domain={['auto', 'auto']} tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 9 }} tickFormatter={(t) => `$${t}`} axisLine={false} tickLine={false} />
                        <RechartsTooltip contentStyle={{ backgroundColor: darkMode ? 'rgba(17, 19, 24, 0.9)' : 'rgba(255, 255, 255, 0.9)', backdropFilter: "blur(12px)", borderColor: darkMode ? '#2A2E37' : '#e2e8f0', borderRadius: "12px", color: darkMode ? '#fff' : '#000', padding: "8px" }} itemStyle={{ fontWeight: 600, fontSize: "12px" }} />
                        <Legend verticalAlign="top" height={24} iconType="circle" formatter={(v) => <span className={`font-semibold ml-1 text-[10px] ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{v}</span>} />
                        <Line type="monotone" dataKey="actual_price" stroke={darkMode ? "#475569" : "#94a3b8"} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: darkMode ? "#475569" : "#94a3b8", strokeWidth: 0, cursor: "pointer", onClick: (e: any, p: any) => handleChartClick(p) }} name="Actual Market" isAnimationActive={!isPlayingHistory} animationDuration={300} />
                        <Line type="monotone" dataKey="predicted_likely" stroke="#7209B7" filter={darkMode ? "url(#neonGlowPurple)" : ""} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#7209B7", strokeWidth: 0, cursor: "pointer", onClick: (e: any, p: any) => handleChartClick(p) }} name="AI Prediction" isAnimationActive={!isPlayingHistory} animationDuration={300} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <div className="xl:flex-[4] grid grid-cols-1 md:grid-cols-2 gap-3 xl:min-h-0">
                  <Card className={`flex flex-col h-full !p-3 xl:min-h-0 ${darkMode ? "bg-gradient-to-br from-[#111318] to-[#1A1D24]" : "bg-gradient-to-br from-white to-slate-50"}`}>
                    <h3 className="text-[11px] font-bold flex items-center mb-1"><BarChart3 className="w-3.5 h-3.5 mr-1 text-[#4CC9F0]" /> Sector Tug-of-War</h3>
                    <div className="flex-1 w-full relative -mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={sectorRadarData}>
                          <PolarGrid stroke={darkMode ? "#2A2E37" : "#e2e8f0"} />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 8, fontWeight: 700 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <RechartsTooltip content={<CustomRadarTooltip />} />
                          <Radar name="Sector" dataKey="value" stroke="#4CC9F0" strokeWidth={2} fill="#4CC9F0" fillOpacity={0.3} isAnimationActive={false} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <Card className={`flex flex-col h-full !p-3 xl:min-h-0 ${darkMode ? "bg-gradient-to-bl from-[#111318] to-[#1A1D24]" : "bg-gradient-to-bl from-white to-slate-50"}`}>
                    <h3 className="text-[11px] font-bold flex items-center mb-1"><Hexagon className="w-3.5 h-3.5 mr-1 text-[#FCAF45]" /> Mega-Cap Heatmap</h3>
                    <div className="flex-1 w-full relative -mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={megaCapRadarData}>
                          <PolarGrid stroke={darkMode ? "#2A2E37" : "#e2e8f0"} />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 8, fontWeight: 700 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <RechartsTooltip content={<CustomRadarTooltip />} />
                          <Radar name="MegaCap" dataKey="value" stroke="#FCAF45" strokeWidth={2} fill="#FCAF45" fillOpacity={0.3} isAnimationActive={false} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>
              <div className="xl:col-span-4 flex flex-col gap-3 xl:min-h-0">
                <Card className="shrink-0 !p-4 flex flex-col gap-3">
                  <div className="flex space-x-2">
                    <button onClick={() => setIsPlayingHistory(!isPlayingHistory)} className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center transition-all shadow-sm text-[11px] ${darkMode ? "bg-white text-black hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"}`}>{isPlayingHistory ? <><Pause className="w-3.5 h-3.5 mr-1" /> Pause</> : <><Play className="w-3.5 h-3.5 mr-1" /> Play Timeline</>}</button>
                    <button onClick={() => setHistoryIndex((p) => Math.min(p + 1, historyData.length - 1))} className={`px-4 py-2.5 rounded-xl flex items-center transition-all ${darkMode ? "bg-[#1A1D24] hover:bg-[#2A2E37] border border-white/5" : "bg-slate-100 hover:bg-slate-200"}`}><StepForward className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className={`p-3 rounded-xl relative overflow-hidden ${darkMode ? "bg-[#1A1D24] border border-white/5" : "bg-slate-50 border border-slate-200"}`}>
                    <div className="grid grid-cols-2 gap-y-3 relative z-10">
                      <div><p className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Date</p><p className="font-mono font-bold text-[11px]">{currentFrame.date || "--"}</p></div>
                      <div><p className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Market Price</p><p className="font-mono font-bold text-[11px]">${currentFrame.actual_price || "--"}</p></div>
                      <div><p className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Sentiment</p><p className={`font-mono font-bold text-[11px] ${currentFrame.sentiment_score >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}`}>{currentFrame.sentiment_score > 0 ? "+" : ""}{currentFrame.sentiment_score || "--"}</p></div>
                      <div><p className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Anomaly Z-Score</p><p className="font-mono font-bold text-[11px]">{currentFrame.z_score || "--"}</p></div>
                    </div>
                  </div>
                  <button onClick={branchToSandbox} className="w-full py-3 mt-1 rounded-xl text-xs font-bold flex items-center justify-center bg-gradient-to-r from-[#7209B7] to-[#4361EE] text-white hover:shadow-[0_8px_20px_-6px_rgba(67,97,238,0.4)] hover:-translate-y-0.5 transition-all active:scale-95"><GitBranch className="w-4 h-4 mr-2" /> Branch to Sandbox</button>
                </Card>
                <Card className="h-[260px] shrink-0 flex flex-col p-0 overflow-hidden border border-[#FF3366]/20">
                  <div className={`p-4 border-b shrink-0 ${darkMode ? "border-white/5 bg-[#1A1D24]" : "border-slate-100 bg-slate-50"}`}>
                    <h3 className="text-xs font-bold flex items-center"><Activity className="w-4 h-4 mr-1.5 text-[#FF3366]" /> Live Radar Feed</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {radarAlerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-40"><Zap className={`w-6 h-6 mb-2 ${darkMode ? "text-slate-600" : "text-slate-400"}`} /><p className="text-xs font-bold">Scanning anomalies...</p></div>
                    ) : (
                      <AnimatePresence>
                        {radarAlerts.map((alert, i) => (
                          <motion.div key={`${alert.day}-${i}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className={`p-3 text-xs rounded-xl border ${alert.type === 'fear' ? (darkMode ? "bg-[#FF3366]/10 border-[#FF3366]/30 text-red-200" : "bg-red-50 border-red-200 text-[#FF3366]") : (darkMode ? "bg-[#00FF88]/10 border-[#00FF88]/30 text-green-200" : "bg-green-50 border-green-200 text-green-700")}`}>
                            <div className="flex items-center mb-1 font-bold"><AlertTriangle className="w-3 h-3 mr-1.5" /> RADAR ALERT</div><p className="opacity-90">{alert.type === 'fear' ? 'Market Panic' : 'Extreme Euphoria'} (Z: {alert.z}).</p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {/* ================= TAB 2: PURE SANDBOX ================= */}
          {activeTab === "sandbox" && (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col h-full relative z-10">
              <Card className="flex-1 min-h-[400px] xl:min-h-0 flex flex-col !p-4 relative">
                <div className="flex justify-between items-center mb-2"><h2 className="text-[13px] font-bold flex items-center"><TrendingUp className="w-4 h-4 mr-1 text-[#4361EE]" /> Scenario Stress-Tester</h2>{isFetchingForecast && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4361EE]" />}</div>
                <div className={`w-full flex-1 xl:min-h-0 transition-opacity duration-300 ${isFetchingForecast ? "opacity-50" : "opacity-100"}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart key={chartKey} data={combinedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="colorUncertainty" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4361EE" stopOpacity={darkMode ? 0.4 : 0.2} /><stop offset="95%" stopColor={darkMode ? "#4361EE" : "#4361EE"} stopOpacity={0.0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#2A2E37" : "#e2e8f0"} opacity={0.6} />
                      <XAxis dataKey="day" type="number" domain={['dataMin', 'dataMax']} tickCount={7} tickFormatter={(t) => t === 0 ? "TODAY" : t > 0 ? `+${t}` : `${t}`} tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 9, fontWeight: "bold" }} axisLine={false} tickLine={false} tickMargin={6} />
                      <YAxis domain={[sbBounds.min, sbBounds.max]} tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 9 }} tickFormatter={(t) => `$${t}`} axisLine={false} tickLine={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: darkMode ? 'rgba(17, 19, 24, 0.9)' : 'rgba(255, 255, 255, 0.9)', backdropFilter: "blur(12px)", borderColor: darkMode ? '#2A2E37' : '#e2e8f0', borderRadius: "12px", color: darkMode ? '#fff' : '#000', padding: "8px" }} formatter={(value: any, name: any) => [Array.isArray(value) ? `[$${value[0].toFixed(2)}, $${value[1].toFixed(2)}]` : `$${value.toFixed(2)}`, name.replace("_", " ")]} labelFormatter={(label) => label === 0 ? "TODAY" : label > 0 ? `Day +${label} (Forecast)` : `Day ${label} (Historical)`} itemStyle={{ fontWeight: 600, textTransform: "capitalize", fontSize: "11px" }} />
                      <Legend verticalAlign="top" height={30} iconType="circle" formatter={(v) => <span className={`font-semibold ml-1 capitalize text-xs ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{v.replace("_", " ")}</span>} />
                      <ReferenceLine x={0} stroke={darkMode ? "#94a3b8" : "#64748b"} strokeDasharray="4 4" label={{ position: 'top', value: 'TODAY', fill: darkMode ? '#fff' : '#000', fontSize: 9, fontWeight: 'bold' }} />
                      <Line type="monotone" dataKey="past_price" stroke={darkMode ? "#475569" : "#94a3b8"} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: darkMode ? "#475569" : "#94a3b8", strokeWidth: 0 }} name="Past 30 Days" isAnimationActive={false} />
                      <Area type="monotone" dataKey="uncertainty" stroke="none" fill="url(#colorUncertainty)" name="90% Bounds" isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                      <Line type="monotone" dataKey="likely_price" stroke="#4361EE" filter={darkMode ? "url(#neonGlowBlue)" : ""} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#4361EE", strokeWidth: 0 }} name="Forecast" isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <motion.div animate={{ height: isControlsOpen ? "auto" : "52px" }} className={`hidden md:flex flex-col w-[300px] absolute top-4 right-4 z-10 rounded-2xl border backdrop-blur-xl shadow-2xl overflow-hidden ${darkMode ? "bg-[#111318]/90 border-white/10" : "bg-white/90 border-slate-200"}`}>
                  <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0" onClick={() => setIsControlsOpen(!isControlsOpen)}>
                    <h4 className="font-bold flex items-center text-xs"><Sliders className="w-3.5 h-3.5 mr-1.5 text-[#4361EE]" /> Stress-Tester</h4>
                    <div className="flex items-center space-x-2">
                      <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${sentiment < -0.3 ? "bg-[#FF3366]/20 text-[#FF3366]" : sentiment > 0.5 ? "bg-[#00FF88]/20 text-[#00FF88]" : "bg-[#4361EE]/20 text-[#4361EE]"}`}>
                        {sentiment < -0.3 ? "Bearish" : sentiment > 0.5 ? "Bullish" : "Baseline"}
                      </div>
                      {isControlsOpen ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {isControlsOpen && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="px-4 pb-4 flex flex-col">
                        <div className="space-y-3 mb-4">
                          <div>
                            <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Base Asset Price</p>
                            <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`w-full text-sm font-mono font-bold px-2 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-[#4361EE] ${darkMode ? "bg-[#0A0C10]/80 border border-white/10 text-white" : "bg-slate-100/80 border border-slate-300 text-slate-900"}`} />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <p className={`text-[9px] font-bold uppercase tracking-widest ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Sentiment Injection</p>
                              <span className={`text-[10px] font-mono font-bold ${sentiment >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}`}>{sentiment > 0 ? "+" : ""}{sentiment.toFixed(2)}</span>
                            </div>
                            <input type="range" min="-1.0" max="1.0" step="0.01" value={sentiment} onChange={(e) => setSentiment(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-[#1A1D24] [&::-webkit-slider-thumb]:appearance-none[&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md" style={{ background: `linear-gradient(to right, ${sentiment >= 0 ? '#00FF88' : '#FF3366'} ${((sentiment + 1) / 2) * 100}%, ${darkMode ? '#1A1D24' : '#e2e8f0'} ${((sentiment + 1) / 2) * 100}%)` }} />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <p className={`text-[9px] font-bold uppercase tracking-widest ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Social Hype Volume</p>
                              <span className={`text-[10px] font-mono font-bold text-[#FCAF45]`}>{(hype / 1000000).toFixed(2)}M</span>
                            </div>
                            <input type="range" min="1" max="5000000" step="10000" value={hype} onChange={(e) => setHype(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-[#1A1D24] [&::-webkit-slider-thumb]:appearance-none[&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full[&::-webkit-slider-thumb]:shadow-md" style={{ background: `linear-gradient(to right, #FCAF45 ${(hype / 5000000) * 100}%, ${darkMode ? '#1A1D24' : '#e2e8f0'} ${(hype / 5000000) * 100}%)` }} />
                          </div>
                        </div>
                        <button onClick={runForecastSimulation} disabled={isFetchingForecast} className={`w-full py-2.5 rounded-lg font-bold text-[11px] flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-md ${isFetchingForecast ? darkMode ? "bg-[#1A1D24] text-slate-500" : "bg-slate-200 text-slate-400" : "bg-gradient-to-r from-[#7209B7] to-[#4361EE] text-white hover:shadow-[0_0_15px_rgba(67,97,238,0.4)] hover:-translate-y-0.5"}`}>
                          {isFetchingForecast ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> Calculating...</> : <><Zap className="w-3 h-3 mr-1.5" /> Run Simulation</>}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Card>
            </motion.div>
          )}

          {/* ================= TAB 3: LIVE SYNC ================= */}
          {activeTab === "live" && (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-3 relative z-10 h-full">
              {!liveSyncData && (
                <Card className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-20 h-20 bg-[#00FF88]/10 rounded-2xl flex items-center justify-center mb-6 border border-[#00FF88]/30"><Database className="w-10 h-10 text-[#00FF88]" /></div>
                  <h2 className="text-2xl font-black mb-3">Live Database Sync</h2>
                  <p className={`max-w-lg text-sm mb-8 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Initialize the ETL pipeline to scrape real-time market metrics.</p>
                  <button onClick={initiateLiveSync} disabled={isSyncing} className={`px-8 py-4 rounded-2xl text-sm font-bold flex items-center justify-center transition-all transform active:scale-95 ${isSyncing ? "bg-[#1A1D24] text-slate-500 border border-white/10" : "bg-gradient-to-r from-[#00FF88] to-[#00BFFF] text-slate-900 shadow-[0_0_30px_rgba(0,255,136,0.3)] hover:-translate-y-1"}`}>
                    {isSyncing ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Fetching Market Data...</> : <><Terminal className="w-5 h-5 mr-2" /> Initiate Live ETL Pipeline</>}
                  </button>
                </Card>
              )}

              {liveSyncData && (
                <div className="flex flex-col gap-3 xl:h-full xl:min-h-0">
                  <div className="shrink-0 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Card className={`!p-3 border flex flex-col justify-center ${darkMode ? "border-[#00FF88]/30 bg-[#00FF88]/5" : "border-[#00FF88]/50 bg-[#00FF88]/10"}`}>
                      <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Live Price</p>
                      <p className="text-lg font-mono font-black">${liveSyncData.latest_actual_price.toFixed(2)}</p>
                    </Card>
                    <Card className={`!p-3 border flex flex-col justify-center ${liveSyncData.live_sentiment_score >= 0 ? (darkMode ? "border-[#00FF88]/30 bg-[#00FF88]/5" : "border-[#00FF88]/50 bg-[#00FF88]/10") : (darkMode ? "border-[#FF3366]/30 bg-[#FF3366]/5" : "border-[#FF3366]/50 bg-[#FF3366]/10")}`}>
                      <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Sentiment</p>
                      <p className={`text-lg font-mono font-black ${liveSyncData.live_sentiment_score >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}`}>{liveSyncData.live_sentiment_score > 0 ? "+" : ""}{liveSyncData.live_sentiment_score.toFixed(3)}</p>
                    </Card>
                    <Card className="md:col-span-2 !p-3 flex flex-row items-center justify-between bg-gradient-to-b from-transparent to-black/10">
                      <div className="text-left"><p className="text-[9px] font-bold text-[#FF3366] uppercase tracking-widest mb-0.5 flex items-center"><ArrowDownRight className="w-3 h-3 mr-0.5" /> Lower</p><p className="text-sm font-mono font-bold text-slate-400">${liveSyncData.live_forecast.lower_bound.toFixed(2)}</p></div>
                      <div className="text-center px-3 border-x border-white/10"><p className="text-[9px] font-bold text-[#4361EE] uppercase tracking-widest mb-0.5 flex items-center justify-center"><Target className="w-3 h-3 mr-0.5" /> Target</p><p className="text-2xl font-mono font-black">${liveSyncData.live_forecast.target_price.toFixed(2)}</p></div>
                      <div className="text-right"><p className="text-[9px] font-bold text-[#00FF88] uppercase tracking-widest mb-0.5 flex items-center justify-end"><ArrowUpRight className="w-3 h-3 mr-0.5" /> Upper</p><p className="text-sm font-mono font-bold text-slate-400">${liveSyncData.live_forecast.upper_bound.toFixed(2)}</p></div>
                    </Card>
                  </div>

                  <a href={(liveSyncData.root_cause_url && liveSyncData.root_cause_url.length > 4 && liveSyncData.root_cause_url !== "nan") ? (liveSyncData.root_cause_url.includes('http') ? liveSyncData.root_cause_url : `https://reddit.com${liveSyncData.root_cause_url}`) : "https://finance.yahoo.com"} target="_blank" rel="noopener noreferrer" className="shrink-0 block w-full">
                    <Card className={`group cursor-pointer border !p-3 ${darkMode ? "border-[#BF5CFF]/30 bg-gradient-to-r from-[#BF5CFF]/10 to-transparent" : "border-[#BF5CFF]/50 bg-gradient-to-r from-[#BF5CFF]/20 to-transparent"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center"><Brain className="w-4 h-4 mr-2 text-[#BF5CFF]" /><h3 className="text-[11px] font-bold group-hover:underline decoration-[#BF5CFF] underline-offset-2 truncate max-w-xl md:max-w-3xl"><span className="text-[#BF5CFF] mr-1.5">AI NARRATIVE:</span> "{liveSyncData.root_cause_headline}"</h3></div>
                        <ExternalLink className="w-3.5 h-3.5 text-[#BF5CFF] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Card>
                  </a>

                  <Card className="flex-1 min-h-[300px] xl:min-h-0 flex flex-col !p-4 relative">
                    <div className="flex justify-between items-center mb-2"><h2 className="text-[13px] font-bold flex items-center"><TrendingUp className="w-4 h-4 mr-1 text-[#4361EE]" /> Live 30-Day Trajectory</h2>{isFetchingLiveForecast && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4361EE]" />}</div>
                    <div className={`w-full flex-1 xl:min-h-0 transition-opacity duration-300 ${isFetchingLiveForecast ? "opacity-50" : "opacity-100"}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart key={chartKey} data={liveCombinedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs><linearGradient id="colorUncertainty" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4361EE" stopOpacity={darkMode ? 0.4 : 0.2} /><stop offset="95%" stopColor={darkMode ? "#4361EE" : "#4361EE"} stopOpacity={0.0} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#2A2E37" : "#e2e8f0"} opacity={0.6} />
                          <XAxis dataKey="day" type="number" domain={['dataMin', 'dataMax']} tickCount={7} tickFormatter={(t) => t === 0 ? "TODAY" : t > 0 ? `+${t}` : `${t}`} tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 9, fontWeight: "bold" }} axisLine={false} tickLine={false} tickMargin={6} />
                          <YAxis domain={[liveBounds.min, liveBounds.max]} tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 9 }} tickFormatter={(t) => `$${t}`} axisLine={false} tickLine={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: darkMode ? 'rgba(17, 19, 24, 0.9)' : 'rgba(255, 255, 255, 0.9)', backdropFilter: "blur(12px)", borderColor: darkMode ? '#2A2E37' : '#e2e8f0', borderRadius: "12px", color: darkMode ? '#fff' : '#000', padding: "8px" }} formatter={(value: any, name: any) => [Array.isArray(value) ? `[$${value[0].toFixed(2)}, $${value[1].toFixed(2)}]` : `$${value.toFixed(2)}`, name.replace("_", " ")]} labelFormatter={(label) => label === 0 ? "TODAY" : label > 0 ? `Day +${label} (Forecast)` : `Day ${label} (Historical)`} itemStyle={{ fontWeight: 600, textTransform: "capitalize", fontSize: "11px" }} />
                          <Legend verticalAlign="top" height={30} iconType="circle" formatter={(v) => <span className={`font-semibold ml-1 capitalize text-xs ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{v.replace("_", " ")}</span>} />
                          <ReferenceLine x={0} stroke={darkMode ? "#94a3b8" : "#64748b"} strokeDasharray="4 4" label={{ position: 'top', value: 'TODAY', fill: darkMode ? '#fff' : '#000', fontSize: 9, fontWeight: 'bold' }} />
                          <Line type="monotone" dataKey="past_price" stroke={darkMode ? "#475569" : "#94a3b8"} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: darkMode ? "#475569" : "#94a3b8", strokeWidth: 0 }} name="Past 30 Days" isAnimationActive={false} />
                          <Area type="monotone" dataKey="uncertainty" stroke="none" fill="url(#colorUncertainty)" name="90% Bounds" isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                          <Line type="monotone" dataKey="likely_price" stroke="#4361EE" filter={darkMode ? "url(#neonGlowBlue)" : ""} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#4361EE", strokeWidth: 0 }} name="Forecast" isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    <motion.div animate={{ height: isLiveControlsOpen ? "auto" : "52px" }} className={`hidden md:flex flex-col w-[300px] absolute top-4 right-4 z-10 rounded-2xl border backdrop-blur-xl shadow-2xl overflow-hidden ${darkMode ? "bg-[#111318]/90 border-white/10" : "bg-white/90 border-slate-200"}`}>
                      <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0" onClick={() => setIsLiveControlsOpen(!isLiveControlsOpen)}>
                        <h4 className="font-bold flex items-center text-xs"><Sliders className="w-3.5 h-3.5 mr-1.5 text-[#4361EE]" /> Stress-Tester</h4>
                        <div className="flex items-center space-x-2">
                          <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${liveSentiment < -0.3 ? "bg-[#FF3366]/20 text-[#FF3366]" : liveSentiment > 0.5 ? "bg-[#00FF88]/20 text-[#00FF88]" : "bg-[#4361EE]/20 text-[#4361EE]"}`}>
                            {liveSentiment < -0.3 ? "Bearish" : liveSentiment > 0.5 ? "Bullish" : "Baseline"}
                          </div>
                          {isLiveControlsOpen ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                        </div>
                      </div>
                      <AnimatePresence>
                        {isLiveControlsOpen && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="px-4 pb-4 flex flex-col">
                            <div className="space-y-3 mb-4">
                              <div>
                                <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Base Asset Price</p>
                                <input type="number" value={livePrice} onChange={(e) => setLivePrice(Number(e.target.value))} className={`w-full text-sm font-mono font-bold px-2 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-[#4361EE] ${darkMode ? "bg-[#0A0C10]/80 border border-white/10 text-white" : "bg-slate-100/80 border border-slate-300 text-slate-900"}`} />
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <p className={`text-[9px] font-bold uppercase tracking-widest ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Sentiment Injection</p>
                                  <span className={`text-[10px] font-mono font-bold ${liveSentiment >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}`}>{liveSentiment > 0 ? "+" : ""}{liveSentiment.toFixed(2)}</span>
                                </div>
                                <input type="range" min="-1.0" max="1.0" step="0.01" value={liveSentiment} onChange={(e) => setLiveSentiment(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-[#1A1D24] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full[&::-webkit-slider-thumb]:shadow-md" style={{ background: `linear-gradient(to right, ${liveSentiment >= 0 ? '#00FF88' : '#FF3366'} ${((liveSentiment + 1) / 2) * 100}%, ${darkMode ? '#1A1D24' : '#e2e8f0'} ${((liveSentiment + 1) / 2) * 100}%)` }} />
                              </div>
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <p className={`text-[9px] font-bold uppercase tracking-widest ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Social Hype Volume</p>
                                  <span className={`text-[10px] font-mono font-bold text-[#FCAF45]`}>{(liveHype / 1000000).toFixed(2)}M</span>
                                </div>
                                <input type="range" min="1" max="5000000" step="10000" value={liveHype} onChange={(e) => setLiveHype(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-[#1A1D24] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md" style={{ background: `linear-gradient(to right, #FCAF45 ${(liveHype / 5000000) * 100}%, ${darkMode ? '#1A1D24' : '#e2e8f0'} ${(liveHype / 5000000) * 100}%)` }} />
                              </div>
                            </div>
                            <button onClick={runLiveForecastSimulation} disabled={isFetchingLiveForecast} className={`w-full py-2.5 rounded-lg font-bold text-[11px] flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-md ${isFetchingLiveForecast ? darkMode ? "bg-[#1A1D24] text-slate-500" : "bg-slate-200 text-slate-400" : "bg-gradient-to-r from-[#7209B7] to-[#4361EE] text-white hover:shadow-[0_0_15px_rgba(67,97,238,0.4)] hover:-translate-y-0.5"}`}>
                              {isFetchingLiveForecast ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> Calculating...</> : <><Zap className="w-3 h-3 mr-1.5" /> Run Simulation</>}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}