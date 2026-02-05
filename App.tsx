
import React, { useState, useRef } from 'react';
import { SUPPORTED_LANGUAGES, DetectionResultType, AnalysisResult, TesterState, HoneypotTesterState } from './types';
import { analyzeAudio } from './services/geminiService';
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lab' | 'tester' | 'honeypot' | 'guidelines'>('lab');
  
  // Lab State
  const [selectedLanguage, setSelectedLanguage] = useState<string>(SUPPORTED_LANGUAGES[0].name);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [labError, setLabError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Tester State (Synchronized with screenshot fields)
  const [tester, setTester] = useState<TesterState>({
    endpoint: '',
    apiKey: '',
    language: 'English',
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
      setLabError(err.message || 'Analysis engine unavailable.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Voice Tester Actions
  const handleTestEndpoint = async () => {
    if (!tester.endpoint || !tester.apiKey || !tester.audioBase64) {
      setTester(prev => ({ ...prev, status: 'error', response: { error: "Missing mandatory fields (*) required for validation." } }));
      return;
    }
    setTester(prev => ({ ...prev, status: 'loading', response: null, latency: null }));
    const startTime = performance.now();
    try {
      const response = await fetch(tester.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': tester.apiKey
        },
        body: JSON.stringify({ 
          "Language": tester.language,
          "Audio Format": tester.audioFormat,
          "Audio Base64 Format": tester.audioBase64
        })
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
      setHoneypot(prev => ({ ...prev, status: 'error', response: { error: "Honeypot URL is required." } }));
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
          timestamp: new Date().toISOString()
        })
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => responseHeaders[key] = val);

      let data;
      try { data = await response.json(); } catch { data = await response.text(); }

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
                        <BarChart data={chartData}>
                          <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={60}>
                            <Cell fill={result.classification === DetectionResultType.HUMAN ? '#10b981' : '#f43f5e'}/>
                          </Bar>
                        </BarChart>
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
          <section className="space-y-8 animate-in fade-in duration-300">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-left space-y-3">
                <h2 className="text-2xl font-bold text-slate-100">AI-Generated Voice Detection – API Endpoint Tester</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Validate your voice authentication endpoint before submission. Test authentication, payload handling, and JSON structure by submitting a sample audio base64 input.
                </p>
              </div>

              {/* Exact Screenshot Replication Layout */}
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-8">
                
                {/* Headers Section */}
                <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-700/50 space-y-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-200">Headers</h3>
                    <span className="text-rose-500 font-bold text-xs">*</span>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-400">x-api-key <span className="text-rose-500">*</span></label>
                    <input 
                      type="password" 
                      placeholder="Enter x-api-key" 
                      className="w-full bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 text-sm outline-none border border-slate-300 focus:ring-2 focus:ring-[#0052cc] transition-all" 
                      value={tester.apiKey} 
                      onChange={(e) => setTester(prev => ({ ...prev, apiKey: e.target.value }))} 
                    />
                  </div>
                </div>

                {/* Endpoint URL Section */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-400">Endpoint URL <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder="Enter endpoint url" 
                    className="w-full bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 text-sm outline-none border border-slate-300 focus:ring-2 focus:ring-[#0052cc] transition-all" 
                    value={tester.endpoint} 
                    onChange={(e) => setTester(prev => ({ ...prev, endpoint: e.target.value }))} 
                  />
                </div>

                {/* Request Body Section */}
                <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-700/50 space-y-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-200">Request Body</h3>
                    <span className="text-rose-500 font-bold text-xs">*</span>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-400">Language <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      placeholder="Enter language (e.g., English, Tamil)" 
                      className="w-full bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 text-sm outline-none border border-slate-300 focus:ring-2 focus:ring-[#0052cc] transition-all" 
                      value={tester.language} 
                      onChange={(e) => setTester(prev => ({ ...prev, language: e.target.value }))} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-400">Audio Format <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      placeholder="Enter audio format (e.g., mp3)" 
                      className="w-full bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 text-sm outline-none border border-slate-300 focus:ring-2 focus:ring-[#0052cc] transition-all" 
                      value={tester.audioFormat} 
                      onChange={(e) => setTester(prev => ({ ...prev, audioFormat: e.target.value }))} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-400">Audio Base64 Format <span className="text-rose-500">*</span></label>
                    <textarea 
                      placeholder="Paste your base64-encoded audio string here" 
                      rows={6}
                      className="w-full bg-[#f8fafc] text-[#0f172a] rounded-xl px-4 py-3 text-sm outline-none border border-slate-300 focus:ring-2 focus:ring-[#0052cc] transition-all resize-none font-mono text-[11px]" 
                      value={tester.audioBase64} 
                      onChange={(e) => setTester(prev => ({ ...prev, audioBase64: e.target.value }))} 
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end items-center gap-4 pt-6 border-t border-slate-700/50">
                  <button 
                    onClick={() => setActiveTab('lab')}
                    className="px-8 py-2.5 text-slate-400 hover:text-white bg-transparent border border-slate-600 hover:border-slate-400 rounded-xl text-sm font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleTestEndpoint} 
                    disabled={tester.status === 'loading'}
                    className={`px-10 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${tester.status === 'loading' ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-[#0052cc] hover:bg-[#0747a6] text-white shadow-xl shadow-indigo-500/10'}`}
                  >
                    {tester.status === 'loading' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : null}
                    {tester.status === 'loading' ? 'Processing...' : 'Test Endpoint'}
                  </button>
                </div>
              </div>

              {/* Status & Response Visualization */}
              {tester.response && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-6 pb-20">
                  <div className="lg:col-span-2 bg-[#020617] border border-slate-800 rounded-3xl p-6 font-mono text-xs shadow-2xl">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                      <span className="text-slate-500 font-bold uppercase tracking-wider">RAW_JSON_RESPONSE</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${tester.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {tester.status === 'success' ? 'HTTP 200 OK' : 'REQUEST_FAILURE'}
                      </span>
                    </div>
                    <pre className="text-cyan-300 overflow-x-auto p-2 whitespace-pre-wrap">{JSON.stringify(tester.response, null, 2)}</pre>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Performance Metrics</h4>
                      <div className="text-3xl font-black text-white">{tester.latency || '--'} <span className="text-[10px] text-slate-500 uppercase">ms</span></div>
                    </div>
                    <div className={`p-6 rounded-2xl border ${tester.response?.classification ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <i className={`fa-solid ${tester.response?.classification ? 'fa-check-double' : 'fa-triangle-exclamation'}`}></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">COMPLIANCE_STATUS</span>
                      </div>
                      <p className="text-[11px] font-medium leading-relaxed">
                        {tester.response?.classification 
                          ? 'Valid JSON schema: Identification fields present and accounted for.' 
                          : 'Schema violation: Mandatory classification/confidence fields missing.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Honeypot & Guidelines Content remains consistent with theme */}
        {activeTab === 'honeypot' && (
          <section className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
            <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-8 shadow-xl backdrop-blur-md">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-2">
                  <i className="fa-solid fa-spider text-amber-500"></i>
                  Deceptive Probe Tester (Honeypot)
                </h3>
                <p className="text-sm text-slate-400">Validate the response integrity of your scam-intel traps. Ensure appropriate intelligence extraction schemas are returned.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Honeypot Target URL</label>
                  <input type="text" placeholder="https://trap.yourdomain.com/v1/auth" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={honeypot.endpoint} onChange={(e) => setHoneypot(prev => ({ ...prev, endpoint: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1 space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auth Key</label>
                    <input type="text" placeholder="x-api-key" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={honeypot.headerKey} onChange={(e) => setHoneypot(prev => ({ ...prev, headerKey: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Value</label>
                    <input type="password" placeholder="SECRET_TOKEN" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={honeypot.apiKey} onChange={(e) => setHoneypot(prev => ({ ...prev, apiKey: e.target.value }))} />
                  </div>
                </div>
              </div>
              <button onClick={handleTestHoneypot} disabled={honeypot.status === 'loading'} className={`w-full mt-8 py-4 rounded-2xl text-sm font-bold uppercase transition-all flex items-center justify-center gap-3 ${honeypot.status === 'loading' ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg'}`}>
                {honeypot.status === 'loading' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bug-slash"></i>}
                {honeypot.status === 'loading' ? 'Pinging Trap...' : 'Test Honeypot Response'}
              </button>
            </div>
            {honeypot.response && (
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 font-mono text-[11px] shadow-2xl animate-in slide-in-from-top-4">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                    <span className="text-slate-500 font-bold uppercase tracking-wider">TRAP_FORENSIC_RESULT</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${honeypot.statusCode && honeypot.statusCode < 300 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      STATUS_{honeypot.statusCode}
                    </span>
                 </div>
                 <pre className="text-amber-400 overflow-x-auto whitespace-pre-wrap">{typeof honeypot.response === 'string' ? honeypot.response : JSON.stringify(honeypot.response, null, 2)}</pre>
              </div>
            )}
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
