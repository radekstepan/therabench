import { analyzeJudges, calculateModelReliability } from '../lib/stats';
import { calculateModelCost, getModelLabelSortValue } from '../utils';
import type { 
  ModelRun, 
  QuestionNode, 
  AugmentedResult, 
  ExtendedModelStat,
  MissingEvaluations,
  JudgeStats
} from '../types';

// --- State Management ---
// We keep data and cached calculations in the worker scope
let resultsData: ModelRun[] = [];
let questionsData: QuestionNode[] = [];

// Cache for calculated results
let cachedAugmentedResults: AugmentedResult[] | null = null;
let cachedJudgeStats: JudgeStats[] | null = null;
let cachedModelStats: ExtendedModelStat[] | null = null; // Unsorted
let cachedMissingEvaluations: MissingEvaluations | null = null;

// Track previous inputs to detect changes
let prevHeavyInputs: string | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, payload, requestId } = e.data;

  if (type === 'INIT') {
    resultsData = payload.resultsData;
    questionsData = payload.questionsData;
    // Clear caches on new data
    cachedAugmentedResults = null;
    cachedJudgeStats = null;
    cachedModelStats = null;
    cachedMissingEvaluations = null;
    prevHeavyInputs = null;
  } else if (type === 'CALCULATE') {
    if (!resultsData.length || !questionsData.length) return;
    
    try {
      performCalculations(payload, requestId);
    } catch (err) {
      console.error('Worker calculation failed:', err);
      self.postMessage({ type: 'ERROR', error: String(err), requestId });
    }
  }
};

function performCalculations(payload: any, requestId: string) {
  const {
    overrides,
    selectedJudges, // Set<string>
    selectedModels, // Set<string>
    availableJudges,
    availableModels,
    searchTerm,
    categoryFilter,
    leaderboardSortBy,
    leaderboardSortDirection
  } = payload;

  // 1. Determine if we need to re-run the Heavy Math
  // The heavy math depends on: overrides, selectedJudges, selectedModels.
  // It DOES NOT depend on: searchTerm, categoryFilter, sort order.
  const currentHeavyInputs = JSON.stringify({
    overrides,
    selectedJudges: Array.from(selectedJudges).sort(),
    selectedModels: Array.from(selectedModels).sort()
  });

  const heavyInputsChanged = currentHeavyInputs !== prevHeavyInputs;

  if (heavyInputsChanged || !cachedAugmentedResults) {
    // --- HEAVY CALCULATION PHASE ---
    
    // A. Augmented Results
    cachedAugmentedResults = resultsData
      .filter((r) => {
        return selectedModels.size === 0 || selectedModels.has(r.modelName);
      })
      .map((r) => {
        const q = questionsData.find((q) => q.id === r.questionId);
        const override = overrides[r.runId];
        
        let effectiveScore: number;
        let effectiveSafety: number;
        let effectiveEmpathy: number;
        let effectiveModalityAdherence: number;
        
        if (override) {
          effectiveScore = override.manualScore;
        } else if (r.aiAssessments) {
          const judgeScores = Object.entries(r.aiAssessments)
            .filter(([judge]) => selectedJudges.size === 0 || selectedJudges.has(judge))
            .map(([_, assessments]) => {
              const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
              return assessmentArray.length > 0 ? assessmentArray[assessmentArray.length - 1].score : 0;
            })
            .filter(score => score > 0);
          
          if (judgeScores.length > 0) {
            effectiveScore = Math.round(judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length);
          } else {
            effectiveScore = r.aiAssessment?.score ?? 0;
          }
        } else {
          effectiveScore = r.aiAssessment?.score ?? 0;
        }
        
        // Calculate average metrics
        if (r.aiAssessments) {
          const selectedAssessments = Object.entries(r.aiAssessments)
            .filter(([judge]) => selectedJudges.size === 0 || selectedJudges.has(judge))
            .flatMap(([_, assessments]) => {
              const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
              return assessmentArray.length > 0 ? [assessmentArray[assessmentArray.length - 1].metrics] : [];
            })
            .filter(metrics => metrics && typeof metrics.safety === 'number' && typeof metrics.empathy === 'number');
          
          if (selectedAssessments.length > 0) {
            effectiveSafety = Math.round(
              selectedAssessments.reduce((a, b) => a + b.safety, 0) / selectedAssessments.length
            );
            effectiveEmpathy = Math.round(
              selectedAssessments.reduce((a, b) => a + b.empathy, 0) / selectedAssessments.length
            );
            effectiveModalityAdherence = Math.round(
              selectedAssessments.reduce((a, b) => a + (b.modalityAdherence || 0), 0) / selectedAssessments.length
            );
          } else {
            effectiveSafety = r.aiAssessment?.metrics?.safety || 0;
            effectiveEmpathy = r.aiAssessment?.metrics?.empathy || 0;
            effectiveModalityAdherence = r.aiAssessment?.metrics?.modalityAdherence || 0;
          }
        } else {
          effectiveSafety = r.aiAssessment?.metrics?.safety || 0;
          effectiveEmpathy = r.aiAssessment?.metrics?.empathy || 0;
          effectiveModalityAdherence = r.aiAssessment?.metrics?.modalityAdherence || 0;
        }
        
        return { 
          ...r, 
          question: q!, 
          override, 
          effectiveScore,
          effectiveSafety,
          effectiveEmpathy,
          effectiveModalityAdherence
        } as AugmentedResult;
      })
      .filter(r => r.question)
      .filter(r => {
        if (selectedJudges.size === 0) return true;
        if (r.aiAssessments) {
          return Object.keys(r.aiAssessments).some(judge => selectedJudges.has(judge));
        }
        return r.aiAssessment?.evaluatorModel && selectedJudges.has(r.aiAssessment.evaluatorModel);
      });

    // B. Judge Statistics
    // Pass selectedJudges so that consensus and filtering happen based on the active selection
    cachedJudgeStats = analyzeJudges(cachedAugmentedResults, overrides, selectedJudges);

    // C. Model Statistics (Unsorted)
    const statsMap: Record<string, { totalScore: number; safety: number; empathy: number; modalityAdherence: number; count: number; judgeScoreMap: Record<string, number[]>; uniqueJudges: Set<string>; allScores: number[] }> = {};
    
    cachedAugmentedResults.forEach(r => {
      if (!statsMap[r.modelName]) {
        statsMap[r.modelName] = { totalScore: 0, safety: 0, empathy: 0, modalityAdherence: 0, count: 0, judgeScoreMap: {}, uniqueJudges: new Set(), allScores: [] };
      }
      statsMap[r.modelName].totalScore += r.effectiveScore;
      statsMap[r.modelName].allScores.push(r.effectiveScore);
      statsMap[r.modelName].safety += r.effectiveSafety;
      statsMap[r.modelName].empathy += r.effectiveEmpathy;
      statsMap[r.modelName].modalityAdherence += r.effectiveModalityAdherence;
      statsMap[r.modelName].count += 1;
      
      if (r.aiAssessments) {
        Object.entries(r.aiAssessments).forEach(([judge, assessments]) => {
          if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
            statsMap[r.modelName].uniqueJudges.add(judge);
            if (!statsMap[r.modelName].judgeScoreMap[judge]) {
              statsMap[r.modelName].judgeScoreMap[judge] = [];
            }
            const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
            if (assessmentArray.length > 0) {
              statsMap[r.modelName].judgeScoreMap[judge].push(assessmentArray[assessmentArray.length - 1].score);
            }
          }
        });
      } else if (r.aiAssessment?.evaluatorModel) {
        const judge = r.aiAssessment.evaluatorModel;
        if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
          statsMap[r.modelName].uniqueJudges.add(judge);
          if (!statsMap[r.modelName].judgeScoreMap[judge]) {
            statsMap[r.modelName].judgeScoreMap[judge] = [];
          }
          statsMap[r.modelName].judgeScoreMap[judge].push(r.aiAssessment.score);
        }
      }
    });

    const modelsToShow: string[] = selectedModels.size === 0 || selectedModels.size === availableModels.length
      ? availableModels  
      : Array.from(selectedModels);
    
    cachedModelStats = modelsToShow.map((modelName: string) => {
      const s = statsMap[modelName];
      
      if (!s) {
        return {
          modelName,
          name: modelName,
          avgScore: 0,
          avgSafety: 0,
          avgEmpathy: 0,
          avgModalityAdherence: 0,
          count: 0,
          expertCount: 0,
          scoreRank: 0,
          judgeScores: [],
          meanScore: 0,
          stdDev: 0,
          reliabilityIndex: 0,
          floorScore: 0,
          totalCost: 0
        } as ExtendedModelStat;
      }
      
      const judgeScores = Object.entries(s.judgeScoreMap).map(([judge, scores]) => ({
        judge,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      })).sort((a, b) => b.score - a.score);

      const reliability = calculateModelReliability(modelName, s.allScores);
      const totalCost = calculateModelCost(modelName, cachedAugmentedResults!);
      
      return {
        ...reliability,
        name: modelName,
        avgScore: Math.round(s.totalScore / s.count),
        avgSafety: Math.round(s.safety / s.count),
        avgEmpathy: Math.round(s.empathy / s.count),
        avgModalityAdherence: Math.round(s.modalityAdherence / s.count),
        count: s.count,
        expertCount: s.uniqueJudges.size,
        judgeScores,
        totalCost
      } as ExtendedModelStat;
    });

    prevHeavyInputs = currentHeavyInputs;
  }

  // --- LIGHT CALCULATION PHASE (Sorting & Filtering) ---
  // This runs every time, but uses cached data if available.

  const modelStatsWithRank = [...(cachedModelStats || [])]
    .sort((a, b) => {
      let comparison = 0;
      switch (leaderboardSortBy) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'runs': comparison = a.expertCount - b.expertCount; break;
        case 'score': comparison = a.avgScore - b.avgScore; break;
        case 'reliability': comparison = a.reliabilityIndex - b.reliabilityIndex; break;
        case 'safety': comparison = a.avgSafety - b.avgSafety; break;
        case 'empathy': comparison = a.avgEmpathy - b.avgEmpathy; break;
        case 'modalityAdherence': comparison = a.avgModalityAdherence - b.avgModalityAdherence; break;
        case 'pricing': comparison = (a.totalCost || 0) - (b.totalCost || 0); break;
        case 'label':
          const labelA = getModelLabelSortValue(a.name);
          const labelB = getModelLabelSortValue(b.name);
          if (labelA.isOnline && !labelB.isOnline) comparison = -1;
          else if (!labelA.isOnline && labelB.isOnline) comparison = 1;
          else if (labelA.isOnline && labelB.isOnline) comparison = labelA.name.localeCompare(labelB.name);
          else comparison = labelB.gb - labelA.gb;
          break;
      }
      return leaderboardSortDirection === 'asc' ? comparison : -comparison;
    })
    .map((stat) => {
      // Re-calculate ranks based on current sort or score? 
      // Traditionally ranks are score-based. Let's keep rank fixed on Score.
      // But we need to assign it.
      // Let's do a separate sort for ranking if we want rank to be purely score based regardless of display sort.
      return stat;
    });

  // Re-calculate Score Ranks purely for display (Score Rank column)
  const scoreSorted = [...modelStatsWithRank].sort((a, b) => {
    const scoreDiff = b.avgScore - a.avgScore;
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  });
  const rankMap = new Map<string, number>();
  scoreSorted.forEach((s, i) => rankMap.set(s.name, i + 1));
  
  const finalModelStats = modelStatsWithRank.map(s => ({
    ...s,
    scoreRank: rankMap.get(s.name)!
  }));

  // Missing Evaluations (re-calc only if heavy changed, or just reuse)
  if (heavyInputsChanged || !cachedMissingEvaluations) {
    const totalQuestions = questionsData.length;
    const expertCounts = finalModelStats.map(stat => stat.expertCount);
    const countFrequency: Record<number, number> = {};
    expertCounts.forEach(count => {
      countFrequency[count] = (countFrequency[count] || 0) + 1;
    });
    const mostFrequentExpertCount = parseInt(Object.entries(countFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '0');
    
    const expertsNeedingReviews: Record<string, string[]> = {};
    const allExperts: string[] = selectedJudges.size > 0 ? Array.from(selectedJudges) : availableJudges;
    
    finalModelStats.forEach(stat => {
      const modelRuns = cachedAugmentedResults!.filter(r => r.modelName === stat.name);
      const expertQuestionCounts: Record<string, Set<string>> = {};
      modelRuns.forEach(run => {
        if (run.aiAssessments) {
          Object.keys(run.aiAssessments).forEach(judge => {
            if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
              if (!expertQuestionCounts[judge]) expertQuestionCounts[judge] = new Set();
              expertQuestionCounts[judge].add(run.questionId);
            }
          });
        }
      });
      allExperts.forEach(expert => {
        const questionsReviewed = expertQuestionCounts[expert]?.size || 0;
        if (questionsReviewed < totalQuestions) {
          if (!expertsNeedingReviews[expert]) expertsNeedingReviews[expert] = [];
          expertsNeedingReviews[expert].push(`${stat.name} (${questionsReviewed}/${totalQuestions})`);
        }
      });
    });

    const modelsWithMissingQuestions = finalModelStats
      .filter(stat => stat.count < totalQuestions)
      .map(stat => ({ name: stat.name, answered: stat.count, missing: totalQuestions - stat.count }));

    cachedMissingEvaluations = {
      expertsNeedingReviews,
      modelsWithMissingQuestions,
      mostFrequentExpertCount,
      totalQuestions
    };
  }

  const bestReliabilityModel = [...finalModelStats].sort((a, b) => b.reliabilityIndex - a.reliabilityIndex)[0];
  const bestJudge = cachedJudgeStats && cachedJudgeStats.length > 0 ? cachedJudgeStats[0] : undefined;

  // Filter Questions List (Fast)
  const questionList = questionsData.map(q => {
    const runs = cachedAugmentedResults!.filter(r => r.questionId === q.id);
    return { ...q, runCount: runs.length, avgScore: runs.length ? Math.round(runs.reduce((a,b)=>a+b.effectiveScore,0)/runs.length) : 0 };
  }).filter(q => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || 
                         q.title.toLowerCase().includes(searchLower) || 
                         q.scenario.toLowerCase().includes(searchLower) ||
                         q.category.toLowerCase().includes(searchLower) ||
                         q.id.toLowerCase().includes(searchLower) ||
                         q.rubric.mustInclude.some(item => item.toLowerCase().includes(searchLower)) ||
                         q.rubric.mustAvoid.some(item => item.toLowerCase().includes(searchLower));
    const matchesCategory = categoryFilter === 'all' || q.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Send results back to main thread
  self.postMessage({
    type: 'RESULTS',
    requestId, 
    payload: {
      augmentedResults: cachedAugmentedResults,
      judgeStats: cachedJudgeStats,
      modelStatsWithRank: finalModelStats,
      missingEvaluations: cachedMissingEvaluations,
      bestReliabilityModel,
      bestJudge,
      questionList
    }
  });
}
