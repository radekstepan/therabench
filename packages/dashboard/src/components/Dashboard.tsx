import { Trophy, Info, ArrowUpDown } from 'lucide-react';
import { cn, getScoreColor, formatPercentWithColor } from '../utils';
import { ModelLabels } from './ModelLabels';

interface ModelStat {
  name: string;
  avgScore: number;
  avgSafety: number;
  avgEmpathy: number;
  count: number;
  expertCount: number;
  scoreRank: number;
  judgeScores: Array<{ judge: string; score: number }>;
}

interface DashboardProps {
  modelStats: ModelStat[];
  topPerformer: ModelStat | undefined;
  totalEvaluations: number;
  reviewsCompleted: number;
  sortBy: 'name' | 'runs' | 'score' | 'safety' | 'empathy' | 'label';
  sortDirection: 'asc' | 'desc';
  onSort: (column: 'name' | 'runs' | 'score' | 'safety' | 'empathy' | 'label') => void;
}

export const Dashboard = ({
  modelStats,
  topPerformer,
  totalEvaluations,
  reviewsCompleted,
  sortBy,
  sortDirection,
  onSort
}: DashboardProps) => {
  return (
    <div className="p-8 max-w-5xl mx-auto w-full overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-light text-white mb-2">Model Leaderboard</h1>
        <p className="text-zinc-500">Aggregated performance across therapeutic scenarios.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {topPerformer && (
          <div className="bg-emerald-900/10 border border-emerald-500/20 p-6 rounded-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-4 right-4 text-emerald-500/20"><Trophy className="w-16 h-16" /></div>
            <div className="relative z-10">
              <div className="text-emerald-500 text-xs font-mono font-medium uppercase tracking-wide mb-1">Top Performer</div>
            </div>
            <div className="flex-1 flex flex-col justify-center relative z-10">
              <div className="text-xl font-mono font-bold text-white mb-1">{topPerformer.name}</div>
              <div className="text-3xl font-light text-emerald-400">{topPerformer.avgScore}% <span className="text-sm text-emerald-600/70 ml-1">avg</span></div>
            </div>
          </div>
        )}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col">
          <div className="text-zinc-500 text-sm font-medium uppercase tracking-wide mb-1 text-center">Total Evaluations</div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-4xl font-light text-white">{totalEvaluations}</div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col">
          <div className="text-zinc-500 text-sm font-medium uppercase tracking-wide mb-1 text-center">Reviews Completed</div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-4xl font-light text-amber-400">{reviewsCompleted}</div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-visible">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Rank</th>
              <th 
                className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors w-full"
                onClick={() => onSort('name')}
              >
                <div className="flex items-center gap-1">
                  Model Name
                  <ArrowUpDown className={cn(
                    "w-3 h-3 transition-transform",
                    sortBy === 'name'
                      ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                      : 'text-zinc-400'
                  )} />
                </div>
              </th>
              <th 
                className="px-2 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
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
                className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                onClick={() => onSort('score')}
              >
                <div className="flex items-center justify-end gap-1">
                  Avg Score
                  <ArrowUpDown className={cn(
                    "w-3 h-3 transition-transform",
                    sortBy === 'score'
                      ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                      : 'text-zinc-400'
                  )} />
                </div>
              </th>
              <th 
                className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
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
                  <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                    <div className="font-semibold text-white mb-1">Safety Score (0-100)</div>
                    Measures risk assessment, crisis detection, and avoidance of harmful advice. High scores indicate appropriate safety protocols and harm prevention.
                  </div>
                </div>
              </th>
              <th 
                className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
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
                  <div className="absolute top-full mt-2 hidden group-hover:block w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs font-normal normal-case text-left text-zinc-300 shadow-xl whitespace-normal" style={{zIndex: 9999}}>
                    <div className="font-semibold text-white mb-1">Empathy Score (0-100)</div>
                    Evaluates validation, active listening, and emotional attunement. High scores reflect compassionate responses that acknowledge feelings without judgment.
                  </div>
                </div>
              </th>
              <th 
                className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                onClick={() => onSort('runs')}
              >
                <div className="flex items-center justify-end gap-1">
                  Experts
                  <ArrowUpDown className={cn(
                    "w-3 h-3 transition-transform",
                    sortBy === 'runs'
                      ? (sortDirection === 'asc' ? 'rotate-180 text-emerald-400' : 'text-emerald-400')
                      : 'text-zinc-400'
                  )} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {modelStats.map((stat) => (
              <tr key={stat.name} className="group hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-2 text-zinc-500 font-mono whitespace-nowrap">#{stat.scoreRank}</td>
                <td className="px-4 py-2 max-w-0">
                  <div className="font-mono text-sm font-medium text-white group-hover:text-emerald-400 transition-colors truncate">
                    {stat.name}
                  </div>
                </td>
                <td className="px-2 py-2 align-middle whitespace-nowrap">
                  <ModelLabels modelName={stat.name} />
                </td>
                <td className="px-4 py-2 text-right font-bold whitespace-nowrap relative group/score">
                  <span className={cn(getScoreColor(stat.avgScore))}>{stat.avgScore}%</span>
                  {stat.judgeScores && stat.judgeScores.length > 0 && (
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/score:block w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs font-normal shadow-xl" style={{zIndex: 9999}}>
                      <div className="font-semibold text-white mb-2">Score by Judge</div>
                      <div className="space-y-1.5">
                        {stat.judgeScores.map((js, idx) => (
                          <div key={idx} className="flex items-center justify-between text-zinc-300">
                            <span className="font-mono text-[10px] truncate flex-1">{js.judge}</span>
                            <span className="ml-2 font-bold">{formatPercentWithColor(js.score)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-center text-zinc-400 whitespace-nowrap">{stat.avgSafety}</td>
                <td className="px-4 py-2 text-center text-zinc-400 whitespace-nowrap">{stat.avgEmpathy}</td>
                <td className="px-4 py-2 text-right text-zinc-400 whitespace-nowrap">{stat.expertCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
