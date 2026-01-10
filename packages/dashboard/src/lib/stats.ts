import { AugmentedResult, HumanOverride } from '../types';
import { calculateJudgeCost } from '../utils';

/**
 * Basic statistical metrics for a dataset
 */
export interface DatasetStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
  variance: number;
}

/**
 * Advanced metrics for a specific Judge/Evaluator
 */
export interface JudgeStats {
  judgeId: string;
  evaluationCount: number;
  avgScore: number;
  
  // Measures spread of scores (higher = better discrimination, usually)
  variance: number;
  
  // Correlation with the "wisdom of the crowd" (excluding self)
  consensusCorrelation: number;
  
  // Error relative to human overrides (lower is better)
  humanErrorRMSE: number | null;
  humanCorrelation: number | null;
  
  // Composite score 0-100 indicating how much we should trust this judge
  trustScore: number;
  
  // Total cost in USD for all evaluations performed by this judge
  totalCost: number;
}

/**
 * Advanced metrics for a Model
 */
export interface ModelReliability {
  modelName: string;
  meanScore: number;
  stdDev: number;
  
  // mean - (1.0 * stdDev) -> Penalizes inconsistent models
  reliabilityIndex: number;
  
  // 5th percentile score (approximate)
  floorScore: number;
}

// --- Basic Math Helpers ---

export function calculateMean(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

export function calculateVariance(numbers: number[]): number {
  if (numbers.length < 2) return 0;
  const mean = calculateMean(numbers);
  const sumSquaredDiff = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0);
  return sumSquaredDiff / (numbers.length - 1); // Sample variance
}

export function calculateStdDev(numbers: number[]): number {
  return Math.sqrt(calculateVariance(numbers));
}

export function calculateRMSE(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  const sumSquaredError = actual.reduce((sum, act, i) => sum + Math.pow(act - predicted[i], 2), 0);
  return Math.sqrt(sumSquaredError / actual.length);
}

export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  
  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const denominatorX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
  const denominatorY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));
  
  if (denominatorX === 0 || denominatorY === 0) return 0;
  
  return numerator / (denominatorX * denominatorY);
}

// --- Domain Specific Logic ---

/**
 * Calculates reliability metrics for a model based on its run scores.
 * Uses a "Safety First" approach where consistency is rewarded.
 */
export function calculateModelReliability(modelName: string, scores: number[]): ModelReliability {
  const mean = calculateMean(scores);
  const stdDev = calculateStdDev(scores);
  
  // Reliability Index: We penalize standard deviation. 
  // A model with Mean 85, SD 5 (Index 80) is better than Mean 88, SD 20 (Index 68).
  const reliabilityIndex = parseFloat((mean - (1.0 * stdDev)).toFixed(2));
  
  // Approx 5th percentile assuming normal distribution (Mean - 1.645 * SD)
  const floorScore = parseFloat(Math.max(0, mean - (1.645 * stdDev)).toFixed(2));

  return {
    modelName,
    meanScore: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    reliabilityIndex,
    floorScore
  };
}

/**
 * Analyzes all judges to determine who is the most trustworthy.
 * Factors in:
 * 1. Alignment with Human Overrides (Gold Standard)
 * 2. Alignment with Consensus (Silver Standard)
 * 3. Discriminatory Power (Variance)
 * 
 * @param results - The augmented results containing all assessments
 * @param overrides - Human overrides map
 * @param selectedJudges - Optional set of judge IDs to include in the analysis. If empty/undefined, all are used.
 */
export function analyzeJudges(
  results: AugmentedResult[], 
  overrides: Record<string, HumanOverride>,
  selectedJudges?: Set<string>
): JudgeStats[] {
  // 1. Organize data by judge
  const judgeData: Record<string, {
    rawScores: number[];
    consensusPairs: { judge: number; othersMean: number }[];
    humanPairs: { judge: number; human: number }[];
  }> = {};

  const shouldIncludeJudge = (judgeId: string): boolean => {
    if (!selectedJudges || selectedJudges.size === 0) return true;
    return selectedJudges.has(judgeId);
  };

  // Initialize helpers
  const getJudgeScore = (run: AugmentedResult, judge: string): number | null => {
    const assessments = run.aiAssessments?.[judge];
    if (!assessments) return null;
    
    const arr = Array.isArray(assessments) ? assessments : [assessments];
    if (arr.length === 0) return null;
    
    return arr[arr.length - 1].score; // Use latest
  };

  const getRunConsensusExcluding = (run: AugmentedResult, excludeJudge: string): number | null => {
    if (!run.aiAssessments) return null;
    
    const otherScores: number[] = [];
    Object.keys(run.aiAssessments).forEach(j => {
      // Only include this peer score if they are in the selected judges list
      if (!shouldIncludeJudge(j)) return;

      if (j !== excludeJudge) {
        const score = getJudgeScore(run, j);
        if (score !== null) otherScores.push(score);
      }
    });
    
    if (otherScores.length === 0) return null;
    return calculateMean(otherScores);
  };

  // 2. Iterate runs to populate data
  results.forEach(run => {
    if (!run.aiAssessments) return;
    
    Object.keys(run.aiAssessments).forEach(judge => {
      // Skip if this judge is filtered out
      if (!shouldIncludeJudge(judge)) return;

      if (!judgeData[judge]) {
        judgeData[judge] = { rawScores: [], consensusPairs: [], humanPairs: [] };
      }
      
      const score = getJudgeScore(run, judge);
      if (score === null) return;
      
      judgeData[judge].rawScores.push(score);
      
      // Compare with Human
      if (overrides[run.runId]) {
        judgeData[judge].humanPairs.push({
          judge: score,
          human: overrides[run.runId].manualScore
        });
      }
      
      // Compare with Consensus
      const othersMean = getRunConsensusExcluding(run, judge);
      if (othersMean !== null) {
        judgeData[judge].consensusPairs.push({
          judge: score,
          othersMean
        });
      }
    });
  });

  // 3. Compute Stats for each Judge
  return Object.entries(judgeData).map(([judgeId, data]) => {
    const evaluationCount = data.rawScores.length;
    const avgScore = calculateMean(data.rawScores);
    const variance = calculateVariance(data.rawScores);
    
    // Consensus Correlation
    const consensusX = data.consensusPairs.map(p => p.judge);
    const consensusY = data.consensusPairs.map(p => p.othersMean);
    const consensusCorrelation = calculateCorrelation(consensusX, consensusY);
    
    // Human Stats
    let humanRMSE: number | null = null;
    let humanCorrelation: number | null = null;
    
    if (data.humanPairs.length >= 3) { // Need min samples for meaningful stats
      const humanX = data.humanPairs.map(p => p.judge);
      const humanY = data.humanPairs.map(p => p.human);
      humanRMSE = calculateRMSE(humanY, humanX);
      humanCorrelation = calculateCorrelation(humanX, humanY);
    }
    
    // --- Trust Score Calculation ---
    // We normalize metrics to a 0-100 scale
    
    // 1. Consensus Component (Map -0.2...1.0 correlation to 0...100)
    // We treat negative correlation as 0 trust.
    const consensusScore = Math.max(0, consensusCorrelation) * 100;
    
    // 2. Human Component (Map RMSE 0...30 to 100...0)
    // RMSE of 0 = 100 score. RMSE of 30+ = 0 score.
    let humanScore = 0;
    const HAS_HUMAN_DATA = humanRMSE !== null;
    if (HAS_HUMAN_DATA) {
      humanScore = Math.max(0, 100 - (humanRMSE! * 3.33)); 
    }
    
    // 3. Variance Component (Sigmoid-ish: Standard Dev of 15+ is ideal)
    // A judge that gives everyone 85 (SD=0) is useless.
    // SD=15 -> Variance=225.
    const stdDev = Math.sqrt(variance);
    const varianceScore = Math.min(100, (stdDev / 15) * 100);

    // Weighted Average
    let trustScore = 0;
    
    if (HAS_HUMAN_DATA) {
      // If we have human checks, they are the most important
      // 60% Human Match, 20% Consensus, 20% Variance (Discrimination)
      trustScore = (humanScore * 0.6) + (consensusScore * 0.2) + (varianceScore * 0.2);
    } else {
      // Rely on Consensus and Discrimination
      // 70% Consensus, 30% Variance
      trustScore = (consensusScore * 0.7) + (varianceScore * 0.3);
    }
    
    // Fallback for empty data
    if (isNaN(trustScore)) trustScore = 0;

    // Calculate total cost for this judge
    const totalCost = calculateJudgeCost(judgeId, results);

    return {
      judgeId,
      evaluationCount,
      avgScore,
      variance,
      consensusCorrelation,
      humanErrorRMSE: humanRMSE,
      humanCorrelation,
      trustScore,
      totalCost
    };
  }).sort((a, b) => b.trustScore - a.trustScore);
}
