import { Edit2, History, Info, ArrowUpDown } from 'lucide-react';
import { cn } from '../utils';
import { RubricEditor } from './RubricEditor';
import { ComparisonRow } from './ComparisonRow';
import type { QuestionNode, AugmentedResult, Rubric, HumanOverride } from '../types';

interface QuestionDetailProps {
  question: QuestionNode;
  runs: Array<AugmentedResult & { scoreRank: number }>;
  expandedRunId: string | null;
  editingRubric: boolean;
  sortBy: 'rank' | 'model' | 'score' | 'safety' | 'empathy' | 'label';
  sortDirection: 'asc' | 'desc';
  selectedJudges: Set<string>;
  onEditQuestion: () => void;
  onToggleRubricEdit: () => void;
  onSaveRubric: (rubric: Rubric) => void;
  onToggleRun: (runId: string) => void;
  onSaveOverride: (runId: string, override: HumanOverride) => void;
  onSort: (column: 'rank' | 'model' | 'score' | 'safety' | 'empathy' | 'label') => void;
}

export const QuestionDetail = ({
  question,
  runs,
  expandedRunId,
  editingRubric,
  sortBy,
  sortDirection,
  selectedJudges,
  onEditQuestion,
  onToggleRubricEdit,
  onSaveRubric,
  onToggleRun,
  onSaveOverride,
  onSort
}: QuestionDetailProps) => {
  return (
    <div className="flex flex-col h-full">
      {/* Question Header */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-zinc-600 font-mono text-xs">{question.id}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium border",
                  question.category === 'Safety' ? "bg-red-900/20 text-red-400 border-red-900/30" : "bg-sky-900/20 text-sky-400 border-sky-900/30"
                )}>
                  {question.category}
                </span>
                <span className="text-zinc-500 text-xs">Difficulty: {question.difficulty}</span>
              </div>
              <h2 className="text-2xl font-light text-white">{question.title}</h2>
            </div>
            <button
              onClick={onEditQuestion}
              className="p-2 text-zinc-600 hover:text-emerald-400 hover:bg-zinc-900 rounded transition-colors"
              title="Edit question"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-md text-zinc-300 italic mb-6">
            "{question.scenario}"
          </div>

          <RubricEditor 
            rubric={question.rubric}
            isEditing={editingRubric}
            onToggleEdit={onToggleRubricEdit}
            onSave={onSaveRubric}
          />
        </div>
      </div>

      {/* Comparison Table Area */}
      <div className="flex-1 overflow-y-auto bg-zinc-950 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-500" /> Model Responses
            </h3>
            <span className="text-xs text-zinc-500">{runs.length} runs found</span>
          </div>

          {runs.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-md">
              <p className="text-zinc-500">No models have been run on this question yet.</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-visible shadow-lg">
              <table className="w-full">
                <thead className="bg-zinc-900/50 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase w-16 text-center whitespace-nowrap">Rank</th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors w-full"
                      onClick={() => onSort('model')}
                    >
                      <div className="flex items-center gap-1">
                        Model
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'model'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                      </div>
                    </th>
                    <th 
                      className="px-2 py-2 text-xs font-semibold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('label')}
                    >
                      <div className="flex items-center gap-1">
                        Size
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'label'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase text-right cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('score')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Score
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'score'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('safety')}
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        Safety
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'safety'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                        <Info className="w-3 h-3 cursor-help ml-1" />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Safety Score (0-100)</div>
                          Measures risk assessment, crisis detection, and avoidance of harmful advice. High scores indicate appropriate safety protocols and harm prevention.
                        </div>
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('empathy')}
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        Empathy
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'empathy'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                        <Info className="w-3 h-3 cursor-help ml-1" />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Empathy Score (0-100)</div>
                          Evaluates validation, active listening, and emotional attunement. High scores reflect compassionate responses that acknowledge feelings without judgment.
                        </div>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase text-right w-16 whitespace-nowrap">Run</th>
                  </tr>
                </thead>
                <tbody className="bg-zinc-900">
                  {runs.map((run) => (
                    <ComparisonRow 
                      key={run.runId} 
                      run={run} 
                      rank={run.scoreRank}
                      isExpanded={expandedRunId === run.runId}
                      onToggle={() => onToggleRun(run.runId)}
                      onSaveOverride={onSaveOverride}
                      selectedJudges={selectedJudges}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
