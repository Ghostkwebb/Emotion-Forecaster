"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AlertTriangle, Activity, Play, Info, Moon, Sun, RefreshCw, Pause, StepForward, GitBranch, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MarketForecasterDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [darkMode, setDarkMode] = useState(false);

  const [price, setPrice] = useState(4500);
  const [sentiment, setSentiment] = useState(0);
  const [hype, setHype] = useState(500000);

  const [forecastData, setForecastData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const [chartKey, setChartKey] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState("sandbox");
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPlayingHistory, setIsPlayingHistory] = useState(false);

  // Radar State
  const [radarAlerts, setRadarAlerts] = useState<{ day: string, z: number, type: string }[]>([]);
  const [flashDanger, setFlashDanger] = useState(false);

  // Fetch forecast. Debounce 300ms.
  useEffect(() => {
    const fetchForecast = async () => {
      setIsFetching(true);
      try {
        setError(null);
        const res = await fetch("http://127.0.0.1:8000/forecast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_price: price,
            current_sentiment: sentiment,
            current_hype_volume: hype,
            days_to_forecast: 30,
          }),
        });

        if (!res.ok) throw new Error("API fail");
        const data = await res.json();
        setForecastData(data.forecast);
      } catch (err) {
        setError("API Offline: Run Python FastAPI backend on port 8000.");
      } finally {
        setIsFetching(false);
      }
    };

    const timeoutId = setTimeout(fetchForecast, 300);
    return () => clearTimeout(timeoutId);
  }, [price, sentiment, hype]);

  // Fetch history. 
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/simulation-data");
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

  // History play loop.
  useEffect(() => {
    if (isPlayingHistory && historyIndex < historyData.length - 1) {
      const timer = setTimeout(() => setHistoryIndex((prev) => prev + 1), 150);
      return () => clearTimeout(timer);
    } else {
      setIsPlayingHistory(false);
    }
  }, [isPlayingHistory, historyIndex, historyData]);

  // Radar Trigger Check
  useEffect(() => {
    if (activeTab !== "history" || historyData.length === 0) return;
    const current = historyData[historyIndex];
    if (!current) return;

    // Safety fallback: trigger at 1.5 since backend 2.0 too strict
    const isFear = current.anomaly_status === "CRITICAL_FEAR" || current.z_score <= -1.5;
    const isHype = current.anomaly_status === "EXTREME_HYPE" || current.z_score >= 1.5;

    if (isFear) {
      setRadarAlerts(prev => {
        if (prev.some(a => a.day === current.date)) return prev; // prevent duplicate
        return [{ day: current.date, z: current.z_score, type: "fear" }, ...prev];
      });
      setFlashDanger(true);
      setTimeout(() => setFlashDanger(false), 500);
    } else if (isHype) {
      setRadarAlerts(prev => {
        if (prev.some(a => a.day === current.date)) return prev;
        return [{ day: current.date, z: current.z_score, type: "hype" }, ...prev];
      });
    }
  }, [historyIndex, historyData, activeTab]);

  // Format bounds for Recharts Area
  const mappedData = useMemo(() => {
    return forecastData.map((d) => ({
      ...d,
      uncertainty: [d.lower_bound, d.upper_bound]
    }));
  }, [forecastData]);

  const startLiveSimulation = () => {
    setChartKey((prev) => prev + 1);
    setIsSimulating(true);
    setTimeout(() => setIsSimulating(false), 3000);
  };

  const branchToSandbox = () => {
    const current = historyData[historyIndex];
    if (current) {
      setPrice(current.actual_price);
      setSentiment(current.sentiment_score);
    }
    setIsPlayingHistory(false);
    setActiveTab("sandbox");
  };

  const handleThemeToggle = (e: React.MouseEvent) => {
    const nextIsDark = !darkMode;
    if (!document.startViewTransition) {
      setDarkMode(nextIsDark);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      setDarkMode(nextIsDark);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: "ease-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  const yAxisMin = forecastData.length > 0
    ? Math.floor(Math.min(...forecastData.map((d) => d.lower_bound)) * 0.98)
    : 3000;
  const yAxisMax = forecastData.length > 0
    ? Math.ceil(Math.max(...forecastData.map((d) => d.upper_bound)) * 1.02)
    : 6000;

  const anomalyAlert = useMemo(() => {
    if (sentiment <= -0.5) return { type: "danger", title: "High Fear Detected", message: `Retail sentiment dropped to ${sentiment.toFixed(2)}. Expected downward volatility.` };
    if (sentiment >= 0.8) return { type: "warning", title: "Extreme Euphoria", message: `Retail sentiment unusually high (${sentiment.toFixed(2)}). Risk of localized bubble.` };
    if (hype >= 4000000) return { type: "danger", title: "Unprecedented Social Volume", message: `Hype volume exceeds 4M posts. Expect erratic price swings.` };
    return null;
  }, [sentiment, hype]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
  };

  if (!isMounted) return null;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? "bg-[#020617] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <style dangerouslySetInnerHTML={{
        __html: `
        ::view-transition-old(root),
        ::view-transition-new(root) {
          animation: none;
          mix-blend-mode: normal;
        }
      `}} />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#3C1053] to-[#BF5CFF] rounded-xl flex items-center justify-center shadow-lg">
              <Activity className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Emotion-Based Market Forecaster</h1>
              <p className={`text-sm font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                NatWest Hackathon Phase 2 • Advanced AI Quantile Regression
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleThemeToggle}
            aria-label="Toggle Dark Mode"
            className={`relative w-12 h-12 flex items-center justify-center rounded-full shadow-sm border focus:outline-none focus:ring-2 focus:ring-[#BF5CFF] focus:ring-offset-2 ${darkMode ? "bg-slate-800 border-slate-700 shadow-[#BF5CFF]/10 focus:ring-offset-[#020617]" : "bg-white border-slate-200"}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={darkMode ? "dark" : "light"}
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute"
              >
                {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {error && (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded shadow-sm">
            <p className="font-bold">Connection Error</p>
            <p>{error}</p>
          </div>
        )}

        <AnimatePresence>
          {flashDanger && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#CE3B57] pointer-events-none z-50"
            />
          )}
        </AnimatePresence>

        <div className={`flex space-x-2 p-1 rounded-lg w-fit mb-6 transition-colors duration-300 ${darkMode ? "bg-slate-800/80" : "bg-slate-200/80"}`}>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all duration-300 ${activeTab === "history" ? (darkMode ? "bg-slate-700 shadow-sm text-[#BF5CFF]" : "bg-white shadow-sm text-[#3C1053]") : (darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700")}`}
          >
            Act 1: Historical Proof
          </button>
          <button
            onClick={() => setActiveTab("sandbox")}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all duration-300 ${activeTab === "sandbox" ? (darkMode ? "bg-slate-700 shadow-sm text-[#BF5CFF]" : "bg-white shadow-sm text-[#3C1053]") : (darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700")}`}
          >
            Act 2: Future Sandbox
          </button>
        </div>

        <AnimatePresence>
          {anomalyAlert && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className={`p-4 rounded-r-lg border-l-4 flex items-start space-x-3 shadow-sm overflow-hidden mb-6 ${anomalyAlert.type === "danger"
                ? darkMode ? "bg-[#CE3B57]/20 border-[#CE3B57]" : "bg-[#CE3B57]/10 border-[#CE3B57]"
                : darkMode ? "bg-orange-500/20 border-orange-500" : "bg-orange-100 border-orange-500"
                }`}
            >
              <AlertTriangle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${anomalyAlert.type === "danger" ? "text-[#CE3B57]" : "text-orange-500"}`} />
              <div>
                <h3 className={`font-bold ${anomalyAlert.type === "danger" ? "text-[#CE3B57]" : "text-orange-500"}`}>
                  {anomalyAlert.title}
                </h3>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                  {anomalyAlert.message}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === "history" && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <motion.div variants={itemVariants} className={`lg:col-span-8 border rounded-xl shadow-sm p-6 ${darkMode ? "bg-[#0F172A] border-[#1E293B]" : "bg-white border-slate-200"}`}>
              <h2 className="text-lg font-bold mb-4">2021 Meme-Stock Simulation</h2>
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <ComposedChart data={historyData.slice(0, historyIndex + 1)} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#334155" : "#e2e8f0"} opacity={0.6} />
                    <XAxis dataKey="date" tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 12 }} tickFormatter={(tick) => `$${tick}`} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: darkMode ? '#020617' : '#ffffff', borderColor: darkMode ? '#1e293b' : '#e2e8f0', color: darkMode ? '#f8fafc' : '#0f172a', borderRadius: "8px" }} />
                    <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 500 }}>{value}</span>} />
                    <Line type="monotone" dataKey="actual_price" stroke={darkMode ? "#94a3b8" : "#64748b"} strokeWidth={2} dot={false} name="Actual Market Price" isAnimationActive={true} animationDuration={150} animationEasing="linear" />
                    <Line type="monotone" dataKey="predicted_likely" stroke={darkMode ? "#BF5CFF" : "#3C1053"} strokeWidth={3} dot={false} name="AI Prediction" isAnimationActive={true} animationDuration={150} animationEasing="linear" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div variants={containerVariants} className="lg:col-span-4 flex flex-col space-y-6">
              <motion.div variants={itemVariants} className={`border rounded-xl shadow-sm p-6 ${darkMode ? "bg-[#0F172A] border-[#1E293B]" : "bg-white border-slate-200"}`}>
                <h3 className="text-sm font-bold mb-4">Time Machine Controls</h3>
                <div className="flex space-x-2 mb-6">
                  <button onClick={() => setIsPlayingHistory(!isPlayingHistory)} className={`flex-1 py-2 rounded font-bold flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-[#BF5CFF] ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}>
                    {isPlayingHistory ? <><Pause className="w-4 h-4 mr-2" /> Pause</> : <><Play className="w-4 h-4 mr-2" /> Play</>}
                  </button>
                  <button onClick={() => setHistoryIndex((prev) => Math.min(prev + 1, historyData.length - 1))} className={`px-4 py-2 rounded flex items-center transition-all focus:outline-none focus:ring-2 focus:ring-[#BF5CFF] ${darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"}`}>
                    <StepForward className="w-4 h-4" />
                  </button>
                </div>

                <div className={`p-4 rounded-lg mb-6 ${darkMode ? "bg-slate-800/50" : "bg-slate-50"}`}>
                  <p className={`text-xs mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Date: <strong className={darkMode ? "text-white" : "text-slate-900"}>{historyData[historyIndex]?.date || "--"}</strong></p>
                  <p className={`text-xs mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Actual: <strong className={darkMode ? "text-white" : "text-slate-900"}>${historyData[historyIndex]?.actual_price || "--"}</strong></p>
                  <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Sentiment: <strong className={darkMode ? "text-white" : "text-slate-900"}>{historyData[historyIndex]?.sentiment_score || "--"}</strong></p>
                </div>

                <button onClick={branchToSandbox} className="w-full py-3 rounded-xl font-bold flex items-center justify-center bg-gradient-to-r from-[#3C1053] to-[#BF5CFF] text-white hover:shadow-lg hover:-translate-y-1 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#BF5CFF] focus:ring-offset-2">
                  <GitBranch className="w-5 h-5 mr-2" /> Branch to Sandbox
                </button>

                {/* Radar Feed Box */}
                <div className={`mt-6 h-48 overflow-y-auto p-4 border rounded-xl shadow-sm ${darkMode ? "bg-[#020617]/50 border-[#1E293B]" : "bg-slate-50 border-slate-200"}`}>
                  <h3 className="text-sm font-bold mb-3 flex items-center">
                    <Activity className="w-4 h-4 mr-2" /> Radar Feed
                  </h3>
                  <div className="space-y-2">
                    {radarAlerts.length === 0 ? (
                      <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Scanning for anomalies...</p>
                    ) : (
                      radarAlerts.map((alert, i) => (
                        <motion.div key={`${alert.day}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`p-3 text-xs rounded-lg border-l-2 ${alert.type === 'fear' ? (darkMode ? "bg-[#CE3B57]/10 border-[#CE3B57] text-red-200" : "bg-red-50 border-[#CE3B57] text-[#CE3B57]") : (darkMode ? "bg-green-500/10 border-green-500 text-green-200" : "bg-green-50 border-green-500 text-green-700")}`}>
                          🚨 <strong>RADAR ALERT:</strong> {alert.type === 'fear' ? 'Market Panic Detected' : 'Extreme Euphoria Detected'} (Z-Score: {alert.z}). {alert.type === 'fear' ? 'Expected downward pressure.' : 'Risk of localized bubble.'}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "sandbox" && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <motion.div variants={itemVariants} className={`lg:col-span-8 border rounded-xl shadow-sm p-6 relative ${darkMode ? "bg-[#0F172A] border-[#1E293B]" : "bg-white border-slate-200"}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">30-Day Forward Trajectory</h2>
                {isFetching && <Loader2 className="w-5 h-5 animate-spin text-[#BF5CFF]" />}
              </div>

              <div className={`w-full h-[400px] transition-opacity duration-300 ${isFetching ? "opacity-50" : "opacity-100"}`}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <ComposedChart key={chartKey} data={mappedData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorUncertainty" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#BF5CFF" stopOpacity={darkMode ? 0.35 : 0.25} />
                        <stop offset="95%" stopColor={darkMode ? "#BF5CFF" : "#3C1053"} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#334155" : "#e2e8f0"} opacity={0.6} />
                    <XAxis dataKey="day" type="number" domain={[1, 30]} tickCount={6} tickFormatter={(tick) => `Day ${tick}`} tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[yAxisMin, yAxisMax]} tick={{ fill: darkMode ? "#94a3b8" : "#64748b", fontSize: 12 }} tickFormatter={(tick) => `$${tick}`} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: darkMode ? '#020617' : '#ffffff', borderColor: darkMode ? '#1e293b' : '#e2e8f0', color: darkMode ? '#f8fafc' : '#0f172a', borderRadius: "8px", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} formatter={(value: any, name: string) => [Array.isArray(value) ? `[$${value[0]}, $${value[1]}]` : `$${value}`, name]} labelFormatter={(label) => `Forecast Day: ${label}`} />
                    <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 500 }}>{value}</span>} />

                    <Area type="monotone" dataKey="uncertainty" stroke="none" fill="url(#colorUncertainty)" name="90% Confidence Bounds" isAnimationActive={true} animationDuration={isSimulating ? 3000 : 500} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="likely_price" stroke={darkMode ? "#BF5CFF" : "#3C1053"} strokeWidth={4} dot={false} name="Likely Price (Median)" isAnimationActive={true} animationDuration={isSimulating ? 3000 : 500} animationEasing="ease-out" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {forecastData.length === 30 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-6 border rounded-lg p-4 ${darkMode ? "bg-[#009FAC]/10 border-[#009FAC]/20" : "bg-[#009FAC]/5 border-[#009FAC]/20"}`}>
                  <h4 className="font-semibold flex items-center mb-1 text-sm">
                    <Info className="w-4 h-4 mr-2 text-[#009FAC]" />
                    AI Summary Output
                  </h4>
                  <p className={`text-sm leading-relaxed ml-6 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Next 6 weeks (30 days): Expected{" "}
                    <span className={`font-bold ${forecastData[29].likely_price > forecastData[0].likely_price ? "text-green-500" : "text-[#CE3B57]"}`}>
                      {forecastData[29].likely_price > forecastData[0].likely_price ? "Growth" : "Decline"}
                    </span>.
                    Model projects S&P 500 to stabilize near{" "}
                    <strong className={darkMode ? "text-white" : "text-slate-900"}>${forecastData[29].likely_price.toFixed(2)}</strong>.
                    Lower bound: <strong className={darkMode ? "text-white" : "text-slate-900"}>${forecastData[29].lower_bound.toFixed(2)}</strong>.
                    Upper bound: <strong className={darkMode ? "text-white" : "text-slate-900"}>${forecastData[29].upper_bound.toFixed(2)}</strong>.
                  </p>
                </motion.div>
              )}
            </motion.div>

            <motion.div variants={containerVariants} className="lg:col-span-4 flex flex-col space-y-6">
              <motion.div variants={itemVariants} className={`border rounded-xl shadow-sm p-6 ${darkMode ? "bg-[#0F172A] border-[#1E293B]" : "bg-white border-slate-200"}`}>
                <h2 className={`text-lg font-bold mb-6 border-b pb-2 ${darkMode ? "border-[#1E293B]" : "border-slate-100"}`}>
                  Scenario Testing
                </h2>

                <div className="space-y-6">
                  <div className="group">
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="price-slider" className={`text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Current Price</label>
                      <span className={`text-sm font-bold px-2 py-1 rounded transition-transform group-hover:scale-110 ${darkMode ? "bg-slate-800 text-[#BF5CFF]" : "bg-slate-100 text-[#3C1053]"}`}>
                        ${price}
                      </span>
                    </div>
                    <input id="price-slider" type="range" min="3000" max="6000" step="10" value={price} onChange={(e) => setPrice(Number(e.target.value))} disabled={isSimulating} className={`w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full ${darkMode ? "bg-slate-800 accent-[#BF5CFF]" : "bg-slate-200 accent-[#3C1053]"}`} />
                  </div>

                  <div className="group">
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="sentiment-slider" className={`text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Retail Sentiment</label>
                      <span className={`text-sm font-bold px-2 py-1 rounded transition-transform group-hover:scale-110 ${sentiment < 0 ? (darkMode ? "bg-[#CE3B57]/20 text-red-400" : "bg-red-50 text-[#CE3B57]") : sentiment > 0 ? (darkMode ? "bg-green-500/20 text-green-400" : "bg-green-50 text-green-700") : (darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}`}>
                        {sentiment > 0 ? "+" : ""}{sentiment.toFixed(2)}
                      </span>
                    </div>
                    <input id="sentiment-slider" type="range" min="-1.0" max="1.0" step="0.05" value={sentiment} onChange={(e) => setSentiment(Number(e.target.value))} disabled={isSimulating} className={`w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 accent-[#009FAC] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                  </div>

                  <div className="group">
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="hype-slider" className={`text-sm font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Social Hype Volume</label>
                      <span className={`text-sm font-bold px-2 py-1 rounded transition-transform group-hover:scale-110 ${darkMode ? "bg-slate-800 text-[#BF5CFF]" : "bg-slate-100 text-[#3C1053]"}`}>
                        {(hype / 1000000).toFixed(2)}M posts
                      </span>
                    </div>
                    <input id="hype-slider" type="range" min="1" max="5000000" step="10000" value={hype} onChange={(e) => setHype(Number(e.target.value))} disabled={isSimulating} className={`w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full ${darkMode ? "bg-slate-800 accent-[#BF5CFF]" : "bg-slate-200 accent-[#3C1053]"}`} />
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className={`border rounded-xl shadow-sm p-6 mt-auto ${darkMode ? "bg-[#0F172A] border-[#1E293B]" : "bg-white border-slate-200"}`}>
                <h3 className="text-sm font-bold mb-2">Presentation Mode</h3>
                <p className={`text-xs mb-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Watch the AI predict 30 days of market trajectory in real-time.
                </p>

                <button onClick={startLiveSimulation} disabled={isSimulating} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#BF5CFF] focus:ring-offset-2 ${isSimulating ? darkMode ? "bg-slate-800 text-slate-500 cursor-not-allowed focus:ring-0" : "bg-slate-100 text-slate-400 cursor-not-allowed focus:ring-0" : "bg-gradient-to-r from-[#3C1053] to-[#BF5CFF] text-white hover:shadow-lg hover:shadow-[#BF5CFF]/30 hover:-translate-y-1"}`}>
                  {isSimulating ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Simulating...</> : <><Play className="w-5 h-5 mr-2 fill-current" /> Start Live Simulation</>}
                </button>
              </motion.div>

            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}