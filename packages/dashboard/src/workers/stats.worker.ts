import { analyzeJudges, calculateModelReliability } from '../lib/stats';
import { calculateModelCost, getModelLabelSortValue, stripEnhancedSuffix } from '../utils';
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
        let effectiveFaithfulness: number;
        
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
            // Only process metrics objects that actually exist
            .filter(metrics => metrics);
          
          if (selectedAssessments.length > 0) {
             // Safe reduction helpers
             const sum = (key: keyof typeof selectedAssessments[0]) => 
                selectedAssessments.reduce((a, b) => a + (b[key] || 0), 0);
             const countValid = (key: keyof typeof selectedAssessments[0]) => 
                selectedAssessments.filter(b => b[key] !== undefined).length;

             // Safety, Empathy, Modality are standard across CBT/DBT/ACT
             effectiveSafety = Math.round(sum('safety') / (countValid('safety') || 1));
             effectiveEmpathy = Math.round(sum('empathy') / (countValid('empathy') || 1));
             effectiveModalityAdherence = Math.round(sum('modalityAdherence') / (countValid('modalityAdherence') || 1));
             
             // Faithfulness is specific to Transcript
             effectiveFaithfulness = Math.round(sum('faithfulness') / (countValid('faithfulness') || 1));
             
          } else {
            effectiveSafety = r.aiAssessment?.metrics?.safety || 0;
            effectiveEmpathy = r.aiAssessment?.metrics?.empathy || 0;
            effectiveModalityAdherence = r.aiAssessment?.metrics?.modalityAdherence || 0;
            effectiveFaithfulness = r.aiAssessment?.metrics?.faithfulness || 0;
          }
        } else {
          effectiveSafety = r.aiAssessment?.metrics?.safety || 0;
          effectiveEmpathy = r.aiAssessment?.metrics?.empathy || 0;
          effectiveModalityAdherence = r.aiAssessment?.metrics?.modalityAdherence || 0;
          effectiveFaithfulness = r.aiAssessment?.metrics?.faithfulness || 0;
        }
        
        return { 
          ...r, 
          question: q!, 
          override, 
          effectiveScore,
          effectiveSafety,
          effectiveEmpathy,
          effectiveModalityAdherence,
          effectiveFaithfulness
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
    const statsMap: Record<string, { 
      totalScore: number; scoreCount: number;
      safety: number; safetyCount: number;
      empathy: number; empathyCount: number;
      modalityAdherence: number; modalityAdherenceCount: number;
      faithfulness: number; faithfulnessCount: number;
      
      count: number; // Total runs (for completeness check)
      
      judgeScoreMap: Record<string, number[]>; 
      uniqueJudges: Set<string>; 
      allScores: number[] 
    }> = {};

    // Helper to store transcript runs for merging into enhanced models
    const baseTranscriptRuns = new Map<string, AugmentedResult[]>();
    
    // 1. First Pass: Aggregate everything normally
    cachedAugmentedResults.forEach(r => {
      if (!statsMap[r.modelName]) {
        statsMap[r.modelName] = { 
          totalScore: 0, scoreCount: 0,
          safety: 0, safetyCount: 0,
          empathy: 0, empathyCount: 0,
          modalityAdherence: 0, modalityAdherenceCount: 0,
          faithfulness: 0, faithfulnessCount: 0,
          count: 0,
          judgeScoreMap: {}, uniqueJudges: new Set(), allScores: [] 
        };
      }
      const s = statsMap[r.modelName];
      const isTranscript = r.question.category === 'Transcript';

      // Store base transcript runs for later merging
      if (isTranscript && !r.modelName.includes('(Enhanced)')) {
         if (!baseTranscriptRuns.has(r.modelName)) {
           baseTranscriptRuns.set(r.modelName, []);
         }
         baseTranscriptRuns.get(r.modelName)!.push(r);
      }

      // 1. General Completeness
      s.count += 1;
      s.allScores.push(r.effectiveScore);

      // 2. Overall Score
      s.totalScore += r.effectiveScore;
      s.scoreCount += 1;
      
      // 3. Metrics
      if (!isTranscript) {
         s.safety += r.effectiveSafety;
         s.safetyCount += 1;
         s.empathy += r.effectiveEmpathy;
         s.empathyCount += 1;
         s.modalityAdherence += r.effectiveModalityAdherence;
         s.modalityAdherenceCount += 1;
      } else {
         if (r.effectiveFaithfulness > 0) {
            s.faithfulness += r.effectiveFaithfulness;
            s.faithfulnessCount += 1;
         }
      }
      
      // 4. Judges aggregation
      if (r.aiAssessments) {
        Object.entries(r.aiAssessments).forEach(([judge, assessments]) => {
          if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
            s.uniqueJudges.add(judge);
            if (!s.judgeScoreMap[judge]) s.judgeScoreMap[judge] = [];
            const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
            if (assessmentArray.length > 0) {
              s.judgeScoreMap[judge].push(assessmentArray[assessmentArray.length - 1].score);
            }
          }
        });
      } else if (r.aiAssessment?.evaluatorModel) {
        const judge = r.aiAssessment.evaluatorModel;
        if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
          s.uniqueJudges.add(judge);
          if (!s.judgeScoreMap[judge]) s.judgeScoreMap[judge] = [];
          s.judgeScoreMap[judge].push(r.aiAssessment.score);
        }
      }
    });

    // 2. Second Pass: Merge Transcript runs into Enhanced Models
    // This ensures "Model (Enhanced)" gets the benefit of the high-scoring Transcript runs 
    // that were technically run on "Model" (Base).
    Object.keys(statsMap).forEach(modelName => {
        if (modelName.includes('(Enhanced)')) {
           const baseName = stripEnhancedSuffix(modelName);
           const transcriptRuns = baseTranscriptRuns.get(baseName);
           
           if (transcriptRuns && transcriptRuns.length > 0) {
              const s = statsMap[modelName];
              
              transcriptRuns.forEach(r => {
                 // 1. Completeness: Fix "Missing Evaluations"
                 s.count += 1; 

                 // 2. Score Aggregation: Fix "Skewed Average"
                 // We MUST include the score of the transcript runs, otherwise the average
                 // is calculated on 30 items for Enhanced vs 40 for Base, leading to invalid comparisons.
                 s.totalScore += r.effectiveScore;
                 s.scoreCount += 1;
                 s.allScores.push(r.effectiveScore);

                 // 3. Faithfulness: Copy as requested
                 if (r.effectiveFaithfulness > 0) {
                    s.faithfulness += r.effectiveFaithfulness;
                    s.faithfulnessCount += 1;
                 }
                 
                 // 4. Judge Scores: Ensure tooltip reflects these runs too
                 if (r.aiAssessments) {
                    Object.entries(r.aiAssessments).forEach(([judge, assessments]) => {
                      if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
                        s.uniqueJudges.add(judge);
                        if (!s.judgeScoreMap[judge]) s.judgeScoreMap[judge] = [];
                        const arr = Array.isArray(assessments) ? assessments : [assessments];
                        if (arr.length > 0) s.judgeScoreMap[judge].push(arr[arr.length - 1].score);
                      }
                    });
                 }
              });
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
          avgFaithfulness: 0,
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
        // Use the specific counters for averages
        avgScore: s.scoreCount > 0 ? Math.round(s.totalScore / s.scoreCount) : 0,
        avgSafety: s.safetyCount > 0 ? Math.round(s.safety / s.safetyCount) : 0,
        avgEmpathy: s.empathyCount > 0 ? Math.round(s.empathy / s.empathyCount) : 0,
        avgModalityAdherence: s.modalityAdherenceCount > 0 ? Math.round(s.modalityAdherence / s.modalityAdherenceCount) : 0,
        avgFaithfulness: s.faithfulnessCount > 0 ? Math.round(s.faithfulness / s.faithfulnessCount) : 0,
        
        count: s.count, // Use total completeness count (including transcripts)
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
        case 'score': 
          comparison = a.avgScore - b.avgScore; 
          // Tie-breaker: Reliability
          if (comparison === 0) {
            comparison = a.reliabilityIndex - b.reliabilityIndex;
          }
          break;
        case 'reliability': comparison = a.reliabilityIndex - b.reliabilityIndex; break;
        case 'safety': comparison = a.avgSafety - b.avgSafety; break;
        case 'empathy': comparison = a.avgEmpathy - b.avgEmpathy; break;
        case 'modalityAdherence': comparison = a.avgModalityAdherence - b.avgModalityAdherence; break;
        case 'faithfulness': 
          comparison = a.avgFaithfulness - b.avgFaithfulness; 
          // Tie-breaker: Average Score
          if (comparison === 0) {
            comparison = a.avgScore - b.avgScore;
          }
          break;
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
      return stat;
    });

  // Re-calculate Score Ranks purely for display (Score Rank column)
  const scoreSorted = [...modelStatsWithRank].sort((a, b) => {
    const scoreDiff = b.avgScore - a.avgScore;
    if (scoreDiff !== 0) return scoreDiff;
    const relDiff = b.reliabilityIndex - a.reliabilityIndex;
    if (relDiff !== 0) return relDiff;
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
      // Reconstruct the set of runs valid for this model
      let modelRuns = cachedAugmentedResults!.filter(r => r.modelName === stat.name);
      
      // If Enhanced, also include Transcript runs from the base model
      if (stat.name.includes('(Enhanced)')) {
          const baseName = stripEnhancedSuffix(stat.name);
          const transcriptRuns = cachedAugmentedResults!.filter(r => 
             r.modelName === baseName && r.question.category === 'Transcript'
          );
          
          // Add them if not already present (using runId for uniqueness)
          const existingIds = new Set(modelRuns.map(r => r.runId));
          transcriptRuns.forEach(tr => {
              if (!existingIds.has(tr.runId)) {
                  modelRuns.push(tr);
              }
          });
      }
      
      const runsForModel = modelRuns.length;
      if (runsForModel === 0) return; // No runs to review

      const expertRunCounts: Record<string, Set<string>> = {};
      
      modelRuns.forEach(run => {
        if (run.aiAssessments) {
          Object.keys(run.aiAssessments).forEach(judge => {
            if (selectedJudges.size === 0 || selectedJudges.has(judge)) {
              if (!expertRunCounts[judge]) expertRunCounts[judge] = new Set();
              expertRunCounts[judge].add(run.runId);
            }
          });
        }
      });

      allExperts.forEach(expert => {
        const runsReviewed = expertRunCounts[expert]?.size || 0;
        // Only show if the judge has reviewed fewer runs than exist for this model
        if (runsReviewed < runsForModel) {
          if (!expertsNeedingReviews[expert]) expertsNeedingReviews[expert] = [];
          expertsNeedingReviews[expert].push(`${stat.name} (${runsReviewed}/${runsForModel})`);
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
  const bestScoringModel = [...finalModelStats].sort((a, b) => {
    const scoreDiff = b.avgScore - a.avgScore;
    if (scoreDiff !== 0) return scoreDiff;
    return b.reliabilityIndex - a.reliabilityIndex;
  })[0];
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
                         q.rubric.criteria.toLowerCase().includes(searchLower);
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
      bestScoringModel,
      bestJudge,
      questionList
    }
  });
}
