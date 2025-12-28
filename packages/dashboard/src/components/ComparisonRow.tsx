import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Save, Gavel, Brain, Shield } from 'lucide-react';
import { cn, getScoreColor } from '../utils';
import { ModelLabels } from './ModelLabels';
import type { AugmentedResult, HumanOverride } from '../types';

interface ComparisonRowProps {
  run: AugmentedResult;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSaveOverride: (runId: string, override: HumanOverride) => void;
  selectedJudges: Set<string>;
}

export const ComparisonRow = ({ 
  run, 
  rank, 
  isExpanded, 
  onToggle, 
  onSaveOverride,
  selectedJudges
}: ComparisonRowProps) => {
  const [editScore, setEditScore] = useState(run.effectiveScore);
  const [editNotes, setEditNotes] = useState(run.override?.expertNotes || '');

  // Reset local state when run changes or override updates
  useEffect(() => {
    setEditScore(run.effectiveScore);
    setEditNotes(run.override?.expertNotes || '');
  }, [run.effectiveScore, run.override]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOverride(run.runId, {
      manualScore: Number(editScore),
      expertNotes: editNotes,
      rankAdjustment: 0,
      lastUpdated: Date.now()
    });
  };

  return (
    <>
      <tr 
        onClick={onToggle} 
        className={cn(
          "cursor-pointer transition-colors border-b border-zinc-800/50",
          isExpanded ? "bg-zinc-800/40" : "hover:bg-zinc-800/20"
        )}
      >
        <td className="px-3 py-2 text-center w-16 text-zinc-500 font-mono text-sm whitespace-nowrap">#{rank}</td>
        <td className="px-3 py-2 max-w-0">
          <div className="font-medium text-white group-hover:text-emerald-400 transition-colors truncate">
            {run.modelName}
          </div>
          <div className="text-xs text-zinc-500 font-mono mt-0.5 whitespace-nowrap">
            {new Date(run.timestamp).toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit'
            })}
          </div>
        </td>
        <td className="px-3 py-2 w-36 whitespace-nowrap">
          <ModelLabels modelName={run.modelName} />
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <div 
            className={cn("text-sm font-bold", getScoreColor(run.effectiveScore))}
          >
            {run.effectiveScore}%
          </div>
          {run.override && <div className="text-[10px] text-amber-500 mt-1 flex justify-end items-center gap-1"><Gavel className="w-3 h-3"/> Reviewed</div>}
        </td>
        <td className="px-3 py-2 text-center text-zinc-400 font-mono whitespace-nowrap">{run.effectiveSafety}</td>
        <td className="px-3 py-2 text-center text-zinc-400 font-mono whitespace-nowrap">{run.effectiveEmpathy}</td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          {isExpanded ? <ChevronDown className="w-5 h-5 ml-auto text-zinc-500" /> : <ChevronRight className="w-5 h-5 ml-auto text-zinc-500" />}
        </td>
      </tr>
      
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-zinc-900/30 p-0">
            <div className="border-b border-zinc-800/50 p-6 grid grid-cols-12 gap-8">
              {/* Left: Response & Analysis */}
              <div className="col-span-8 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Model Response
                  </h4>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-300 leading-relaxed text-sm whitespace-pre-wrap">
                    {run.response}
                  </div>
                </div>

                {/* Show all judge assessments */}
                {run.aiAssessments && Object.keys(run.aiAssessments).length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> AI Evaluations
                      {selectedJudges.size > 0 && selectedJudges.size < Object.keys(run.aiAssessments).length && (
                        <span className="text-xs text-amber-400">(filtered)</span>
                      )}
                    </h4>
                    <div className="space-y-4">
                      {Object.entries(run.aiAssessments)
                        .filter(([judgeModel]) => selectedJudges.size === 0 || selectedJudges.has(judgeModel))
                        .map(([judgeModel, assessment]) => (
                        <div key={judgeModel} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono text-zinc-500">{judgeModel}</span>
                            <div className="flex items-center gap-4">
                              <span className={cn("text-sm font-bold", getScoreColor(assessment.score))}>
                                Score: {assessment.score}%
                              </span>
                              <span className="text-xs text-zinc-600">Safety: {assessment.metrics.safety}</span>
                              <span className="text-xs text-zinc-600">Empathy: {assessment.metrics.empathy}</span>
                              <span className="text-xs text-zinc-600">Modality: {assessment.metrics.modalityAdherence}</span>
                            </div>
                          </div>
                          <div className="text-sm text-zinc-400 italic">
                            "{assessment.reasoning}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : run.aiAssessment ? (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> AI Evaluation Reasoning
                      {run.aiAssessment.evaluatorModel && (
                        <span className="text-xs text-zinc-600 font-mono ml-auto">by {run.aiAssessment.evaluatorModel}</span>
                      )}
                    </h4>
                    <div className="text-sm text-zinc-400 italic bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/50">
                      "{run.aiAssessment.reasoning}"
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Right: Review Form */}
              <div className="col-span-4 bg-zinc-950 border border-zinc-800 rounded-xl p-5 h-fit">
                <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-amber-500" /> Expert Review
                </h4>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1.5 block">Score (0-100)</label>
                    <input 
                      type="number" 
                      min="0" max="100"
                      value={editScore}
                      onChange={(e) => setEditScore(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1.5 block">Notes</label>
                    <textarea 
                      rows={4}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Explain why the score was adjusted..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save & Rerank
                  </button>
                  
                  {run.override && (
                    <div className="text-center text-xs text-zinc-500 pt-2">
                      Last updated: {new Date(run.override.lastUpdated).toLocaleDateString()}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
