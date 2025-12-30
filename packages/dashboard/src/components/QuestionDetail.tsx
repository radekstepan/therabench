import { useState } from 'react';
import { Edit2, History, ArrowUpDown, Hash, Tag, Target, Shield, Heart, Activity } from 'lucide-react';
import { cn, stripEnhancedSuffix } from '../utils';
import { RubricEditor } from './RubricEditor';
import { ComparisonRow } from './ComparisonRow';
import type { QuestionNode, AugmentedResult, Rubric, HumanOverride } from '../types';

interface QuestionDetailProps {
  question: QuestionNode;
  runs: Array<AugmentedResult & { scoreRank: number }>;
  expandedRunId: string | null;
  editingRubric: boolean;
  sortBy: 'rank' | 'model' | 'score' | 'safety' | 'empathy' | 'modalityAdherence' | 'label';
  sortDirection: 'asc' | 'desc';
  selectedJudges: Set<string>;
  onEditQuestion: () => void;
  onToggleRubricEdit: () => void;
  onSaveRubric: (rubric: Rubric) => void;
  onToggleRun: (runId: string) => void;
  onSaveOverride: (runId: string, override: HumanOverride) => void;
  onSort: (column: 'rank' | 'model' | 'score' | 'safety' | 'empathy' | 'modalityAdherence' | 'label') => void;
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
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  const getBaseModelName = (modelName: string): string => {
    return stripEnhancedSuffix(modelName);
  };

  const isRowHighlighted = (modelName: string): boolean => {
    if (!hoveredModel) return false;
    const hoveredBase = getBaseModelName(hoveredModel);
    const currentBase = getBaseModelName(modelName);
    return hoveredBase === currentBase;
  };

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
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase w-16 text-center whitespace-nowrap cursor-pointer"
                      title="Rank"
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        <Hash className="w-4 h-4" />
                        <div className="absolute left-full ml-2 top-0 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Rank</div>
                          Position of this model based on overall score for this specific question. Lower numbers indicate better performance.
                        </div>
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors w-full"
                      onClick={() => onSort('model')}
                      title="Candidate Model"
                    >
                      <div className="flex items-center gap-1 group relative">
                        Candidate Model
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'model'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Candidate Model</div>
                          The name of the AI model being evaluated. Click to sort alphabetically.
                        </div>
                      </div>
                    </th>
                    <th 
                      className="px-2 py-2 text-xs font-semibold text-zinc-500 uppercase cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('label')}
                      title="Type"
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        <Tag className="w-4 h-4" />
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'label'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Model Type</div>
                          Shows the model size in GB for local models, or service type for online API models.
                        </div>
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('score')}
                      title="Score"
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        <Target className="w-4 h-4" />
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'score'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Overall Score (0-100%)</div>
                          Composite score based on rubric adherence, therapeutic quality, and expert judgment. Higher is better.
                        </div>
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('safety')}
                      title="Safety"
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        <Shield className="w-4 h-4" />
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'safety'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Safety Score (0-100)</div>
                          Measures risk assessment, crisis detection, and avoidance of harmful advice. High scores indicate appropriate safety protocols and harm prevention.
                        </div>
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('empathy')}
                      title="Empathy"
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        <Heart className="w-4 h-4" />
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'empathy'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                        <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Empathy Score (0-100)</div>
                          Evaluates validation, active listening, and emotional attunement. High scores reflect compassionate responses that acknowledge feelings without judgment.
                        </div>
                      </div>
                    </th>
                    <th 
                      className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                      onClick={() => onSort('modalityAdherence')}
                      title="Modality Adherence"
                    >
                      <div className="flex items-center justify-center gap-1 group relative">
                        <Activity className="w-4 h-4" />
                        <ArrowUpDown className={cn(
                          "w-3 h-3 transition-transform",
                          sortBy === 'modalityAdherence'
                            ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                            : 'text-zinc-400'
                        )} />
                        <div className="absolute top-full right-0 mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-1">Modality Adherence (0-100)</div>
                          Measures how well the response follows the specific therapy modality's principles and techniques (e.g., CBT, DBT, ACT).
                        </div>
                      </div>
                    </th>
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
                      hoveredModel={hoveredModel}
                      onHoverChange={setHoveredModel}
                      isHighlighted={isRowHighlighted(run.modelName)}
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
