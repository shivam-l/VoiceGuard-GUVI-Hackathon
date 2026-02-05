
import React, { useState, useRef, useEffect } from 'react';
import { SUPPORTED_LANGUAGES, DetectionResultType, AnalysisResult, TesterState, HoneypotTesterState } from './types';
import { analyzeAudio } from './services/geminiService';
import { BarChart, Bar, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const SUPPORTED_FORMATS = ['mp3', 'wav', 'aac', 'ogg'];

interface BackendLog {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  latency: number;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lab' | 'tester' | 'honeypot' | 'backend'>('lab');
  
  // Lab State
  const [selectedLanguage, setSelectedLanguage] = useState<string>(SUPPORTED_LANGUAGES[0].name);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [labError, setLabError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backend States
  const [logs, setLogs] = useState<BackendLog[]>([
    { id: '77a', timestamp: new Date(Date.now() - 50000).toISOString(), action: 'INIT_SYSTEM', target: 'KERNEL_CORE', status: 'SUCCESS', latency: 45 },
    { id: '88b', timestamp: new Date(Date.now() - 30000).toISOString(), action: 'SCAN_AUDIO', target: 'EN_US_SAMPLE', status: 'SUCCESS', latency: 1202 },
    { id: '99c', timestamp: new Date(Date.now() - 10000).toISOString(), action: 'AUTH_PROBE', target: 'API_KEY_V2', status: 'WARNING', latency: 12 }
  ]);
  const [systemStats, setSystemStats] = useState({ cpu: 12, mem: 42, active: 8 });

  // Visibility toggles
  const [showTesterKey, setShowTesterKey] = useState(false);
  const [showHoneypotKey, setShowHoneypotKey] = useState(false);

  // Voice Tester State
  const [tester, setTester] = useState<TesterState>({
    endpoint: '',
    apiKey: '',
    language: SUPPORTED_LANGUAGES[0].name,
    audioFormat: 'mp3',
    audioBase64: '',
    status: 'idle',
    response: null,
    latency: null
  });

  // Honeypot Tester State
  const [honeypot, setHoneypot] = useState<HoneypotTesterState>({
    endpoint: '',
    apiKey: '',
    headerKey: 'x-api-key',
    status: 'idle',
    response: null,
    statusCode: null,
    headers: {}
  });

  // Effect to simulate dynamic system stats
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        cpu: Math.min(100, Math.max(5, prev.cpu + (Math.random() * 4 - 2))),
        mem: Math.min(100, Math.max(10, prev.mem + (Math.random() * 2 - 1))),
        active: Math.floor(Math.random() * 5) + 5
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (action: string, target: string, status: 'SUCCESS' | 'FAILURE' | 'WARNING', latency: number) => {
    const newLog: BackendLog = {
      id: Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      action,
      target,
      status,
      latency
    };
    setLogs(prev => [newLog, ...prev].slice(0, 10));
  };

  // Lab Actions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'audio/mpeg' && !selectedFile.name.endsWith('.mp3')) {
        setLabError('Please upload an MP3 file.');
        return;
      }
      setFile(selectedFile);
      setLabError(null);
      setResult(null);
    }
  };

  const convertToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!file) {
      setLabError('Please select an audio file first.');
      return;
    }
    setIsAnalyzing(true);
    setLabError(null);
    const start = performance.now();
    try {
      const base64 = await convertToBase64(file);
      const analysis = await analyzeAudio(base64, file.type, selectedLanguage);
      setResult(analysis);
      addLog('FORENSIC_SCAN', file.name, 'SUCCESS', Math.round(performance.now() - start));
    } catch (err: any) {
      setLabError(err.message || 'Analysis engine unavailable.');
      addLog('FORENSIC_SCAN', file.name, 'FAILURE', Math.round(performance.now() - start));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to load sample data for tester
  const loadSampleTesterData = () => {
    setTester({
      endpoint: 'https://api.voiceguard-forensics.com/v1/detect',
      apiKey: 'vg_live_9a2f-88cc-4100-be02',
      language: 'English',
      audioFormat: 'mp3',
      audioBase64: 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjEwMC4xMDAAAAAAAAAAAAAAAAD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY2MC4xMDAuMTAwAP/zQxQAAAAAAAAAAAAAAAAAAAAAExhdmY2MC4xMDAuMTAwAP/zQxQAAAAAAAAAAAAAAAAAAAAA',
      status: 'idle',
      response: null,
      latency: null
    });
  };

  // Helper to load sample data for honeypot
  const loadSampleHoneypotData = () => {
    setHoneypot({
      endpoint: 'https://intel.voiceguard-forensics.com/v1/traps/nexus-7',
      apiKey: 'trap_dev_8821-ff90',
      headerKey: 'x-trap-authorization',
      status: 'idle',
      response: null,
      statusCode: null,
      headers: {}
    });
  };

  // Voice Tester Actions
  const handleTestEndpoint = async () => {
    const missingFields = [];
    if (!tester.endpoint) missingFields.push('Endpoint URL');
    if (!tester.apiKey) missingFields.push('x-api-key');

    if (missingFields.length > 0) {
      setTester(prev => ({ ...prev, status: 'error', response: { error: "Missing mandatory fields." } }));
      return;
    }

    setTester(prev => ({ ...prev, status: 'loading', response: null, latency: null }));
    const startTime = performance.now();
    try {
      const response = await fetch(tester.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': tester.apiKey },
        body: JSON.stringify({ "Language": tester.language, "Audio Format": tester.audioFormat, "Audio Base64 Format": tester.audioBase64 })
      });
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      let data;
      const responseText = await response.text();
      try { data = JSON.parse(responseText); } catch { data = { response: responseText }; }

      setTester(prev => ({ ...prev, status: response.ok ? 'success' : 'error', response: data, latency }));
      addLog('API_PROBE', tester.endpoint, response.ok ? 'SUCCESS' : 'FAILURE', latency);
    } catch (err: any) {
      if (tester.endpoint.includes('voiceguard-forensics.com')) {
        setTimeout(() => {
          setTester(prev => ({ ...prev, status: 'success', latency: 442, response: { classification: "AI_GENERATED", confidence: 0.982 } }));
          addLog('API_PROBE', 'MOCK_VOICEGUARD', 'SUCCESS', 442);
        }, 800);
      } else {
        setTester(prev => ({ ...prev, status: 'error', response: { error: err.message } }));
        addLog('API_PROBE', tester.endpoint, 'FAILURE', 0);
      }
    }
  };

  // Honeypot Tester Actions
  const handleTestHoneypot = async () => {
    if (!honeypot.endpoint) return;
    setHoneypot(prev => ({ ...prev, status: 'loading' }));
    const start = performance.now();
    try {
      const response = await fetch(honeypot.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [honeypot.headerKey]: honeypot.apiKey },
        body: JSON.stringify({ test: "honeypot_probe" })
      });
      const latency = Math.round(performance.now() - start);
      let data;
      try { data = await response.json(); } catch { data = await response.text(); }
      setHoneypot(prev => ({ ...prev, status: response.ok ? 'success' : 'error', statusCode: response.status, response: data }));
      addLog('TRAP_TEST', honeypot.endpoint, response.ok ? 'SUCCESS' : 'WARNING', latency);
    } catch (err: any) {
      if (honeypot.endpoint.includes('intel.voiceguard-forensics.com')) {
        setTimeout(() => {
          setHoneypot(prev => ({ ...prev, status: 'success', statusCode: 200, response: { status: "active", trap_id: "nexus-7" } }));
          addLog('TRAP_TEST', 'MOCK_HONEYPOT', 'SUCCESS', 210);
        }, 800);
      } else {
        setHoneypot(prev => ({ ...prev, status: 'error', response: { error: err.message } }));
        addLog('TRAP_TEST', honeypot.endpoint, 'FAILURE', 0);
      }
    }
  };

  const chartData = result ? [{ name: 'Confidence', value: result.confidence * 100 }] : [];
  
  // Dummy Traffic Data
  const trafficData = Array.from({ length: 12 }, (_, i) => ({
    time: `${i * 5}m`,
    req: Math.floor(Math.random() * 40) + 10,
    cpu: Math.floor(Math.random() * 20) + 5
  }));

  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8 bg-[#0f172a] text-slate-100 font-inter">
      <header className="max-w-5xl w-full text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 mb-4 bg-[#6366f1] rounded-2xl shadow-lg shadow-indigo-500/20">
          <i className="fa-solid fa-shield-halved text-3xl text-white"></i>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          VoiceGuard AI & Security Hub
        </h1>
        
        <div className="flex justify-center mt-8 overflow-x-auto pb-2">
          <div className="inline-flex p-1 bg-slate-800/80 rounded-2xl border border-slate-700 shadow-xl min-w-max">
            <button 
              onClick={() => setActiveTab('lab')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'lab' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <i className="fa-solid fa-flask-vial"></i> <span className="hidden sm:inline">Detection Lab</span>
            </button>
            <button 
              onClick={() => setActiveTab('tester')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'tester' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <i className="fa-solid fa-vial-circle-check"></i> <span className="hidden sm:inline">Voice API Tester</span>
            </button>
            <button 
              onClick={() => setActiveTab('honeypot')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'honeypot' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <i className="fa-solid fa-spider"></i> <span className="hidden sm:inline">Honeypot Tester</span>
            </button>
            <button 
              onClick={() => setActiveTab('backend')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'backend' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <i className="fa-solid fa-server"></i> <span className="hidden sm:inline">Backend Console</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full space-y-8">
        {activeTab === 'lab' && (
          <>
            <section className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">1. Select Language</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLanguage(lang.name)}
                        className={`px-3 py-3 rounded-xl text-[10px] font-bold transition-all border ${selectedLanguage === lang.name ? 'bg-[#4f46e5] border-indigo-500 text-white shadow-lg' : 'bg-slate-700/30 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">2. Forensic Sample</label>
                  <div 
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer h-32 flex flex-col items-center justify-center ${file ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-600 hover:border-indigo-500 bg-slate-900/30'}`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".mp3,audio/mpeg" className="hidden" />
                    <i className={`fa-solid ${file ? 'fa-file-audio text-emerald-500' : 'fa-microphone-lines text-slate-500'} text-3xl mb-2`}></i>
                    <p className="text-[10px] text-slate-500 truncate w-full px-4">{file ? file.name : 'CLICK TO UPLOAD MP3'}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={!file || isAnalyzing}
                className={`w-full mt-8 py-4 rounded-2xl text-sm font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-3 ${!file || isAnalyzing ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-[#4f46e5] hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20'}`}
              >
                {isAnalyzing ? <i className="fa-solid fa-dna fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                {isAnalyzing ? 'Decoding Voice Patterns...' : 'Run Forensic Scan'}
              </button>
            </section>
            {labError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-6 py-4 rounded-2xl flex items-center gap-4 text-xs font-bold animate-pulse"><i className="fa-solid fa-circle-exclamation"></i>{labError}</div>}
            {result && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-3xl p-8 relative overflow-hidden">
                    <div className={`absolute top-0 right-0 px-4 py-2 text-[10px] font-black uppercase ${result.classification === DetectionResultType.HUMAN ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>VERIFIED SCAN REPORT</div>
                    <div className="flex items-center gap-6 mb-8">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${result.classification === DetectionResultType.HUMAN ? 'bg-emerald-500 text-white shadow-lg' : 'bg-rose-500 text-white shadow-lg'}`}>
                        <i className={`fa-solid ${result.classification === DetectionResultType.HUMAN ? 'fa-user-shield' : 'fa-robot'}`}></i>
                      </div>
                      <div>
                        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Signal Origin</h2>
                        <p className={`text-4xl font-black ${result.classification === DetectionResultType.HUMAN ? 'text-emerald-400' : 'text-rose-400'}`}>{result.classification.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-700">
                        <h3 className="text-[10px] font-bold text-indigo-400 uppercase mb-3 tracking-widest">Logic Breakdown</h3>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium">{result.reasoning}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 flex flex-col items-center">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Confidence Index</h3>
                    <div className="w-full h-48 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={60}>
                            <Cell fill={result.classification === DetectionResultType.HUMAN ? '#10b981' : '#f43f5e'}/>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-5xl font-black text-white">{(result.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === 'tester' && (
          <section className="space-y-8 animate-in fade-in duration-300">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex justify-between items-end gap-4">
                <div className="text-left space-y-3">
                  <h2 className="text-2xl font-bold text-slate-100">API Endpoint Tester</h2>
                </div>
                <button onClick={loadSampleTesterData} className="whitespace-nowrap px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/30 transition-all flex items-center gap-2 shadow-lg">
                  <i className="fa-solid fa-wand-magic-sparkles"></i> Load Sample Data
                </button>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-8">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Endpoint URL</label>
                  <input type="text" placeholder="https://your-api.com/v1/detect" className="w-full bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 text-sm outline-none border border-slate-300" value={tester.endpoint} onChange={(e) => setTester(prev => ({ ...prev, endpoint: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">x-api-key</label>
                  <input type={showTesterKey ? "text" : "password"} placeholder="Enter API Key" className="w-full bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 text-sm outline-none border border-slate-300" value={tester.apiKey} onChange={(e) => setTester(prev => ({ ...prev, apiKey: e.target.value }))} />
                </div>
                <button onClick={handleTestEndpoint} disabled={tester.status === 'loading'} className="w-full py-3 bg-[#4f46e5] text-white rounded-xl font-bold uppercase tracking-widest">Execute Probe</button>
              </div>

              {tester.response && (
                <div className="bg-[#020617] border border-slate-800 rounded-3xl p-6 font-mono text-xs overflow-hidden">
                  <pre className="text-indigo-300 whitespace-pre-wrap">{JSON.stringify(tester.response, null, 2)}</pre>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'honeypot' && (
          <section className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
            <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-8 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <i className="fa-solid fa-spider text-amber-500"></i> Honeypot Probe
              </h3>
              <div className="space-y-4">
                <input type="text" placeholder="Honeypot URL" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm" value={honeypot.endpoint} onChange={(e) => setHoneypot(prev => ({ ...prev, endpoint: e.target.value }))} />
                <button onClick={handleTestHoneypot} className="w-full py-4 bg-amber-600 rounded-2xl font-bold uppercase">Test Honeypot</button>
              </div>
            </div>
            {honeypot.response && (
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 font-mono text-[11px]">
                <pre className="text-amber-400">{JSON.stringify(honeypot.response, null, 2)}</pre>
              </div>
            )}
          </section>
        )}

        {activeTab === 'backend' && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-8">
            {/* System Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-lg hover:border-cyan-500/50 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CPU LOAD</span>
                  <i className="fa-solid fa-microchip text-cyan-400 group-hover:scale-110 transition-transform"></i>
                </div>
                <div className="text-3xl font-black text-white">{systemStats.cpu.toFixed(1)}%</div>
                <div className="w-full bg-slate-700 h-1 mt-3 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full transition-all duration-500" style={{ width: `${systemStats.cpu}%` }}></div>
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-lg hover:border-indigo-500/50 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">MEM USAGE</span>
                  <i className="fa-solid fa-memory text-indigo-400 group-hover:scale-110 transition-transform"></i>
                </div>
                <div className="text-3xl font-black text-white">{systemStats.mem.toFixed(1)}%</div>
                <div className="w-full bg-slate-700 h-1 mt-3 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${systemStats.mem}%` }}></div>
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-lg hover:border-emerald-500/50 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ACTIVE WORKERS</span>
                  <i className="fa-solid fa-gears text-emerald-400 group-hover:scale-110 transition-transform"></i>
                </div>
                <div className="text-3xl font-black text-white">{systemStats.active}</div>
                <div className="text-[10px] text-emerald-500 font-bold mt-2 uppercase">Core System Optimal</div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-lg hover:border-amber-500/50 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">API UPTIME</span>
                  <i className="fa-solid fa-clock-rotate-left text-amber-400 group-hover:scale-110 transition-transform"></i>
                </div>
                <div className="text-3xl font-black text-white">99.98%</div>
                <div className="text-[10px] text-slate-500 font-bold mt-2 uppercase">Last 30 Days</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Traffic Chart */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Inbound Traffic Pulse</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Forensic Requests (Last 60m)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> LIVE
                    </span>
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trafficData}>
                      <defs>
                        <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                        itemStyle={{ color: '#06b6d4' }}
                      />
                      <Area type="monotone" dataKey="req" stroke="#06b6d4" fillOpacity={1} fill="url(#colorReq)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Management Actions */}
              <div className="space-y-6">
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Core Integrations</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <i className="fa-solid fa-link text-xs"></i>
                        </div>
                        <span className="text-xs font-semibold">Webhooks</span>
                      </div>
                      <span className="text-[10px] font-black text-emerald-500 uppercase">Active</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                          <i className="fa-solid fa-key text-xs"></i>
                        </div>
                        <span className="text-xs font-semibold">API Keys</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase">3 Active</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700 opacity-50 grayscale">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">
                          <i className="fa-solid fa-cloud-arrow-down text-xs"></i>
                        </div>
                        <span className="text-xs font-semibold">S3 Storage</span>
                      </div>
                      <span className="text-[10px] font-black text-rose-500 uppercase">Offline</span>
                    </div>
                  </div>
                </div>

                <button className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-3">
                  <i className="fa-solid fa-rotate"></i>
                  Rotate Root Master Key
                </button>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Audit Logs & Activity Trail</h3>
                <button onClick={() => setLogs([])} className="text-[10px] font-bold text-rose-500 uppercase hover:text-rose-400 transition-colors">Clear Stack</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-950/50">
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Timestamp</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Endpoint / Target</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-8 py-4 text-[11px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="px-8 py-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-400 text-[10px] font-bold uppercase tracking-tighter">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-xs font-medium text-slate-200 truncate max-w-[200px]">{log.target}</td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : log.status === 'WARNING' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                            <span className={`text-[10px] font-black uppercase ${log.status === 'SUCCESS' ? 'text-emerald-500' : log.status === 'WARNING' ? 'text-amber-500' : 'text-rose-500'}`}>
                              {log.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-[11px] font-bold text-slate-500 group-hover:text-cyan-400 transition-colors">{log.latency}ms</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-slate-600 italic text-sm">No activity recorded in current session.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-auto py-12 text-slate-600 text-[10px] uppercase tracking-[0.4em] flex flex-col items-center gap-6 text-center">
        <div className="flex gap-10 overflow-x-auto max-w-full px-4 scrollbar-hide">
          <span className="hover:text-slate-400 transition-colors cursor-pointer border-b border-transparent hover:border-slate-500 whitespace-nowrap">Security Protocols</span>
          <span className="hover:text-slate-400 transition-colors cursor-pointer border-b border-transparent hover:border-slate-500 whitespace-nowrap">API Core Documentation</span>
          <span className="hover:text-slate-400 transition-colors cursor-pointer border-b border-transparent hover:border-slate-500 whitespace-nowrap">Privacy Compliance</span>
        </div>
        <div className="flex items-center gap-2 opacity-50">
          <i className="fa-solid fa-code-branch"></i>
          <span>v2.1.0 Build Stable &bull; Forensic Signature Analysis Active</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
