import { TrendingUp, Gavel, Target, AlertCircle, Hash, Scale, FileText, DollarSign } from 'lucide-react';
import { cn, getScoreColor, formatModelCost, getRelativeCostColor } from '../utils';
import { JudgeStats } from '../lib/stats';

interface JudgeTrustTableProps {
  judgeStats: JudgeStats[];
}

export const JudgeTrustTable = ({ judgeStats }: JudgeTrustTableProps) => {
  if (judgeStats.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-6">
        <div className="text-center text-zinc-500">
          No judge statistics available
        </div>
      </div>
    );
  }

  const formatCorrelation = (value: number | null): string => {
    if (value === null) return '-';
    return value.toFixed(3);
  };

  const getCorrelationColor = (value: number | null): string => {
    if (value === null) return 'text-zinc-600';
    if (value >= 0.8) return 'text-emerald-400';
    if (value >= 0.6) return 'text-green-400';
    if (value >= 0.4) return 'text-yellow-400';
    if (value >= 0.2) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-visible">
      <table className="w-full text-left">
        <thead className="bg-zinc-900/50 border-b border-zinc-800">
          <tr>
            <th className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer" title="Rank">
              <div className="flex items-center gap-1 group relative">
                <Hash className="w-4 h-4" />
                <div className="absolute left-full ml-2 top-0 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Rank</div>
                  Overall ranking based on Trust Score. Lower numbers indicate more reliable judges.
                </div>
              </div>
            </th>
            <th className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-full">
              <div className="flex items-center gap-1 group relative">
                Judge
                <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Judge / Evaluator</div>
                  The AI model or expert that provided assessments of candidate model responses.
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
              <div className="flex items-center justify-center gap-1 group relative">
                <Scale className="w-4 h-4" />
                Trust
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Trust Score (0-100)</div>
                  Composite measure of judge reliability. Combines human alignment (60%), consensus alignment (20%), and discriminatory power (20%). Higher scores indicate more trustworthy judges.
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
              <div className="flex items-center justify-center gap-1 group relative">
                <FileText className="w-4 h-4" />
                Evals
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Evaluation Count</div>
                  Total number of assessments provided by this judge.
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
              <div className="flex items-center justify-center gap-1 group relative">
                <DollarSign className="w-4 h-4" />
                Cost
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Total Cost</div>
                  Actual cost based on input/output tokens used across all evaluations performed by this judge.
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
              <div className="flex items-center justify-center gap-1 group relative">
                <Target className="w-5 h-5" />
                Avg Score
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Average Score (%)</div>
                  Mean score given by this judge across all evaluations. Useful for detecting lenient or strict grading patterns.
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
              <div className="flex items-center justify-center gap-1 group relative">
                <TrendingUp className="w-4 h-4" />
                Variance
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Score Variance</div>
                  Measures spread of scores. Higher variance indicates better discrimination between good and poor responses.
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
              <div className="flex items-center justify-center gap-1 group relative">
                <Gavel className="w-4 h-4" />
                Consensus
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-72 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Consensus Correlation</div>
                  Correlation with average scores from other judges. Values close to 1.0 indicate strong alignment with peer consensus.
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
              <div className="flex items-center justify-center gap-1 group relative">
                <AlertCircle className="w-4 h-4" />
                Human
                <div className="absolute right-full mr-2 top-0 hidden group-hover:block w-72 bg-zinc-800 border border-zinc-700 rounded p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                  <div className="font-semibold text-white mb-1">Human Correlation & RMSE</div>
                  Correlation with expert overrides and Root Mean Square Error. Higher correlation and lower RMSE indicate better alignment with human judgment.
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {judgeStats.map((judge, idx) => (
            <tr
              key={judge.judgeId}
              className="hover:bg-zinc-800/50 transition-colors"
            >
              <td className="px-4 py-2 text-zinc-500 font-mono whitespace-nowrap">#{idx + 1}</td>
              <td className="px-4 py-2 max-w-0" title={judge.judgeId}>
                <div className="font-mono text-sm font-medium text-white truncate">
                  {judge.judgeId}
                </div>
              </td>
              <td className="px-3 py-2 text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className={cn("text-lg font-bold", getScoreColor(judge.trustScore))}>
                    {Math.round(judge.trustScore)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-center text-zinc-400">
                {judge.evaluationCount}
              </td>
              <td className="px-3 py-2 text-center whitespace-nowrap">
                {(() => {
                  const formattedCost = formatModelCost(judge.totalCost);
                  if (formattedCost === '-') return (
                    <span className="text-xs text-zinc-500">—</span>
                  );
                  
                  const allJudgeCosts = judgeStats.map(j => j.totalCost);
                  return (
                    <span className={cn("text-sm font-medium font-mono", getRelativeCostColor(judge.totalCost, allJudgeCosts))}>
                      {formattedCost}
                    </span>
                  );
                })()}
              </td>
              <td className="px-3 py-2 text-center text-zinc-400">
                {judge.avgScore.toFixed(1)}%
              </td>
              <td className="px-3 py-2 text-center text-zinc-400">
                {judge.variance.toFixed(1)}
              </td>
              <td className="px-3 py-2 text-center">
                <span className={getCorrelationColor(judge.consensusCorrelation)}>
                  {formatCorrelation(judge.consensusCorrelation)}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                {judge.humanCorrelation !== null ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={getCorrelationColor(judge.humanCorrelation)}>
                      r={formatCorrelation(judge.humanCorrelation)}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      RMSE={judge.humanErrorRMSE?.toFixed(2) ?? '-'}
                    </span>
                  </div>
                ) : (
                  <span className="text-zinc-600">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
