import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn, getScoreColor, isEnhancedModel, stripEnhancedSuffix } from '../utils';

interface ModelStat {
  name: string;
  avgScore: number;
  judgeScores: Array<{ judge: string; score: number }>;
}

interface ExpertRankingGridProps {
  modelStats: ModelStat[];
}

export const ExpertRankingGrid = ({ modelStats }: ExpertRankingGridProps) => {
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

  // Extract all unique judges
  const allJudges = useMemo(() => {
    const judges = new Set<string>();
    modelStats.forEach(model => {
      model.judgeScores.forEach(js => judges.add(js.judge));
    });
    return Array.from(judges).sort();
  }, [modelStats]);

  // For each judge, get scores for all models
  const judgeScores = useMemo(() => {
    const scores: Record<string, Array<{ model: string; score: number }>> = {};
    
    allJudges.forEach(judge => {
      // Get scores for all models from this judge
      const modelScores = modelStats
        .map(model => {
          const judgeScore = model.judgeScores.find(js => js.judge === judge);
          return {
            model: model.name,
            score: judgeScore?.score ?? 0
          };
        })
        .filter(ms => ms.score > 0); // Only include models that have been judged
      
      scores[judge] = modelScores;
    });
    
    return scores;
  }, [allJudges, modelStats]);

  // Get all models to display, sorted by average score
  const topModels = useMemo(() => {
    return [...modelStats]
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [modelStats]);

  // Get score for a specific model from a specific judge
  const getScoreForModel = (judge: string, modelName: string): number | null => {
    const score = judgeScores[judge]?.find(s => s.model === modelName);
    return score?.score ?? null;
  };

  if (allJudges.length === 0 || topModels.length === 0) {
    return null;
  }

  // Shorten judge names for display
  const shortenJudgeName = (judge: string): string => {
    // Remove common prefixes
    let short = judge.replace('anthropic/', '').replace('google/', '').replace('openai/', '');
    // Truncate if too long
    if (short.length > 25) {
      short = short.substring(0, 22) + '...';
    }
    return short;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-6 mt-10">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-zinc-900/50 border-b border-zinc-800">
            <tr>
              <th className="px-2 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-900 z-10">
                Candidate Model
              </th>
              {allJudges.map(judge => (
                <th 
                  key={judge}
                  className="px-2 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider"
                  title={judge}
                >
                  <div className="flex items-center justify-center overflow-hidden mx-auto" style={{ height: '120px', width: '40px' }}>
                    <span className="block truncate text-center" style={{ 
                      writingMode: 'vertical-rl', 
                      transform: 'rotate(180deg)',
                      maxHeight: '120px'
                    }}>
                      {shortenJudgeName(judge)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {topModels.map((model, idx) => (
              <tr 
                key={model.name}
                className={cn(
                  "group transition-colors",
                  isRowHighlighted(model.name)
                    ? "bg-emerald-900/20"
                    : "hover:bg-zinc-800/50"
                )}
                onMouseEnter={() => setHoveredModel(model.name)}
                onMouseLeave={() => setHoveredModel(null)}
              >
                <td 
                  className={cn(
                    "px-2 py-1 font-mono text-sm text-white sticky left-0 z-10 border-r border-zinc-800 transition-colors",
                    isRowHighlighted(model.name) ? "bg-emerald-900/20" : "bg-zinc-900 group-hover:bg-zinc-800/50"
                  )}
                  title={model.name}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs">#{idx + 1}</span>
                    {isEnhancedModel(model.name) && <Sparkles className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />}
                    <span className="group-hover:text-emerald-400 transition-colors truncate">{stripEnhancedSuffix(model.name)}</span>
                  </div>
                </td>
                {allJudges.map(judge => {
                  const score = getScoreForModel(judge, model.name);
                  return (
                    <td 
                      key={judge}
                      className="px-2 py-1 text-center"
                    >
                      {score !== null ? (
                        <div className={cn(
                          "inline-flex items-center justify-center w-10 h-8 rounded text-xs font-semibold",
                          getScoreColor(score)
                        )}>
                          {score}%
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center w-10 h-8 rounded text-xs text-zinc-600">
                          -
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
