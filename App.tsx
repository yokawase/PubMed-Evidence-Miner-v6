
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, BookOpen, ChevronRight, CheckCircle2, FileText, Languages, Network, CheckCircle, Printer, Download, Square, CheckSquare } from 'lucide-react';
import { MeshTerm, PubMedArticle, AppStep } from './types';
import * as pubmedService from './services/pubmedService';
import * as geminiService from './services/geminiService';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [target, setTarget] = useState('');
  const [meshTerms, setMeshTerms] = useState<MeshTerm[]>([]);
  const [hitCount, setHitCount] = useState(0);
  const [articles, setArticles] = useState<PubMedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [progress, setProgress] = useState(0); // 0 to 100
  const [finalReport, setFinalReport] = useState('');

  // 1. MeSH Extraction
  const handleExtractMesh = async () => {
    if (!target) return;
    setIsLoading(true);
    setProgress(20);
    setLoadingMsg('Gemini AIがターゲットからMeSHキーワードを抽出中...');
    try {
      const terms = await geminiService.extractMeshTerms(target);
      setProgress(100);
      setMeshTerms(terms.map(t => ({ id: Math.random().toString(), term: t, selected: true })));
      setTimeout(() => {
        setStep(AppStep.MESH_SELECTION);
        setIsLoading(false);
      }, 500);
    } catch (e) {
      alert("MeSH抽出に失敗しました。");
      setIsLoading(false);
    }
  };

  // 2. Real-time Search Refresh
  const refreshSearchCount = useCallback(async () => {
    const selected = meshTerms.filter(m => m.selected).map(m => `"${m.term}"[MeSH Terms]`);
    if (selected.length === 0) {
      setHitCount(0);
      return;
    }
    const query = selected.join(' AND ');
    const result = await pubmedService.searchPubMed(query);
    setHitCount(result.count);
  }, [meshTerms]);

  useEffect(() => {
    if (step === AppStep.MESH_SELECTION) {
      refreshSearchCount();
    }
  }, [meshTerms, step, refreshSearchCount]);

  // Toggle MeSH
  const toggleMesh = (id: string) => {
    setMeshTerms(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  };

  // 3. Fetch and Analyze Papers
  const handleProceedToPapers = async () => {
    setIsLoading(true);
    setProgress(5);
    setLoadingMsg('PubMedから文献リストを取得中...');
    try {
      const selected = meshTerms.filter(m => m.selected).map(m => `"${m.term}"[MeSH Terms]`);
      const query = selected.join(' AND ');
      const searchResult = await pubmedService.searchPubMed(query);
      
      setProgress(20);
      setLoadingMsg(`${searchResult.ids.length}件の抄録を取得中...`);
      const details = await pubmedService.fetchPubMedDetails(searchResult.ids);
      
      const analyzedPapers: PubMedArticle[] = [];
      for (let i = 0; i < details.length; i++) {
        const currentProgress = 20 + Math.round(((i + 1) / details.length) * 75);
        setProgress(currentProgress);
        setLoadingMsg(`論文を解析・翻訳中 (${i + 1} / ${details.length})...`);
        
        const analysis = await geminiService.translateAndAnalyzeArticle(details[i], target);
        analyzedPapers.push({ ...details[i], ...analysis, selected: false });
      }
      
      setProgress(100);
      setLoadingMsg('準備完了');
      setArticles(analyzedPapers);
      setTimeout(() => {
        setStep(AppStep.PAPER_SELECTION);
        setIsLoading(false);
      }, 500);
    } catch (e) {
      alert("論文の取得または解析に失敗しました。");
      setIsLoading(false);
    }
  };

  // Toggle Paper Selection
  const togglePaper = (id: string) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
  };

  // Toggle All Papers
  const handleToggleAllPapers = () => {
    const allSelected = articles.every(a => a.selected);
    setArticles(prev => prev.map(a => ({ ...a, selected: !allSelected })));
  };

  // 4. Final Synthesis
  const handleGenerateSynthesis = async () => {
    const selected = articles.filter(a => a.selected);
    if (selected.length === 0) return;
    setIsLoading(true);
    setProgress(30);
    setLoadingMsg('全論文を統合して考察を生成中 (Gemini 3 Pro)...');
    try {
      const report = await geminiService.synthesizeFinalReport(selected, target);
      setProgress(100);
      setFinalReport(report);
      setTimeout(() => {
        setStep(AppStep.FINAL_SYNTHESIS);
        setIsLoading(false);
      }, 500);
    } catch (e) {
      alert("考察の生成に失敗しました。");
      setIsLoading(false);
    }
  };

  // 5. Download Report
  const handleDownloadReport = () => {
    const selectedReferences = articles
      .filter(a => a.selected)
      .map(a => `- ${a.title} (PMID: ${a.id})`)
      .join('\n');
    
    const content = `臨床エビデンス統合レポート\nターゲット: ${target}\n\n${finalReport}\n\n採用された参考文献:\n${selectedReferences}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Evidence_Report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stepsInfo = [
    { label: '入力', icon: Search },
    { label: 'MeSH選択', icon: Network },
    { label: '論文査読', icon: BookOpen },
    { label: '統合考察', icon: FileText },
  ];

  const allArticlesSelected = articles.length > 0 && articles.every(a => a.selected);

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white p-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-inner">
                <Network size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter">Evidence Miner <span className="text-blue-400">v4.5</span></h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Scientific Insights Engine</p>
              </div>
            </div>
          </div>
          
          {/* Progress Stepper */}
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -translate-y-1/2 z-0"></div>
            {stepsInfo.map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === idx;
              const isCompleted = step > idx;
              return (
                <div key={idx} className="relative z-10 flex flex-col items-center gap-2 group">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
                    isActive ? 'bg-blue-600 border-blue-400 scale-110 shadow-lg shadow-blue-500/30' : 
                    isCompleted ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}>
                    {isCompleted ? <CheckCircle size={20} /> : <Icon size={18} />}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? 'text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto mt-8 px-6">
        {/* Detailed Loading Overlay with Progress Bar */}
        {isLoading && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center text-white px-4">
            <div className="text-center p-10 rounded-3xl bg-slate-800 border border-slate-700 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-300">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                <div 
                  className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"
                  style={{ animationDuration: '1.5s' }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold">
                  {progress}%
                </div>
              </div>
              
              <h3 className="text-xl font-bold mb-2 tracking-tight">{loadingMsg}</h3>
              <p className="text-sm text-slate-400 mb-8 italic">Gemini Proが医療エビデンスを精査しています...</p>
              
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Step Content */}
        {step === AppStep.INPUT && (
          <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-slate-800">
              <Search className="text-blue-600" />
              1. ターゲット設定
            </h2>
            <p className="text-slate-500 mb-6 leading-relaxed">
              調査したい臨床的な問いやキーワードを入力してください。<br/>
              Geminiが適切なMeSH（医療主題見出し）戦略を立案します。
            </p>
            <textarea
              className="w-full h-48 p-6 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none text-lg resize-none shadow-inner"
              placeholder="例: GLP-1受容体作動薬の非アルコール性脂肪肝炎に対する有効性と安全性..."
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <button
              onClick={handleExtractMesh}
              disabled={!target || isLoading}
              className="mt-8 w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
            >
              MeSH戦略を生成
              <ChevronRight size={24} />
            </button>
          </div>
        )}

        {step === AppStep.MESH_SELECTION && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-2xl font-black mb-2 flex items-center gap-3 text-slate-800">
                <Network className="text-blue-600" />
                2. 検索キーワードの調整 (MeSH)
              </h2>
              <p className="text-slate-500 mb-8">PubMedの精度の高い検索のため、以下のMeSHタームを推奨します。</p>
              
              <div className="flex flex-wrap gap-3 mb-10">
                {meshTerms.map(mesh => (
                  <button
                    key={mesh.id}
                    onClick={() => toggleMesh(mesh.id)}
                    className={`px-6 py-3 rounded-2xl border-2 transition-all font-bold ${
                      mesh.selected 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105' 
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {mesh.term}
                  </button>
                ))}
              </div>

              <div className="p-8 bg-slate-900 rounded-3xl flex flex-col md:flex-row items-center justify-between text-white gap-6">
                <div className="text-center md:text-left">
                  <p className="text-slate-400 text-xs uppercase tracking-widest font-black mb-1">PubMed Hit Count</p>
                  <p className="text-5xl font-mono font-bold text-blue-400 tabular-nums">
                    {hitCount.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={handleProceedToPapers}
                  disabled={hitCount === 0 || isLoading}
                  className="w-full md:w-auto bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-blue-400 transition-all disabled:opacity-50 shadow-lg"
                >
                  文献の取得と解析を開始
                </button>
              </div>
            </div>
            
            <button onClick={() => setStep(AppStep.INPUT)} className="px-4 py-2 text-slate-400 font-bold hover:text-blue-600 transition-colors flex items-center gap-2">
              ← 入力へ戻る
            </button>
          </div>
        )}

        {step === AppStep.PAPER_SELECTION && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between px-2 gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-800">3. 文献エビデンスの精査</h2>
                <p className="text-slate-500 text-sm">Geminiが翻訳・解析した抄録を確認し、統合考察に含める文献を選択してください。</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleToggleAllPapers}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-bold transition-all text-sm ${
                    allArticlesSelected 
                    ? 'bg-blue-50 border-blue-200 text-blue-600' 
                    : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-500'
                  }`}
                >
                  {allArticlesSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  全選択 / 解除
                </button>
                <div className="bg-blue-600 text-white px-5 py-2 rounded-2xl text-sm font-black shadow-lg">
                  {articles.filter(a => a.selected).length} 件選択中
                </div>
              </div>
            </div>

            <div className="grid gap-8">
              {articles.map(article => (
                <div 
                  key={article.id}
                  onClick={() => togglePaper(article.id)}
                  className={`group relative bg-white p-8 rounded-3xl border-2 transition-all cursor-pointer ${
                    article.selected ? 'border-blue-500 ring-4 ring-blue-500/5 shadow-xl scale-[1.01]' : 'border-slate-100 hover:border-blue-200'
                  }`}
                >
                  <div className={`absolute top-6 right-8 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                    article.selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-transparent'
                  }`}>
                    <CheckCircle2 size={20} />
                  </div>
                  
                  <h3 className="text-xl font-black text-slate-900 mb-4 pr-12 leading-tight">
                    {article.translatedTitle || article.title}
                  </h3>
                  
                  <div className="flex gap-3 mb-6">
                    <span className="bg-slate-900 text-white text-[10px] px-3 py-1 rounded-full font-bold">PMID: {article.id}</span>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">和訳抄録</p>
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-6">
                          {article.translatedAbstract || article.abstract}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">AI Relevance Insight</p>
                      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                        <p className="text-sm text-blue-900 leading-relaxed font-medium">
                          {article.relevanceAnalysis}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-8 bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl flex items-center justify-between">
               <div className="hidden md:block">
                 <p className="text-blue-400 text-xs font-black uppercase tracking-widest">Next Step</p>
                 <p className="text-white text-sm">選択したエビデンスから臨床的考察を生成します</p>
               </div>
               <button
                 onClick={handleGenerateSynthesis}
                 disabled={articles.filter(a => a.selected).length === 0 || isLoading}
                 className="w-full md:w-auto bg-blue-600 text-white px-12 py-4 rounded-2xl font-black text-lg hover:bg-blue-500 transition-all disabled:opacity-50 shadow-xl flex items-center justify-center gap-3"
               >
                 <BookOpen size={20} />
                 統合考察レポートを生成
               </button>
            </div>
          </div>
        )}

        {step === AppStep.FINAL_SYNTHESIS && (
          <div className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-200 animate-in fade-in zoom-in-95 duration-700">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 pb-6 border-b border-slate-100 gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                  <FileText className="text-blue-600" size={32} />
                  エビデンス統合レポート
                </h2>
                <p className="text-slate-400 text-sm font-bold mt-1">Generated by Gemini 3 Pro with Clinical Logic</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.print()} 
                  className="flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all shadow-sm"
                  title="PDFとして印刷"
                >
                  <Printer size={18} />
                  印刷
                </button>
                <button 
                  onClick={handleDownloadReport} 
                  className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                  title="テキストファイルとして保存"
                >
                  <Download size={18} />
                  保存
                </button>
              </div>
            </div>
            
            <div className="prose prose-slate max-w-none">
              <div className="whitespace-pre-wrap text-slate-800 leading-relaxed text-xl font-serif">
                {finalReport}
              </div>
            </div>

            <div className="mt-16 pt-10 border-t border-slate-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">採用された参考文献 (Selected References)</h4>
              <div className="grid gap-3">
                {articles.filter(a => a.selected).map(a => (
                  <div key={a.id} className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                      {a.id.slice(-2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{a.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono">PUBMED ID: {a.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 flex justify-center">
              <button
                onClick={() => setStep(AppStep.INPUT)}
                className="px-10 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black hover:bg-blue-50 hover:text-blue-600 transition-all border-2 border-transparent hover:border-blue-100"
              >
                新しい解析を開始する
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 text-center py-12 border-t border-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <img src="https://www.ncbi.nlm.nih.gov/coreutils/nwds/img/logos/ncbi-logo.svg" alt="NCBI" className="h-6 opacity-30 grayscale" />
            <div className="w-px h-4 bg-slate-200"></div>
            <p className="text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase">Powered by Gemini AI 2.5</p>
          </div>
          <p className="text-[10px] text-slate-400 max-w-md mx-auto leading-relaxed">
            本システムは研究補助ツールです。生成された内容は必ず一次文献を確認し、臨床的判断は医師の責任において行ってください。
          </p>
        </div>
      </footer>
    </div>
  );
}
