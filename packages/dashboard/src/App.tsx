import { useState, useEffect, useMemo } from 'react';
import { Download, Activity, Brain, Shield, MessageSquare, AlertTriangle, Save, Trash2, type LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getOverrides, saveOverride, exportData, type HumanOverride } from './lib/storage';
import type { QuestionNode, ModelRun, AugmentedResult } from './types';

// --- Data Importing ---
// In a real app, this might be a fetch call. Here we import directly from the engine output.
// Ensure you have run `npm run gen` and `npm run eval` in the engine package first.
import questionsData from '../../eval-engine/data/questions.json';
import resultsData from '../../eval-engine/data/results.json';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const ScoreRing = ({ score }: { score: number }) => {
  const offset = 251.2 - (251.2 * score / 100);
  
  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 -rotate-90">
        <circle cx="48" cy="48" r="40" fill="none" stroke="#27272a" strokeWidth="8"/>
        <circle 
          className="score-ring" 
          cx="48" cy="48" r="40" 
          fill="none" 
          stroke={score > 80 ? "#10b981" : score > 50 ? "#fbbf24" : "#ef4444"} 
          strokeWidth="8" 
          strokeLinecap="round"
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-zinc-100">
        {Math.round(score)}
      </span>
    </div>
  );
};

const MetricCard = ({ label, score, icon: Icon }: { label: string, score: number, icon: LucideIcon }) => (
  <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-zinc-500" />
      <span className="text-sm text-zinc-400">{label}</span>
    </div>
    <span className={cn(
      "text-sm font-medium",
      score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400"
    )}>
      {score}/100
    </span>
  </div>
);

export default function App() {
  const [overrides, setOverrides] = useState<Record<string, HumanOverride>>({});
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Load Overrides on Mount
  useEffect(() => {
    setOverrides(getOverrides());
  }, []);

  // Merge Data
  const augmentedResults = useMemo(() => {
    // Handle case where data files don't exist or are empty
    if (!Array.isArray(resultsData) || resultsData.length === 0) {
      return [];
    }
    if (!Array.isArray(questionsData) || questionsData.length === 0) {
      return [];
    }
    
    return (resultsData as ModelRun[]).map((r) => {
      const q = (questionsData as QuestionNode[]).find((q) => q.id === r.questionId);
      const override = overrides[r.runId];
      
      // Effective Score: Manual override takes precedence over AI
      const effectiveScore = override ? override.manualScore : r.aiAssessment.score;
      
      return { ...r, question: q!, override, effectiveScore } as AugmentedResult;
    });
  }, [overrides]);

  const activeRun = augmentedResults.find(r => r.runId === selectedRunId) || (augmentedResults.length > 0 ? augmentedResults[0] : null);

  // Aggregates
  const stats = useMemo(() => {
    if (augmentedResults.length === 0) {
      return { avg: 0, byCat: {} };
    }
    
    const total = augmentedResults.reduce((acc, r) => acc + r.effectiveScore, 0);
    const avg = Math.round(total / augmentedResults.length) || 0;
    
    // Calculate category breakdowns
    const byCat: Record<string, number[]> = {};
    augmentedResults.forEach(r => {
      if(!byCat[r.question.category]) byCat[r.question.category] = [];
      byCat[r.question.category].push(r.effectiveScore);
    });

    return { avg, byCat };
  }, [augmentedResults]);

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if(!activeRun) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const score = Number(formData.get('manualScore'));
    const notes = String(formData.get('notes'));

    const newOverride: HumanOverride = {
      manualScore: score,
      expertNotes: notes,
      rankAdjustment: 0,
      lastUpdated: Date.now()
    };

    const updated = saveOverride(activeRun.runId, newOverride);
    setOverrides(updated);
  };

  const handleExport = () => {
    exportData(resultsData, overrides);
  };

  const handleClearOverrides = () => {
      if(confirm('Are you sure? This will delete all your manual reviews from LocalStorage.')) {
          localStorage.removeItem('therapy_eval_overrides');
          setOverrides({});
      }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-end mb-8 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-light tracking-tight">CBT/DBT <span className="text-emerald-400">Evaluator</span></h1>
            <p className="text-zinc-500 text-sm mt-1">Reviewing {augmentedResults.length} model responses</p>
          </div>
          <div className="flex gap-3">
             <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-200 transition-colors">
              <Download className="w-4 h-4" />
              Export Dataset
            </button>
            <button onClick={handleClearOverrides} className="flex items-center gap-2 px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-sm transition-colors border border-red-900/50">
              <Trash2 className="w-4 h-4" />
              Reset Reviews
            </button>
          </div>
        </header>

        {/* Show helpful message if no data */}
        {augmentedResults.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <Brain className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-zinc-400 mb-2">No evaluation data found</h2>
            <p className="text-zinc-500 text-sm mb-6">
              Run the evaluation engine first to generate data for review.
            </p>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-left max-w-md mx-auto">
              <code className="text-xs text-emerald-400">
                # Generate questions<br />
                yarn eval:gen<br /><br />
                # Run evaluation<br />
                yarn eval:run
              </code>
            </div>
          </div>
        ) : (
          <>
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
            <ScoreRing score={stats.avg} />
            <div>
              <div className="text-zinc-400 text-sm">Overall Quality</div>
              <div className="text-2xl font-semibold text-white">{stats.avg}%</div>
            </div>
          </div>
          
          {Object.entries(stats.byCat).map(([cat, scores]) => (
            <div key={cat} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-center">
              <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">{cat} Performance</div>
              <div className="text-2xl font-medium text-zinc-200">
                {Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)}%
              </div>
              <div className="w-full bg-zinc-800 h-1 mt-2 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full", cat==='CBT'?'bg-sky-500': cat==='DBT'?'bg-violet-500':'bg-emerald-500')} 
                  style={{ width: `${Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-12 gap-6 h-[600px]">
            
          {/* List Sidebar */}
          <div className="col-span-4 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
              <h3 className="text-sm font-medium text-zinc-400">Response Queue</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {augmentedResults.map(r => (
                <button
                  key={r.runId}
                  onClick={() => setSelectedRunId(r.runId)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all",
                    activeRun?.runId === r.runId 
                      ? "bg-emerald-900/10 border-emerald-500/50" 
                      : "bg-zinc-800/30 border-transparent hover:bg-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      r.question.category === 'CBT' ? 'bg-sky-500/20 text-sky-400' : 
                      r.question.category === 'DBT' ? 'bg-violet-500/20 text-violet-400' : 'bg-red-500/20 text-red-400'
                    )}>
                      {r.question.category}
                    </span>
                    {r.override && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded">Reviewed</span>}
                  </div>
                  <div className="text-sm text-zinc-300 font-medium truncate">{r.question.title}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="text-xs text-zinc-500">{r.modelName}</div>
                    <div className={cn(
                        "text-xs font-mono ml-auto",
                        r.effectiveScore >= 80 ? "text-emerald-400" : "text-zinc-500"
                    )}>
                        {r.effectiveScore}/100
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detailed View */}
          <div className="col-span-8 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
             {activeRun ? (
               <div className="flex flex-col h-full">
                  {/* Question Header */}
                  <div className="p-6 border-b border-zinc-800 bg-zinc-950/30">
                     <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-white">{activeRun.question.title}</h2>
                        <span className="text-xs text-zinc-500 font-mono">ID: {activeRun.question.id}</span>
                     </div>
                     <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                        <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Patient Scenario</div>
                        <p className="text-zinc-300 italic">"{activeRun.question.scenario}"</p>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-6">
                    {/* Left: Model Response */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                            <Brain className="w-4 h-4" />
                            Model Response
                        </div>
                        <div className="bg-zinc-800/30 p-4 rounded-lg border border-zinc-700 text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                            {activeRun.response}
                        </div>
                        
                        <div className="mt-6">
                             <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Rubric Constraints</div>
                             <ul className="space-y-1">
                                 {activeRun.question.rubric.mustInclude.map((m:string, i:number) => (
                                     <li key={i} className="text-xs text-emerald-400/80 flex gap-2">
                                         <span>✓</span> {m}
                                     </li>
                                 ))}
                                 {activeRun.question.rubric.mustAvoid.map((m:string, i:number) => (
                                     <li key={i} className="text-xs text-red-400/80 flex gap-2">
                                         <span>✕</span> {m}
                                     </li>
                                 ))}
                             </ul>
                        </div>
                    </div>

                    {/* Right: Evaluation */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-sm text-amber-400 font-medium">
                            <Shield className="w-4 h-4" />
                            AI Judge Assessment
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                           <MetricCard label="Safety" score={activeRun.aiAssessment.metrics.safety} icon={AlertTriangle} />
                           <MetricCard label="Empathy" score={activeRun.aiAssessment.metrics.empathy} icon={Activity} />
                        </div>

                        <div className="bg-amber-900/10 border border-amber-900/30 p-4 rounded-lg">
                            <div className="text-amber-200/80 text-sm">{activeRun.aiAssessment.reasoning}</div>
                        </div>

                        {/* Human Review Form */}
                        <div className="border-t border-zinc-800 pt-6 mt-6">
                            <div className="flex items-center gap-2 text-sm text-zinc-300 font-medium mb-4">
                                <MessageSquare className="w-4 h-4" />
                                Expert Review Override
                            </div>
                            
                            <form onSubmit={handleSaveReview} className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-500 block mb-1">Manual Score (0-100)</label>
                                    <input 
                                        type="number" 
                                        name="manualScore"
                                        defaultValue={activeRun.effectiveScore}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 block mb-1">Expert Notes</label>
                                    <textarea 
                                        name="notes"
                                        rows={3}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                        defaultValue={activeRun.override?.expertNotes || ''}
                                        placeholder="Why did you change the score?"
                                    />
                                </div>
                                <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2">
                                    <Save className="w-4 h-4" /> Save Review
                                </button>
                            </form>
                        </div>
                    </div>
                  </div>
               </div>
             ) : (
                 <div className="flex items-center justify-center h-full text-zinc-600">
                     Select a run to review
                 </div>
             )}
          </div>

        </div>
        </>
        )}
      </div>
    </div>
  );
}
