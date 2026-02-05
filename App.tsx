
import React, { useState, useRef } from 'react';
import { SUPPORTED_LANGUAGES, DetectionResultType, AnalysisResult, TesterState, HoneypotTesterState } from './types';
import { analyzeAudio } from './services/geminiService';
import { BarChart, Bar, Cell, ResponsiveContainer } from 'recharts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lab' | 'tester' | 'honeypot' | 'guidelines'>('lab');
  
  // Lab State
  const [selectedLanguage, setSelectedLanguage] = useState(SUPPORTED_LANGUAGES[0].name);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [labError, setLabError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Tester State
  const [tester, setTester] = useState<TesterState>({
    endpoint: '',
    apiKey: '',
    audioUrl: '',
    message: '',
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
    try {
      const base64 = await convertToBase64(file);
      const analysis = await analyzeAudio(base64, file.type, selectedLanguage);
      setResult(analysis);
    } catch (err: any) {
      setLabError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Voice Tester Actions
  const handleTestEndpoint = async () => {
    if (!tester.endpoint || !tester.audioUrl) {
      setTester(prev => ({ ...prev, status: 'error', response: { error: "Endpoint and Audio URL are required." } }));
      return;
    }
    setTester(prev => ({ ...prev, status: 'loading', response: null, latency: null }));
    const startTime = performance.now();
    try {
      const audioRes = await fetch(tester.audioUrl);
      if (!audioRes.ok) throw new Error("Failed to fetch audio from URL.");
      const audioBlob = await audioRes.blob();
      const base64 = await convertToBase64(audioBlob);
      const response = await fetch(tester.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': tester.apiKey.startsWith('Bearer') ? tester.apiKey : `Bearer ${tester.apiKey}`,
          'X-Test-Message': tester.message
        },
        body: JSON.stringify({ audio: base64 })
      });
      const endTime = performance.now();
      const data = await response.json();
      setTester(prev => ({ 
        ...prev, 
        status: response.ok ? 'success' : 'error', 
        response: data,
        latency: Math.round(endTime - startTime)
      }));
    } catch (err: any) {
      setTester(prev => ({ ...prev, status: 'error', response: { error: err.message } }));
    }
  };

  // Honeypot Tester Actions
  const handleTestHoneypot = async () => {
    if (!honeypot.endpoint) {
      setHoneypot(prev => ({ ...prev, status: 'error', response: { error: "Endpoint URL is required." } }));
      return;
    }
    setHoneypot(prev => ({ ...prev, status: 'loading', response: null, statusCode: null }));
    try {
      const response = await fetch(honeypot.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [honeypot.headerKey]: honeypot.apiKey
        },
        body: JSON.stringify({ 
          test: "honeypot_probe", 
          timestamp: new Date().toISOString(),
          context: "participant_validation_tool"
        })
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => responseHeaders[key] = val);

      let data;
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }

      setHoneypot(prev => ({
        ...prev,
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        response: data,
        headers: responseHeaders
      }));
    } catch (err: any) {
      setHoneypot(prev => ({ ...prev, status: 'error', response: { error: err.message } }));
    }
  };

  const chartData = result ? [{ name: 'Confidence', value: result.confidence * 100 }] : [];

  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-100">
      <header className="max-w-5xl w-full text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 mb-4 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
          <i className="fa-solid fa-shield-halved text-3xl text-white"></i>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          VoiceGuard AI & Security Hub
        </h1>
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mt-8 overflow-x-auto pb-2">
          <div className="inline-flex p-1 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl min-w-max">
            <button 
              onClick={() => setActiveTab('lab')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'lab' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <i className="fa-solid fa-flask-vial"></i> <span className="hidden sm:inline">Detection Lab</span>
            </button>
            <button 
              onClick={() => setActiveTab('tester')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'tester' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <i className="fa-solid fa-vial-circle-check"></i> <span className="hidden sm:inline">Voice API Tester</span>
            </button>
            <button 
              onClick={() => setActiveTab('honeypot')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'honeypot' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <i className="fa-solid fa-spider"></i> <span className="hidden sm:inline">Honeypot Tester</span>
            </button>
            {/* Guidelines button hidden from tab but logic kept in context */}
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full space-y-8">
        {activeTab === 'lab' && (
          <>
            <section className="bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">1. Select Language</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLanguage(lang.name)}
                        className={`px-3 py-3 rounded-xl text-[10px] font-bold transition-all border ${selectedLanguage === lang.name ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">2. Forensic Sample</label>
                  <div 
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer h-32 flex flex-col items-center justify-center ${file ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-600 hover:border-indigo-500 bg-slate-900/50'}`}
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
                className={`w-full mt-8 py-4 rounded-2xl text-sm font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-3 ${!file || isAnalyzing ? 'bg-slate-700 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20'}`}
              >
                {isAnalyzing ? <i className="fa-solid fa-dna fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                {isAnalyzing ? 'Decoding Voice Patterns...' : 'Run Forensic Scan'}
              </button>
            </section>
            {labError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-6 py-4 rounded-2xl flex items-center gap-4 text-xs font-bold"><i className="fa-solid fa-circle-exclamation"></i>{labError}</div>}
            {result && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-3xl p-8 relative overflow-hidden">
                    <div className={`absolute top-0 right-0 px-4 py-2 text-[10px] font-black uppercase ${result.classification === DetectionResultType.HUMAN ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>AUTHENTICATED RESULT</div>
                    <div className="flex items-center gap-6 mb-8">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${result.classification === DetectionResultType.HUMAN ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'}`}>
                        <i className={`fa-solid ${result.classification === DetectionResultType.HUMAN ? 'fa-user-shield' : 'fa-robot'}`}></i>
                      </div>
                      <div>
                        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Signal Origin</h2>
                        <p className={`text-4xl font-black ${result.classification === DetectionResultType.HUMAN ? 'text-emerald-400' : 'text-rose-400'}`}>{result.classification.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
                        <h3 className="text-[10px] font-bold text-indigo-400 uppercase mb-3 tracking-widest">Logic Breakdown</h3>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium">{result.reasoning}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        <i className="fa-solid fa-wave-square text-indigo-500"></i>
                        <span>{result.spectralNotes}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 flex flex-col items-center">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Confidence Index</h3>
                    <div className="w-full h-48 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}><Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={60}><Cell fill={result.classification === DetectionResultType.HUMAN ? '#10b981' : '#f43f5e'}/></Bar></BarChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-5xl font-black text-white">{(result.confidence * 100).toFixed(0)}%</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold mt-1">Probability</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === 'tester' && (
          <section className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">API Endpoint URL</label>
                  <input type="text" placeholder="https://api.yourdomain.com/detect" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={tester.endpoint} onChange={(e) => setTester(prev => ({ ...prev, endpoint: e.target.value }))} />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auth Key (Bearer/Token)</label>
                  <input type="password" placeholder="••••••••••••••••" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={tester.apiKey} onChange={(e) => setTester(prev => ({ ...prev, apiKey: e.target.value }))} />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Public MP3 Audio URL</label>
                  <input type="text" placeholder="https://example.com/voice.mp3" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={tester.audioUrl} onChange={(e) => setTester(prev => ({ ...prev, audioUrl: e.target.value }))} />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test Reference Message</label>
                  <input type="text" placeholder="Probe #001" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={tester.message} onChange={(e) => setTester(prev => ({ ...prev, message: e.target.value }))} />
                </div>
              </div>
              <button onClick={handleTestEndpoint} disabled={tester.status === 'loading'} className={`w-full mt-8 py-4 rounded-2xl text-sm font-bold uppercase transition-all flex items-center justify-center gap-3 ${tester.status === 'loading' ? 'bg-slate-700 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'}`}>
                {tester.status === 'loading' ? <i className="fa-solid fa-satellite-dish fa-beat"></i> : <i className="fa-solid fa-vial"></i>}
                {tester.status === 'loading' ? 'Pinging Endpoint...' : 'Validate Voice API'}
              </button>
            </div>
            {tester.response && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4">
                <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-6 font-mono text-xs shadow-2xl">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                    <span className="text-slate-500 uppercase tracking-widest font-black">JSON_RESPONSE</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${tester.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{tester.status === 'success' ? '200 OK' : 'ERR_COMM'}</span>
                  </div>
                  <pre className="text-indigo-300 overflow-x-auto p-2">{JSON.stringify(tester.response, null, 2)}</pre>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Network Latency</h4>
                    <div className="text-3xl font-black text-white">{tester.latency || '--'} <span className="text-[10px] text-slate-500">ms</span></div>
                  </div>
                  <div className={`p-6 rounded-2xl border ${tester.response?.classification ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <i className={`fa-solid ${tester.response?.classification ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                      <span className="text-[10px] font-black uppercase tracking-widest">Schema Check</span>
                    </div>
                    <p className="text-xs font-medium">{tester.response?.classification ? 'Valid response structure detected.' : 'Missing required JSON fields.'}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'honeypot' && (
          <section className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl">
              <div className="mb-8">
                <h3 className="text-lg font-bold text-white flex items-center gap-3 mb-2">
                  <i className="fa-solid fa-spider text-amber-500"></i>
                  Honeypot Endpoint Tester
                </h3>
                <p className="text-sm text-slate-400">Verify your trap's connectivity, authentication headers, and response structure.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Honeypot URL</label>
                  <input type="text" placeholder="https://trap.yourdomain.com/v1/auth" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={honeypot.endpoint} onChange={(e) => setHoneypot(prev => ({ ...prev, endpoint: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1 space-y-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Header Key</label>
                    <input type="text" placeholder="x-api-key" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={honeypot.headerKey} onChange={(e) => setHoneypot(prev => ({ ...prev, headerKey: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Header Value / Key</label>
                    <input type="password" placeholder="SECRET_TRAP_KEY" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={honeypot.apiKey} onChange={(e) => setHoneypot(prev => ({ ...prev, apiKey: e.target.value }))} />
                  </div>
                </div>
              </div>
              <button onClick={handleTestHoneypot} disabled={honeypot.status === 'loading'} className={`w-full mt-8 py-4 rounded-2xl text-sm font-bold uppercase transition-all flex items-center justify-center gap-3 ${honeypot.status === 'loading' ? 'bg-slate-700 text-slate-500' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20'}`}>
                {honeypot.status === 'loading' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bug"></i>}
                {honeypot.status === 'loading' ? 'Triggering Trap...' : 'Test Honeypot Endpoint'}
              </button>
            </div>

            {honeypot.response && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4">
                <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-6 font-mono text-xs">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                    <span className="text-slate-500 uppercase tracking-widest font-black">TRAP_OUTPUT</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${honeypot.statusCode && honeypot.statusCode < 400 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>HTTP {honeypot.statusCode}</span>
                  </div>
                  <div className="mb-4">
                    <p className="text-[10px] text-slate-600 mb-2 uppercase tracking-widest font-bold underline">Response Headers</p>
                    <pre className="text-slate-500 whitespace-pre-wrap">{JSON.stringify(honeypot.headers, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 mb-2 uppercase tracking-widest font-bold underline">Response Body</p>
                    <pre className="text-amber-300 whitespace-pre-wrap">{typeof honeypot.response === 'string' ? honeypot.response : JSON.stringify(honeypot.response, null, 2)}</pre>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Health Status</h4>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${honeypot.status === 'success' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-rose-500'}`}></div>
                      <span className="text-sm font-bold">{honeypot.status === 'success' ? 'REACHABLE' : 'UNREACHABLE'}</span>
                    </div>
                  </div>
                  <div className="bg-amber-600/10 border border-amber-500/20 rounded-2xl p-6">
                    <h4 className="text-[10px] font-bold text-amber-500 uppercase mb-2 tracking-widest">Honeypot Insight</h4>
                    <p className="text-xs text-slate-400 leading-relaxed italic">
                      Successful honeypots often return standard-looking responses to deceptive probes to keep attackers engaged while logging their metadata.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'guidelines' && (
          <section className="space-y-8 animate-in fade-in duration-300 pb-12">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl">
              <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                <i className="fa-solid fa-scroll text-indigo-400"></i>
                Submission Rules & Guidelines
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Rules Section */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Endpoint Submission Rules</h3>
                    <ul className="space-y-4">
                      {[
                        "Participants must submit one public API endpoint URL",
                        "The endpoint must correspond to the selected problem statement",
                        "The endpoint must be live, accessible, and stable during evaluation",
                        "Participants must provide a valid API key for authentication",
                        "Late or non-working endpoints will not be evaluated"
                      ].map((rule, idx) => (
                        <li key={idx} className="flex gap-4 text-sm text-slate-300">
                          <i className="fa-solid fa-circle-check text-indigo-500 mt-1"></i>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Evaluation System Behavior</h3>
                    <ul className="space-y-4">
                      {[
                        "Sending official test inputs to your endpoint",
                        "Validating authentication using the provided API key",
                        "Checking request handling and response structure",
                        "Evaluating the correctness and stability of your solution"
                      ].map((task, idx) => (
                        <li key={idx} className="flex gap-4 text-sm text-slate-300">
                          <i className="fa-solid fa-microchip text-indigo-400 mt-1"></i>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Specifics & Readiness */}
                <div className="space-y-6">
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50">
                    <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-4">Problem-Specific Requirements</h3>
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                        <p className="text-xs font-bold text-slate-200 mb-1">Problem 1: AI Voice Detection</p>
                        <p className="text-xs text-slate-400">API must accept audio input (Base64 MP3) and return classification results (HUMAN/AI_GENERATED) with confidence.</p>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                        <p className="text-xs font-bold text-slate-200 mb-1">Problem 2: Agentic Honey-Pot</p>
                        <p className="text-xs text-slate-400">API must accept scam messages and return extracted intelligence according to specified JSON schema.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">Evaluation Readiness Checklist</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <i className="fa-solid fa-users-viewfinder text-emerald-500"></i>
                        <span className="text-xs font-medium text-slate-300">Handle multiple concurrent requests reliably</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <i className="fa-solid fa-code text-emerald-500"></i>
                        <span className="text-xs font-medium text-slate-300">Correct JSON response format (strictly as defined)</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <i className="fa-solid fa-gauge-high text-emerald-500"></i>
                        <span className="text-xs font-medium text-slate-300">Low latency and robust error handling</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-center">
                <h4 className="text-sm font-bold text-indigo-300 mb-2 uppercase tracking-widest">Outcome of This Level</h4>
                <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mx-auto">
                  Your endpoint moves to the automated evaluation stage where results and scores will be generated based on API performance, accuracy, and security response metrics.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-auto py-12 text-slate-600 text-[10px] uppercase tracking-[0.3em] flex flex-col items-center gap-4 text-center">
        <div className="flex gap-8 overflow-x-auto max-w-full px-4">
          <span className="hover:text-slate-400 transition-colors cursor-pointer border-b border-transparent hover:border-slate-500 whitespace-nowrap">Security Specs</span>
          <span className="hover:text-slate-400 transition-colors cursor-pointer border-b border-transparent hover:border-slate-500 whitespace-nowrap">API Documentation</span>
          <span className="hover:text-slate-400 transition-colors cursor-pointer border-b border-transparent hover:border-slate-500 whitespace-nowrap">Ethics & Policy</span>
        </div>
        <p>Advanced Forensic Audio Authentication &bull; 2024</p>
      </footer>
    </div>
  );
};

export default App;
