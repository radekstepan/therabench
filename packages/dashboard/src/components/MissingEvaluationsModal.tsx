import { X, Info, Sparkles } from 'lucide-react';
import { isEnhancedModel, stripEnhancedSuffix } from '../utils';
import type { MissingEvaluations } from '../types';

interface MissingEvaluationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingEvaluations: MissingEvaluations;
}

export const MissingEvaluationsModal = ({ isOpen, onClose, missingEvaluations }: MissingEvaluationsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-md max-w-2xl w-full mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Missing Evaluations</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-8">
            {Object.keys(missingEvaluations.expertsNeedingReviews).length > 0 && (
              <div>
                <div className="text-sm text-zinc-400 mb-3">
                  <span className="font-medium text-amber-300">{Object.keys(missingEvaluations.expertsNeedingReviews).length}</span> {Object.keys(missingEvaluations.expertsNeedingReviews).length === 1 ? 'judge needs' : 'judges need'} to complete reviews:
                </div>
                <div className="space-y-3">
                  {Object.entries(missingEvaluations.expertsNeedingReviews).map(([expert, models]) => (
                    <div key={expert} className="bg-zinc-950/50 border border-amber-500/20 rounded p-3">
                      <div className="font-mono text-xs text-amber-300 font-semibold mb-2">{expert}</div>
                      <div className="flex flex-wrap gap-2">
                        {models.map((modelInfo) => {
                          const match = modelInfo.match(/^(.*?)\s*\((\d+)\/(\d+)\)$/);
                          const modelName = match ? match[1] : modelInfo;
                          const questionCount = match ? `${match[2]}/${match[3]}` : '';
                          
                          return (
                            <div key={modelInfo} className="inline-flex items-center gap-2 bg-zinc-900/60 border border-zinc-700 px-2.5 py-1 rounded">
                              {isEnhancedModel(modelName) && <Sparkles className="w-3 h-3 text-pink-500 flex-shrink-0" />}
                              <span className="font-mono text-xs text-white truncate max-w-[180px]" title={stripEnhancedSuffix(modelName)}>{stripEnhancedSuffix(modelName)}</span>
                              {questionCount && (
                                <span className="text-xs text-amber-400 font-semibold">{questionCount}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {missingEvaluations.modelsWithMissingQuestions.length > 0 && (
              <div>
                <div className="text-sm text-zinc-400 mb-2">
                  <span className="font-medium text-amber-300">{missingEvaluations.modelsWithMissingQuestions.length}</span> {missingEvaluations.modelsWithMissingQuestions.length === 1 ? 'model hasn\'t' : 'models haven\'t'} answered all {missingEvaluations.totalQuestions} questions:
                </div>
                <div className="flex flex-wrap gap-2">
                  {missingEvaluations.modelsWithMissingQuestions.map((model) => (
                    <div key={model.name} className="inline-flex items-center gap-2 bg-zinc-950/50 border border-amber-500/20 px-3 py-1.5 rounded">
                      {isEnhancedModel(model.name) && <Sparkles className="w-3 h-3 text-pink-500 flex-shrink-0" />}
                      <span className="font-mono text-xs text-white truncate max-w-[200px]" title={stripEnhancedSuffix(model.name)}>{stripEnhancedSuffix(model.name)}</span>
                      <span className="text-xs text-amber-400 font-semibold">{model.answered}/{missingEvaluations.totalQuestions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
