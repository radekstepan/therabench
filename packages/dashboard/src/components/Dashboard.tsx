import { useState } from 'react';
import { Trophy, Info, ArrowUpDown, Sparkles, Target, Shield, Heart, Activity, Hash, Tag, Medal, Scale, BarChart3, Grid3x3, Gavel, DollarSign } from 'lucide-react';
import { cn, getScoreColor, formatPercentWithColor, isEnhancedModel, stripEnhancedSuffix, formatModelCost, getRelativeCostColor } from '../utils';
import { ModelLabels } from './ModelLabels';
import { JudgeComparisonGrid } from './JudgeComparisonGrid';
import { JudgeTrustTable } from './JudgeTrustTable';
import { JudgeStats } from '../lib/stats';
import { ExtendedModelStat } from '../types';

interface MissingEvaluations {
  expertsNeedingReviews: Record<string, string[]>;
  modelsWithMissingQuestions: Array<{ name: string; answered: number; missing: number }>;
  mostFrequentExpertCount: number;
  totalQuestions: number;
}

interface DashboardProps {
  modelStats: ExtendedModelStat[];
  judgeStats: JudgeStats[];
  bestModel: ExtendedModelStat | undefined;
  bestJudge: JudgeStats | undefined;
  missingEvaluations: MissingEvaluations;
  sortBy: 'name' | 'runs' | 'score' | 'safety' | 'empathy' | 'modalityAdherence' | 'label' | 'reliability' | 'pricing';
  sortDirection: 'asc' | 'desc';
  onSort: (column: 'name' | 'runs' | 'score' | 'safety' | 'empathy' | 'modalityAdherence' | 'label' | 'reliability' | 'pricing') => void;
  showStatsCards: boolean;
}

export const Dashboard = ({
  modelStats,
  judgeStats,
  bestModel,
  bestJudge,
  missingEvaluations,
  sortBy,
  sortDirection,
  onSort,
  showStatsCards
}: DashboardProps) => {
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'leaderboard' | 'judgeComparisonGrid' | 'judgeTrust'>('leaderboard');

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
    <div className="p-8 max-w-5xl mx-auto w-full overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-light text-white mb-2">Model Leaderboard</h1>
        <p className="text-zinc-500">Aggregated performance across therapeutic scenarios.</p>
      </header>

      {showStatsCards && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Best Model Card */}
          {bestModel && (
            <div className="bg-emerald-900/10 border border-emerald-500/20 p-6 rounded-md relative overflow-visible flex flex-col min-h-[160px] group/reliability">
              <div className="absolute top-3 right-3 text-emerald-500/10"><Trophy className="w-20 h-20" /></div>
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-emerald-500 text-xs font-mono font-medium uppercase tracking-wide">Most Reliable Model</div>
                </div>
                <div className="text-xl font-mono font-bold text-white mb-1 flex items-center gap-2">
                  {isEnhancedModel(bestModel.name) && <Sparkles className="w-4 h-4 text-pink-500 flex-shrink-0" />}
                  {stripEnhancedSuffix(bestModel.name)}
                </div>
                <div className="flex-1" />
                <div className="flex items-end gap-2 relative">
                   <div className="text-4xl font-light text-emerald-400">{bestModel.reliabilityIndex}</div>
                   <div className="text-xs text-zinc-500 mb-2 cursor-help">Reliability Index</div>
                   <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover/reliability:block w-72 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal text-left text-zinc-300 shadow-xl whitespace-normal z-50">
                     <div className="font-semibold text-white mb-1">Reliability Index</div>
                     Measures model consistency by penalizing variance. Calculated as Mean Score - Standard Deviation. A model with Mean 85 and SD 5 (Index 80) is more reliable than Mean 88 and SD 20 (Index 68).
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* Best Judge Card */}
          {bestJudge && (
            <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-md relative overflow-visible flex flex-col min-h-[160px] group/trustscore">
              <div className="absolute top-3 right-3 text-blue-500/10"><Scale className="w-20 h-20" /></div>
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-blue-500 text-xs font-mono font-medium uppercase tracking-wide">Best Judge</div>
                </div>
                <div className="text-xl font-mono font-bold text-white mb-1 truncate" title={bestJudge.judgeId}>
                   {bestJudge.judgeId}
                </div>
                <div className="flex-1" />
                <div className="flex items-end gap-2 relative">
                   <div className="text-4xl font-light text-blue-400">{Math.round(bestJudge.trustScore)}</div>
                   <div className="text-xs text-zinc-500 mb-2 cursor-help">Trust Score</div>
                   <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover/trustscore:block w-72 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal text-left text-zinc-300 shadow-xl whitespace-normal z-50">
                     <div className="font-semibold text-white mb-1">Trust Score (0-100)</div>
                     Measures judge reliability by comparing their assessments to expert consensus. Higher scores indicate stronger agreement with domain experts. Calculated from correlation with human overrides and consistency across evaluations.
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-3 mb-8 border-b border-zinc-800 pb-0">
        <button
          onClick={() => setActiveView('leaderboard')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative",
            activeView === 'leaderboard'
              ? "text-emerald-400"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Model Leaderboard
          {activeView === 'leaderboard' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
        <button
          onClick={() => setActiveView('judgeTrust')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative",
            activeView === 'judgeTrust'
              ? "text-emerald-400"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Gavel className="w-4 h-4" />
          Judge Leaderboard
          {activeView === 'judgeTrust' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
        <button
          onClick={() => setActiveView('judgeComparisonGrid')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative",
            activeView === 'judgeComparisonGrid'
              ? "text-emerald-400"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Grid3x3 className="w-4 h-4" />
          Judge Comparison Grid
          {activeView === 'judgeComparisonGrid' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
      </div>

      {/* Model Leaderboard View */}
      {activeView === 'leaderboard' && (
        <>
          {(Object.keys(missingEvaluations.expertsNeedingReviews).length > 0 || missingEvaluations.modelsWithMissingQuestions.length > 0) && (
        <div className="bg-amber-900/10 border border-amber-500/30 rounded-md p-6 mb-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-amber-200">Missing Evaluations</h3>
            </div>
            
            {Object.keys(missingEvaluations.expertsNeedingReviews).length > 0 && (
              <div className="mb-4 last:mb-0">
                <div className="text-sm text-zinc-400 mb-3">
                  <span className="font-medium text-amber-300">{Object.keys(missingEvaluations.expertsNeedingReviews).length}</span> {Object.keys(missingEvaluations.expertsNeedingReviews).length === 1 ? 'judge needs' : 'judges need'} to complete reviews:
                </div>
                <div className="space-y-3">
                  {Object.entries(missingEvaluations.expertsNeedingReviews).map(([expert, models]) => (
                    <div key={expert} className="bg-zinc-900/40 border border-amber-500/20 rounded p-3">
                      <div className="font-mono text-xs text-amber-300 font-semibold mb-2">{expert}</div>
                      <div className="flex flex-wrap gap-2">
                        {models.map((modelInfo) => {
                          const match = modelInfo.match(/^(.*?)\s*\((\d+)\/(\d+)\)$/);
                          const modelName = match ? match[1] : modelInfo;
                          const questionCount = match ? `${match[2]}/${match[3]}` : '';
                          
                          return (
                            <div key={modelInfo} className="inline-flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 px-2.5 py-1 rounded">
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
                    <div key={model.name} className="inline-flex items-center gap-2 bg-zinc-900/60 border border-amber-500/20 px-3 py-1.5 rounded">
                      <span className="font-mono text-xs text-white truncate max-w-[200px]" title={model.name}>{model.name}</span>
                      <span className="text-xs text-amber-400 font-semibold">{model.answered}/{missingEvaluations.totalQuestions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-visible">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50 border-b border-zinc-800">
            <tr>
              <th 
                className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer"
                title="Rank"
              >
                <div className="flex items-center gap-1 group relative">
                  <Hash className="w-4 h-4" />
                  <div className="absolute left-full ml-2 top-0 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                    <div className="font-semibold text-white mb-1">Rank</div>
                    Overall ranking based on average score across all evaluated questions. Lower numbers indicate better performance.
                  </div>
                </div>
              </th>
              <th 
                className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors w-full"
                onClick={() => onSort('name')}
                title="Candidate Model"
              >
                <div className="flex items-center gap-1 group relative">
                  Candidate Model
                  <ArrowUpDown className={cn(
                    "w-3 h-3 transition-transform",
                    sortBy === 'name'
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
                className="px-2 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
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
                className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                onClick={() => onSort('pricing')}
              >
                <div className="flex items-center justify-center gap-1 group relative">
                  <DollarSign className="w-4 h-4" />
                  <ArrowUpDown className={cn(
                    "w-3 h-3 transition-transform",
                    sortBy === 'pricing'
                      ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                      : 'text-zinc-400'
                  )} />
                  <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                    <div className="font-semibold text-white mb-1">Total Cost</div>
                    Actual cost based on input/output tokens used across all evaluations. Includes scenarios and responses.
                  </div>
                </div>
              </th>
              {/* Reliability Column */}
              <th 
                className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                onClick={() => onSort('reliability')}
                title="Reliability Index"
              >
                <div className="flex items-center justify-center gap-1 group relative">
                  <Medal className="w-4 h-4" />
                  <ArrowUpDown className={cn(
                    "w-3 h-3 transition-transform",
                    sortBy === 'reliability'
                      ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                      : 'text-zinc-400'
                  )} />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                    <div className="font-semibold text-white mb-1">Reliability Index</div>
                    Measures model consistency by penalizing variance. Calculated as Mean Score - Standard Deviation. Higher values indicate more reliable and consistent performance.
                  </div>
                </div>
              </th>
              <th 
                className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
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
                    <div className="font-semibold text-white mb-1">Average Score (0-100%)</div>
                    Average composite score across all questions, based on rubric adherence, therapeutic quality, and expert judgment. Higher is better.
                  </div>
                </div>
              </th>
              <th 
                className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
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
                className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
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
                  <div className="absolute top-full right-0 mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                    <div className="font-semibold text-white mb-1">Empathy Score (0-100)</div>
                    Evaluates validation, active listening, and emotional attunement. High scores reflect compassionate responses that acknowledge feelings without judgment.
                  </div>
                </div>
              </th>
              <th 
                className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
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
          <tbody className="divide-y divide-zinc-800">
            {modelStats.map((stat) => (
              <tr 
                key={stat.name} 
                className={cn(
                  "group transition-colors",
                  isRowHighlighted(stat.name) 
                    ? "bg-emerald-900/20" 
                    : "hover:bg-zinc-800/50"
                )}
                onMouseEnter={() => setHoveredModel(stat.name)}
                onMouseLeave={() => setHoveredModel(null)}
              >
                <td className="px-4 py-2 text-zinc-500 font-mono whitespace-nowrap">#{stat.scoreRank}</td>
                <td className="px-4 py-2 max-w-0" title={stat.name}>
                  <div className="font-mono text-sm font-medium text-white group-hover:text-emerald-400 transition-colors truncate flex items-center gap-1.5">
                    {isEnhancedModel(stat.name) && <Sparkles className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />}
                    <span className="truncate">{stripEnhancedSuffix(stat.name)}</span>
                  </div>
                </td>
                <td className="px-2 py-2 align-middle whitespace-nowrap">
                  <ModelLabels modelName={stat.name} />
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  {(() => {
                    const formattedCost = formatModelCost(stat.totalCost);
                    if (formattedCost === '-') return (
                      <span className="text-xs text-zinc-500">—</span>
                    );
                    
                    const allModelCosts = modelStats.map(m => m.totalCost);
                    return (
                      <span className={cn("text-sm font-medium font-mono", getRelativeCostColor(stat.totalCost, allModelCosts))}>
                        {formattedCost}
                      </span>
                    );
                  })()}
                </td>
                {/* Reliability Column */}
                <td className="px-3 py-2 text-center whitespace-nowrap">
                   {stat.count > 0 ? (
                     <div className="flex flex-col items-center">
                       <span className={cn("font-medium", getScoreColor(stat.reliabilityIndex))}>{stat.reliabilityIndex}</span>
                       <span className="text-[10px] text-zinc-500">±{stat.stdDev}</span>
                     </div>
                   ) : <span className="text-zinc-600">-</span>}
                </td>
                <td className="px-3 py-2 text-center font-bold whitespace-nowrap relative group/score">
                  {stat.count > 0 ? (
                    <>
                      <span className={cn(getScoreColor(stat.avgScore))}>{stat.avgScore}%</span>
                      {stat.judgeScores && stat.judgeScores.length > 0 && (
                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover/score:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal text-left shadow-xl" style={{zIndex: 9999}}>
                          <div className="font-semibold text-white mb-2">Score by Judge</div>
                          <div className="space-y-1.5">
                            {stat.judgeScores.map((js: any, idx: number) => (
                              <div key={idx} className="flex items-start justify-between text-zinc-300">
                                <span className="font-mono text-[10px] truncate flex-1">{js.judge}</span>
                                <span className="ml-2 font-bold text-right">{formatPercentWithColor(js.score)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-zinc-600">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">{stat.count > 0 ? <span className="text-zinc-500">{stat.avgSafety}</span> : <span className="text-zinc-600">-</span>}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">{stat.count > 0 ? <span className="text-zinc-500">{stat.avgEmpathy}</span> : <span className="text-zinc-600">-</span>}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">{stat.count > 0 ? <span className="text-zinc-500">{stat.avgModalityAdherence}</span> : <span className="text-zinc-600">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
        </>
      )}

      {/* Judge Comparison Grid View */}
      {activeView === 'judgeComparisonGrid' && (
        <JudgeComparisonGrid modelStats={modelStats} />
      )}

      {/* Judge Leaderboard View */}
      {activeView === 'judgeTrust' && (
        <JudgeTrustTable judgeStats={judgeStats} />
      )}
    </div>
  );
};
