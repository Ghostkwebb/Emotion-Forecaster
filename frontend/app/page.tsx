"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { AlertTriangle, Activity, Play, Info, Moon, Sun, RefreshCw, Pause, StepForward, GitBranch, Loader2, MousePointerClick, BarChart3, Hexagon, Zap, TrendingUp, Sparkles, Shield, Brain, Sliders, ArrowRight, Terminal, Database, ExternalLink, Target, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MarketForecasterDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [darkMode, setDarkMode] = useState(true);

  // Simulation / Sandbox State
  const [price, setPrice] = useState(7126.06);
  const [sentiment, setSentiment] = useState(0.3);
  const [hype, setHype] = useState(500000);

  const [forecastData, setForecastData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingForecast, setIsFetchingForecast] = useState(false);

  // Live Sync State (NEW)
  const [liveSyncData, setLiveSyncData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [chartKey, setChartKey] = useState(0);
  const [activeTab, setActiveTab] = useState("home");
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);

  const [radarAlerts, setRadarAlerts] = useState<{ day: string, z: number, type: string }[]>([]);
  const [flashDanger, setFlashDanger] = useState(false);
  const [narrative, setNarrative] = useState<{ date: string, text: string, upvotes: number } | null>(null);

  // MANUAL FORECAST TRIGGER (Replaces auto-updating useEffect)
  const runForecastSimulation = async () => {
    setIsFetchingForecast(true);
    setChartKey(prev => prev + 1); // Triggers re-render animation
    try {
      setError(null);
      const res = await fetch("https://hive-api.onrender.com/forecast", { // MAKE SURE THIS IS YOUR BACKEND URL
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_price: price, current_sentiment: sentiment, current_hype_volume: hype, days_to_forecast: 30 }),
      });

      if (!res.ok) throw new Error("Forecast API fail");
      const data = await res.json();
      setForecastData(data.forecast);
    } catch (err) {
      setError("API Offline: Ensure backend is running.");
    } finally {
      setIsFetchingForecast(false);
    }
  };

  // LIVE ETL PIPELINE SYNC (NEW)
  const initiateLiveSync = async () => {
    setIsSyncing(true);
    try {
      // If you hosted it on Render, change this URL!
      const res = await fetch("http://127.0.0.1:8000/live-sync");
      if (!res.ok) throw new Error("Failed to sync live data");
      const data = await res.json();

      // Update UI with Live Data
      setLiveSyncData(data);

      // Auto-fill the Sandbox Sliders with the live numbers
      setPrice(data.latest_actual_price);
      setSentiment(data.live_sentiment_score);

      // Automatically run the first simulation
      setTimeout(() => runForecastSimulation(), 500);

    } catch (err) {
      console.error(err);
      setError("Live Sync Failed. Ensure backend /live-sync endpoint is available.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch History on Load
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/simulation-data"); // UPDATE TO LIVE URL IF NEEDED
        if (res.ok) {
          const data = await res.json();
          setHistoryData(data.simulation_data);
        }
      } catch (err) {
        console.error("History fetch fail", err);
      }
    };
    fetchHistory();
  }, []);

  // History Playback Engine
  useEffect(() => {
    if (isPlayingHistory && historyIndex < historyData.length - 1) {
      const timer = setTimeout(() => setHistoryIndex((prev) => prev + 1), 120);
      return () => clearTimeout(timer);
    } else {
      setIsPlayingHistory(false);
    }
  }, [isPlayingHistory, historyIndex, historyData]);

  // Radar Anomaly Engine
  useEffect(() => {
    if (activeTab !== "history" || historyData.length === 0) return;
    const current = historyData[historyIndex];
    if (!current) return;

    const isFear = current.anomaly_status === "CRITICAL_FEAR" || current.z_score <= -1.5;
    const isHype = current.anomaly_status === "EXTREME_HYPE" || current.z_score >= 1.5;

    if (isFear) {
      setRadarAlerts(prev => {
        if (prev.some(a => a.day === current.date)) return prev;
        return [{ day: current.date, z: current.z_score, type: "fear" }, ...prev];
      });
      setFlashDanger(true);
      setTimeout(() => setFlashDanger(false), 400);
    } else if (isHype) {
      setRadarAlerts(prev => {
        if (prev.some(a => a.day === current.date)) return prev;
        return [{ day: current.date, z: current.z_score, type: "hype" }, ...prev];
      });
    }
  }, [historyIndex, historyData, activeTab]);

  const mappedData = useMemo(() => forecastData.map((d) => ({ ...d, uncertainty: [d.lower_bound, d.upper_bound] })), [forecastData]);

  const handleThemeToggle = (e: React.MouseEvent) => {
    const nextIsDark = !darkMode;
    if (!document.startViewTransition) { setDarkMode(nextIsDark); return; }
    const x = e.clientX, y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => setDarkMode(nextIsDark));
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 500, easing: "ease-out", pseudoElement: "::view-transition-new(root)" }
      );
    });
  };

  const yAxisMin = forecastData.length > 0 ? Math.floor(Math.min(...forecastData.map((d) => d.lower_bound)) * 0.98) : 3000;
  const yAxisMax = forecastData.length > 0 ? Math.ceil(Math.max(...forecastData.map((d) => d.upper_bound)) * 1.02) : 6000;

  const handleChartClick = React.useCallback((data: any) => {
    if (!data) return;
    let p = null;
    if (data?.activePayload?.[0]?.payload) p = data.activePayload[0].payload;
    else if (data?.payload) p = data.payload;
    else p = data;

    if (p && p.root_cause_text) {
      setNarrative({ date: p.date, text: p.root_cause_text, upvotes: p.root_cause_upvotes || 0 });
    }
  }, []);

  const containerVariants: any = React.useMemo(() => ({ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }), []);
  const itemVariants: any = React.useMemo(() => ({ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 15 } } }), []);

  const CustomRadarTooltip = React.useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`px-3 py-2 rounded-xl shadow-lg border ${darkMode ? "bg-[#0F172A] border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
          <p className="font-bold text-sm">{payload[0].payload.subject}</p>
          <p className="text-xs">Sentiment: <span className={payload[0].payload.raw >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}>{payload[0].payload.raw > 0 ? "+" : ""}{payload[0].payload.raw.toFixed(2)}</span></p>
        </div>
      );
    }
    return null;
  }, [darkMode]);

  const Card = React.useCallback(({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <motion.div variants={itemVariants} className={`rounded-[32px] p-6 shadow-sm relative overflow-hidden transition-colors ${darkMode ? "bg-[#111318] border border-white/5 shadow-black/50" : "bg-white border border-slate-200 shadow-slate-200/50"} ${className}`}>
      {children}
    </motion.div>
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

  // DYNAMIC BACKGROUND COLOR BASED ON SENTIMENT SLIDER
  const dynamicBg = sentiment > 0
    ? `radial-gradient(circle at 50% 100%, rgba(0, 255, 136, ${Math.abs(sentiment) * 0.15}), transparent 70%)`
    : `radial-gradient(circle at 50% 100%, rgba(255, 51, 102, ${Math.abs(sentiment) * 0.15}), transparent 70%)`;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 overflow-x-hidden relative ${darkMode ? "bg-[#050608] text-slate-100" : "bg-[#F3F4F6] text-slate-900"}`}>

      {/* DYNAMIC BLOOMBERG TERMINAL GLOW */}
      {activeTab === "sandbox" && (
        <div className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out z-0" style={{ background: dynamicBg }}></div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        ::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
        @keyframes infinite-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: infinite-scroll 25s linear infinite; }
      `}} />

      <svg className="w-0 h-0 absolute">
        <defs>
          <filter id="neonGlowPurple" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="neonGlowBlue" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* LIVE BLOOMBERG-STYLE TICKER */}
      <div className={`w-full overflow-hidden border-b flex whitespace-nowrap py-2 relative z-50 ${darkMode ? "bg-[#0A0C10] border-white/5 text-[#00FF88]" : "bg-slate-900 border-black text-[#00FF88]"}`}>
        <div className="animate-marquee flex w-max text-xs font-mono font-bold tracking-widest">
          <span className="mx-8">{tickerString}</span>
          <span className="mx-8">{tickerString}</span>
          <span className="mx-8">{tickerString}</span>
          <span className="mx-8">{tickerString}</span>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6 relative z-10">

        {/* PREMIUM HEADER / NAVBAR */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 mt-4">

          <div className="flex items-center space-x-4 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-12 h-12 relative flex items-center justify-center">
              <img src="/HIVE.png" alt="Pulse AI Logo" className="w-full h-full object-contain rounded-xl" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF88] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#00FF88] border-2 border-[#050608]"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <h1 className={`text-2xl font-extrabold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
                H.I.V.E.
              </h1>
              <div className="flex items-center mt-1 space-x-3">
                <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${darkMode ? "bg-[#1A1D24] text-slate-400 border border-white/5" : "bg-slate-200 text-slate-500"}`}>
                  Quantile Engine
                </div>
                <div className="flex items-center text-[9px] font-bold text-[#00FF88] uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] mr-1.5"></span> Live Sync
                </div>
              </div>
            </div>
          </div>

          <div className={`flex items-center p-1.5 rounded-full relative shadow-sm transition-colors ${darkMode ? "bg-[#111318] border border-white/5" : "bg-white border border-slate-200"}`}>
            <div className="flex relative">
              {['home', 'history', 'sandbox'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-4 md:px-6 py-2 rounded-full text-sm font-bold transition-all z-10 ${activeTab === tab ? (darkMode ? "text-white" : "text-slate-900") : (darkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700")}`}
                >
                  {activeTab === tab && (
                    <motion.div layoutId="activeTab" className={`absolute inset-0 rounded-full shadow-sm -z-10 ${darkMode ? "bg-[#1A1D24] border border-white/5" : "bg-slate-100"}`} transition={{ type: "spring", stiffness: 300, damping: 25 }} />
                  )}
                  {tab === 'home' ? 'Overview' : tab === 'history' ? 'Historical Proof' : 'Live Sync Sandbox'}
                </button>
              ))}
            </div>

            <div className={`w-px h-5 mx-2 ${darkMode ? "bg-white/10" : "bg-slate-200"}`}></div>

            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={handleThemeToggle} className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors focus:outline-none ${darkMode ? "hover:bg-[#1A1D24] text-[#FCAF45]" : "hover:bg-slate-100 text-slate-600"}`}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={darkMode ? "dark" : "light"} initial={{ opacity: 0, rotate: -90, scale: 0.5 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.5 }} transition={{ duration: 0.15 }} className="absolute">
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>

        {error && <div className="p-4 bg-[#FF3366]/10 border border-[#FF3366]/30 text-[#FF3366] rounded-2xl shadow-sm font-semibold">{error}</div>}

        <AnimatePresence>
          {flashDanger && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none z-50 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#FF3366]/20 to-transparent" />}
        </AnimatePresence>

        {/* ================= TAB 0: HOME / LANDING PAGE ================= */}
        {activeTab === "home" && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col">

            {/* HERO SECTION */}
            <div className="relative w-full flex flex-col items-center text-center py-24 md:py-32 mb-12">
              <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
                <div className={`w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full blur-[100px] md:blur-[150px] ${darkMode ? "bg-[#7209B7]/20" : "bg-[#4361EE]/10"}`}></div>
              </div>

              <img src="/HIVE.png" className="w-24 h-24 md:w-32 md:h-32 mb-8 drop-shadow-[0_0_30px_rgba(114,9,183,0.5)] animate-pulse" alt="HIVE Logo" />

              <h1 className={`text-6xl md:text-8xl font-black mb-4 tracking-tighter bg-clip-text text-transparent ${darkMode ? "bg-gradient-to-b from-white to-slate-400" : "bg-gradient-to-b from-slate-900 to-slate-500"}`}>
                H.I.V.E.
              </h1>
              <h2 className="text-xl md:text-3xl font-bold text-[#4361EE] mb-8">Heuristic Internet Volatility Engine</h2>
              <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                Institutional market forecasting driven entirely by the chaotic speed of internet sentiment.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4">
                <button onClick={() => setActiveTab('history')} className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold flex items-center justify-center bg-gradient-to-r from-[#7209B7] to-[#4361EE] text-white hover:shadow-[0_8px_30px_-6px_rgba(67,97,238,0.5)] hover:-translate-y-1 transition-all active:scale-95 text-lg">
                  <Play className="w-5 h-5 mr-2 fill-current" /> Launch 2021 Simulation
                </button>
                <button onClick={() => setActiveTab('sandbox')} className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-bold flex items-center justify-center border-2 transition-all hover:-translate-y-1 active:scale-95 text-lg ${darkMode ? "border-white/10 hover:border-white/20 bg-[#111318] text-white" : "border-slate-300 hover:border-slate-400 bg-white text-slate-900"}`}>
                  <Sliders className="w-5 h-5 mr-2" /> Enter Live Sandbox
                </button>
              </div>
            </div>

            {/* PROBLEM HOOK */}
            <Card className={`text-center py-16 mb-24 max-w-4xl mx-auto border-t-4 border-t-[#FF3366] ${darkMode ? "bg-gradient-to-b from-[#1A1D24] to-transparent" : "bg-gradient-to-b from-slate-100 to-transparent"}`}>
              <h3 className="text-3xl md:text-4xl font-black text-[#FF3366] mb-6">Traditional math failed in 2021. Sentiment took over.</h3>
              <p className={`text-lg md:text-xl leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                When millions of retail investors mobilized online, Wall Street hedge funds were blindsided. Standard financial models simply cannot predict social media hype. H.I.V.E. exists to translate the chaos of the internet into quantifiable, actionable risk metrics.
              </p>
            </Card>

            {/* THE THREE PILLARS (BENTO) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
              <Card className={`group hover:-translate-y-2 transition-all duration-300 ${darkMode ? "bg-[#111318]" : "bg-white"}`}>
                <div className="w-16 h-16 rounded-[20px] bg-[#FF3366]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="w-8 h-8 text-[#FF3366]" />
                </div>
                <h4 className="text-xl font-bold mb-3">Early Warning Radar</h4>
                <p className={`leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Don't wait for the crash. Our Z-Score anomaly detector continuously scans Reddit, flagging 'Critical Fear' and 'Extreme Hype' days before the broader market reacts.
                </p>
              </Card>

              <Card className={`group hover:-translate-y-2 transition-all duration-300 ${darkMode ? "bg-[#111318]" : "bg-white"}`}>
                <div className="w-16 h-16 rounded-[20px] bg-[#00FF88]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="w-8 h-8 text-[#00FF88]" />
                </div>
                <h4 className="text-xl font-bold mb-3">Root Cause XAI</h4>
                <p className={`leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                  No black boxes. Click any market anomaly spike on our timeline to instantly reveal the exact social media narrative (and raw post) that drove the volatility.
                </p>
              </Card>

              <Card className={`group hover:-translate-y-2 transition-all duration-300 ${darkMode ? "bg-[#111318]" : "bg-white"}`}>
                <div className="w-16 h-16 rounded-[20px] bg-[#4361EE]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Database className="w-8 h-8 text-[#4361EE]" />
                </div>
                <h4 className="text-xl font-bold mb-3">Live ETL Pipeline</h4>
                <p className={`leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Instantly sync with live market data. Generate quantile-bounded 30-day forward projections and stress-test your portfolio against Black Swan internet events.
                </p>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ================= TAB 1: HISTORY ================= */}
        {activeTab === "history" && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 xl:grid-cols-12 gap-6">

            <div className="xl:col-span-8 flex flex-col gap-6">
              <Card className="flex-1 min-h-[500px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold">2021 Meme-Stock Simulation</h2>
                    <p className={`text-xs mt-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Click lines for Root Cause XAI.</p>
                  </div>
                </div>

                <div className="w-full flex-1 min-h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={historyData.slice(0, historyIndex + 1)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} onClick={handleChartClick} className="cursor-pointer">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#2A2E37" : "#e2e8f0"} opacity={0.6} />
                      <XAxis dataKey="date" tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={10} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 11 }} tickFormatter={(t) => `$${t}`} axisLine={false} tickLine={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: darkMode ? 'rgba(17, 19, 24, 0.9)' : 'rgba(255, 255, 255, 0.9)', backdropFilter: "blur(12px)", borderColor: darkMode ? '#2A2E37' : '#e2e8f0', borderRadius: "20px", color: darkMode ? '#fff' : '#000', padding: "16px" }} itemStyle={{ fontWeight: 600 }} />
                      <Legend verticalAlign="top" height={40} iconType="circle" formatter={(v) => <span className={`font-semibold ml-1 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{v}</span>} />
                      <Line type="monotone" dataKey="actual_price" stroke={darkMode ? "#475569" : "#94a3b8"} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: darkMode ? "#475569" : "#94a3b8", strokeWidth: 0, cursor: "pointer", onClick: (e: any, p: any) => handleChartClick(p) }} name="Actual Market" isAnimationActive={!isPlayingHistory} animationDuration={300} />
                      <Line type="monotone" dataKey="predicted_likely" stroke="#7209B7" filter={darkMode ? "url(#neonGlowPurple)" : ""} strokeWidth={4} dot={false} activeDot={{ r: 8, fill: "#7209B7", strokeWidth: 0, cursor: "pointer", onClick: (e: any, p: any) => handleChartClick(p) }} name="AI Prediction" isAnimationActive={!isPlayingHistory} animationDuration={300} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[320px]">
                <Card className={`flex flex-col h-full ${darkMode ? "bg-gradient-to-br from-[#111318] to-[#1A1D24]" : "bg-gradient-to-br from-white to-slate-50"}`}>
                  <h3 className="text-sm font-bold flex items-center mb-2"><BarChart3 className="w-5 h-5 mr-2 text-[#4CC9F0]" /> Sector Tug-of-War</h3>
                  <div className="flex-1 w-full relative -mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={sectorRadarData}>
                        <PolarGrid stroke={darkMode ? "#2A2E37" : "#e2e8f0"} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 11, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <RechartsTooltip content={<CustomRadarTooltip />} />
                        <Radar name="Sector" dataKey="value" stroke="#4CC9F0" strokeWidth={3} fill="#4CC9F0" fillOpacity={0.3} isAnimationActive={false} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className={`flex flex-col h-full ${darkMode ? "bg-gradient-to-bl from-[#111318] to-[#1A1D24]" : "bg-gradient-to-bl from-white to-slate-50"}`}>
                  <h3 className="text-sm font-bold flex items-center mb-2"><Hexagon className="w-5 h-5 mr-2 text-[#FCAF45]" /> Mega-Cap Heatmap</h3>
                  <div className="flex-1 w-full relative -mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={megaCapRadarData}>
                        <PolarGrid stroke={darkMode ? "#2A2E37" : "#e2e8f0"} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 11, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <RechartsTooltip content={<CustomRadarTooltip />} />
                        <Radar name="MegaCap" dataKey="value" stroke="#FCAF45" strokeWidth={3} fill="#FCAF45" fillOpacity={0.3} isAnimationActive={false} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            <div className="xl:col-span-4 flex flex-col gap-6">
              <Card>
                <div className="flex space-x-3 mb-6">
                  <button onClick={() => setIsPlayingHistory(!isPlayingHistory)} className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center transition-all shadow-sm ${darkMode ? "bg-white text-black hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                    {isPlayingHistory ? <><Pause className="w-5 h-5 mr-2" /> Pause</> : <><Play className="w-5 h-5 mr-2" /> Play Timeline</>}
                  </button>
                  <button onClick={() => setHistoryIndex((p) => Math.min(p + 1, historyData.length - 1))} className={`px-5 py-4 rounded-2xl flex items-center transition-all ${darkMode ? "bg-[#1A1D24] hover:bg-[#2A2E37] border border-white/5" : "bg-slate-100 hover:bg-slate-200"}`}>
                    <StepForward className="w-5 h-5" />
                  </button>
                </div>

                <div className={`p-6 rounded-[24px] mb-6 relative overflow-hidden ${darkMode ? "bg-[#1A1D24] border border-white/5" : "bg-slate-50 border border-slate-200"}`}>
                  <div className="grid grid-cols-2 gap-y-6 relative z-10">
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Date</p>
                      <p className="font-mono font-bold text-base">{currentFrame.date || "--"}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Market Price</p>
                      <p className="font-mono font-bold text-base">${currentFrame.actual_price || "--"}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Sentiment</p>
                      <p className={`font-mono font-bold text-base ${currentFrame.sentiment_score >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}`}>
                        {currentFrame.sentiment_score > 0 ? "+" : ""}{currentFrame.sentiment_score || "--"}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Anomaly Z-Score</p>
                      <p className="font-mono font-bold text-base">{currentFrame.z_score || "--"}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="h-[400px] shrink-0 flex flex-col p-0 overflow-hidden border border-[#FF3366]/20">
                <div className={`p-5 border-b shrink-0 ${darkMode ? "border-white/5 bg-[#1A1D24]" : "border-slate-100 bg-slate-50"}`}>
                  <h3 className="text-sm font-bold flex items-center"><Activity className="w-5 h-5 mr-2 text-[#FF3366]" /> Live Radar Feed</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {radarAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-40">
                      <Zap className={`w-8 h-8 mb-3 ${darkMode ? "text-slate-600" : "text-slate-400"}`} />
                      <p className="text-sm font-bold">Scanning anomalies...</p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {radarAlerts.map((alert, i) => (
                        <motion.div key={`${alert.day}-${i}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`p-4 text-sm rounded-[20px] border ${alert.type === 'fear' ? (darkMode ? "bg-[#FF3366]/10 border-[#FF3366]/30 text-red-200" : "bg-red-50 border-red-200 text-[#FF3366]") : (darkMode ? "bg-[#00FF88]/10 border-[#00FF88]/30 text-green-200" : "bg-green-50 border-green-200 text-green-700")}`}>
                          <div className="flex items-center mb-1.5 font-bold">
                            <AlertTriangle className="w-4 h-4 mr-2" /> RADAR ALERT
                          </div>
                          <p className="opacity-90">{alert.type === 'fear' ? 'Market Panic' : 'Extreme Euphoria'} (Z: {alert.z}).</p>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ================= TAB 2: LIVE SYNC & SANDBOX ================= */}
        {activeTab === "sandbox" && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-6 relative z-10">

            {/* STEP 1: LIVE ETL PIPELINE */}
            {!liveSyncData && (
              <Card className="flex flex-col items-center justify-center min-h-[500px] text-center py-16">
                <div className="w-24 h-24 bg-[#00FF88]/10 rounded-[30px] flex items-center justify-center mb-8 border border-[#00FF88]/30 shadow-[0_0_30px_rgba(0,255,136,0.2)]">
                  <Database className="w-12 h-12 text-[#00FF88]" />
                </div>
                <h2 className="text-3xl font-black mb-4">Live Database Synchronization</h2>
                <p className={`max-w-xl text-lg mb-10 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                  Initialize the ETL pipeline to scrape real-time market metrics and social sentiment from Yahoo Finance to power the Live Sandbox.
                </p>
                <button
                  onClick={initiateLiveSync}
                  disabled={isSyncing}
                  className={`px-10 py-5 rounded-[24px] text-lg font-bold flex items-center justify-center transition-all transform active:scale-95 ${isSyncing ? "bg-[#1A1D24] text-slate-500 border border-white/10" : "bg-gradient-to-r from-[#00FF88] to-[#00BFFF] text-slate-900 shadow-[0_0_40px_rgba(0,255,136,0.4)] hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(0,255,136,0.6)]"}`}
                >
                  {isSyncing ? (
                    <><RefreshCw className="w-6 h-6 mr-3 animate-spin" /> Fetching Live Market Data...</>
                  ) : (
                    <><Terminal className="w-6 h-6 mr-3" /> Initiate Live ETL Pipeline</>
                  )}
                </button>
              </Card>
            )}

            {/* STEP 2: LOADED SANDBOX DASHBOARD */}
            {liveSyncData && (
              <>
                {/* LIVE MARKET PULSE CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className={`border ${darkMode ? "border-[#00FF88]/30 bg-[#00FF88]/5" : "border-[#00FF88]/50 bg-[#00FF88]/10"}`}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Live Asset Price</p>
                    <p className="text-4xl font-mono font-black">${liveSyncData.latest_actual_price.toFixed(2)}</p>
                  </Card>

                  <Card className={`border ${liveSyncData.live_sentiment_score >= 0 ? (darkMode ? "border-[#00FF88]/30 bg-[#00FF88]/5" : "border-[#00FF88]/50 bg-[#00FF88]/10") : (darkMode ? "border-[#FF3366]/30 bg-[#FF3366]/5" : "border-[#FF3366]/50 bg-[#FF3366]/10")}`}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Live Sentiment Score</p>
                    <p className={`text-4xl font-mono font-black ${liveSyncData.live_sentiment_score >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}`}>
                      {liveSyncData.live_sentiment_score > 0 ? "+" : ""}{liveSyncData.live_sentiment_score.toFixed(3)}
                    </p>
                  </Card>
                </div>

                {/* AI RISK BOUNDS DASHBOARD */}
                <Card className="flex flex-col md:flex-row items-center justify-between p-8 md:p-12 text-center bg-gradient-to-b from-transparent to-black/20">
                  <div className="w-full md:w-1/3 mb-6 md:mb-0">
                    <p className="text-sm font-bold text-[#FF3366] uppercase tracking-widest mb-2 flex items-center justify-center"><ArrowDownRight className="w-4 h-4 mr-1" /> Lower Bound</p>
                    <p className="text-3xl font-mono font-bold text-slate-400">${liveSyncData.live_forecast.lower_bound.toFixed(2)}</p>
                  </div>

                  <div className="w-full md:w-1/3 mb-6 md:mb-0 scale-110">
                    <p className="text-sm font-bold text-[#4361EE] uppercase tracking-widest mb-2 flex items-center justify-center"><Target className="w-5 h-5 mr-2" /> Target Price</p>
                    <p className="text-5xl font-mono font-black">${liveSyncData.live_forecast.target_price.toFixed(2)}</p>
                  </div>

                  <div className="w-full md:w-1/3">
                    <p className="text-sm font-bold text-[#00FF88] uppercase tracking-widest mb-2 flex items-center justify-center"><ArrowUpRight className="w-4 h-4 mr-1" /> Upper Bound</p>
                    <p className="text-3xl font-mono font-bold text-slate-400">${liveSyncData.live_forecast.upper_bound.toFixed(2)}</p>
                  </div>
                </Card>

                {/* ROOT CAUSE XAI BANNER */}
                <a href={liveSyncData.root_cause_url} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Card className={`group cursor-pointer border ${darkMode ? "border-[#BF5CFF]/30 bg-gradient-to-r from-[#BF5CFF]/10 to-transparent" : "border-[#BF5CFF]/50 bg-gradient-to-r from-[#BF5CFF]/20 to-transparent"}`}>
                    <div className="flex items-start md:items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#BF5CFF] uppercase tracking-widest mb-2 flex items-center">
                          <Brain className="w-4 h-4 mr-2" /> AI Narrative Detection
                        </p>
                        <h3 className="text-lg md:text-xl font-bold group-hover:underline decoration-[#BF5CFF] underline-offset-4">
                          "{liveSyncData.root_cause_headline}"
                        </h3>
                      </div>
                      <div className="hidden md:flex w-12 h-12 rounded-full bg-[#BF5CFF]/20 items-center justify-center group-hover:scale-110 transition-transform">
                        <ExternalLink className="w-5 h-5 text-[#BF5CFF]" />
                      </div>
                    </div>
                  </Card>
                </a>

                {/* THE STRESS TESTER (SANDBOX) */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
                  {/* CHART */}
                  <Card className="xl:col-span-2 min-h-[450px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-[#4361EE]" /> 30-Day Forward Trajectory</h2>
                      {isFetchingForecast && <Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" />}
                    </div>

                    <div className={`w-full flex-1 transition-opacity duration-300 ${isFetchingForecast ? "opacity-50" : "opacity-100"}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart key={chartKey} data={mappedData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorUncertainty" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4361EE" stopOpacity={darkMode ? 0.4 : 0.2} />
                              <stop offset="95%" stopColor={darkMode ? "#4361EE" : "#4361EE"} stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#2A2E37" : "#e2e8f0"} opacity={0.6} />
                          <XAxis dataKey="day" type="number" domain={[1, 30]} tickCount={6} tickFormatter={(t) => `Day ${t}`} tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={10} />
                          <YAxis domain={[yAxisMin, yAxisMax]} tick={{ fill: darkMode ? "#64748b" : "#94a3b8", fontSize: 11 }} tickFormatter={(t) => `$${t}`} axisLine={false} tickLine={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: darkMode ? 'rgba(17, 19, 24, 0.9)' : 'rgba(255, 255, 255, 0.9)', backdropFilter: "blur(12px)", borderColor: darkMode ? '#2A2E37' : '#e2e8f0', borderRadius: "20px", color: darkMode ? '#fff' : '#000', padding: "16px" }} formatter={(value: any, name: string) => [Array.isArray(value) ? `[$${value[0]}, $${value[1]}]` : `$${value}`, name]} labelFormatter={(label) => `Day ${label}`} itemStyle={{ fontWeight: 600 }} />
                          <Legend verticalAlign="top" height={40} iconType="circle" formatter={(v) => <span className={`font-semibold ml-1 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{v}</span>} />
                          <Area type="monotone" dataKey="uncertainty" stroke="none" fill="url(#colorUncertainty)" name="90% Confidence Bounds" isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                          <Line type="monotone" dataKey="likely_price" stroke="#4361EE" filter={darkMode ? "url(#neonGlowBlue)" : ""} strokeWidth={5} dot={false} activeDot={{ r: 8, fill: "#4361EE", strokeWidth: 0 }} name="Median Forecast" isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* STRESS TEST CONTROLS */}
                  <div className="flex flex-col gap-6">
                    <Card className={`flex-1 flex flex-col justify-center relative overflow-hidden ${darkMode ? "bg-gradient-to-br from-[#1A1D24] to-[#111318]" : "bg-white"}`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#4361EE]/10 rounded-full blur-3xl"></div>
                      <h4 className="font-bold flex items-center mb-6 text-lg"><Sliders className="w-5 h-5 mr-2 text-[#4361EE]" /> Stress-Test Scenario</h4>

                      <div className="space-y-6">
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Base Asset Price</p>
                          <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className={`w-full text-2xl font-mono font-bold px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[#4361EE] ${darkMode ? "bg-[#0A0C10] border border-white/10 text-white" : "bg-slate-100 border border-slate-300 text-slate-900"}`}
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <p className={`text-xs font-bold uppercase tracking-widest ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Sentiment Injection</p>
                            <span className={`text-lg font-mono font-bold ${sentiment >= 0 ? "text-[#00FF88]" : "text-[#FF3366]"}`}>{sentiment > 0 ? "+" : ""}{sentiment.toFixed(2)}</span>
                          </div>
                          <input type="range" min="-1.0" max="1.0" step="0.01" value={sentiment} onChange={(e) => setSentiment(Number(e.target.value))} className="w-full h-4 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-[#1A1D24] [&::-webkit-slider-thumb]:appearance-none[&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg" style={{ background: `linear-gradient(to right, ${sentiment >= 0 ? '#00FF88' : '#FF3366'} ${((sentiment + 1) / 2) * 100}%, ${darkMode ? '#1A1D24' : '#e2e8f0'} ${((sentiment + 1) / 2) * 100}%)` }} />
                        </div>
                      </div>
                    </Card>

                    <button
                      onClick={runForecastSimulation}
                      disabled={isFetchingForecast}
                      className={`w-full py-5 rounded-[24px] font-bold text-lg flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-lg ${isFetchingForecast ? darkMode ? "bg-[#1A1D24] text-slate-500" : "bg-slate-200 text-slate-400" : "bg-gradient-to-r from-[#7209B7] to-[#4361EE] text-white hover:shadow-[0_0_30px_rgba(67,97,238,0.5)] hover:-translate-y-1"}`}
                    >
                      {isFetchingForecast ? <><RefreshCw className="w-6 h-6 mr-3 animate-spin" /> Calculating Matrix...</> : <><Zap className="w-6 h-6 mr-3" /> Run Simulation</>}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}