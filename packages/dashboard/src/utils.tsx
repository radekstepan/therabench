import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ModelConfig, AugmentedResult } from './types';
import { encode } from 'gpt-tokenizer';

// Import model config
import modelConfigData from '../../eval-engine/data/model-config.json';
const modelConfigs: ModelConfig[] = modelConfigData;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getScoreColor(score: number) {
  // Thresholds: >=75 green, 61-74 neutral, 41-60 orange, <=40 red
  if (score >= 75) return "text-emerald-500";
  if (score <= 40) return "text-red-500";
  if (score <= 60) return "text-amber-500";
  return "text-zinc-400";
}

export function formatPercentWithColor(score: number): React.ReactNode {
  return (
    <span className={cn(getScoreColor(score))}>{score}%</span>
  );
}

export function isEnhancedModel(modelName: string): boolean {
  return modelName.includes('(Enhanced)');
}

export function stripEnhancedSuffix(modelName: string): string {
  return modelName.replace(' (Enhanced)', '');
}

export function getModelLabels(modelName: string) {
  // Strip the enhanced suffix to find the base config
  const baseName = stripEnhancedSuffix(modelName);
  
  const config = modelConfigs.find(c => c.modelName === baseName);
  const labels = [...(config?.labels || [])];
  
  return labels;
}

export function isDefaultJudge(modelName: string): boolean {
  const config = modelConfigs.find(c => c.modelName === modelName);
  // Default to true if not explicitly set to false
  return config?.isDefaultJudge !== false;
}

// Helper function to extract sortable value from model labels
export function getModelLabelSortValue(modelName: string): { isOnline: boolean; gb: number; name: string } {
  const labels = getModelLabels(modelName);
  
  // Check if model is online
  const isOnline = labels.some(label => label.text.toLowerCase() === 'online');
  
  if (isOnline) {
    return { isOnline: true, gb: 0, name: modelName };
  }
  
  // Parse GB value from labels
  let gb = Infinity; // Default to end if no GB found
  for (const label of labels) {
    const match = label.text.match(/([\d.]+)\s*GB/i);
    if (match) {
      gb = parseFloat(match[1]);
      break;
    }
  }
  
  return { isOnline: false, gb, name: modelName };
}

// Helper function to get pricing information for a model
export function getModelPricing(modelName: string): { input: number; output: number } | null {
  // Strip the enhanced suffix to find the base config
  const baseName = stripEnhancedSuffix(modelName);
  
  const config = modelConfigs.find(c => c.modelName === baseName);
  return config?.pricing || null;
}

// Helper function to format pricing information for display
export function formatModelPricing(modelName: string): string {
  const pricing = getModelPricing(modelName);
  if (!pricing) return '-';
  
  // Format with 2 decimal places for better consistency
  const inputPrice = pricing.input.toFixed(2);
  const outputPrice = pricing.output.toFixed(2);
  
  // Remove trailing zeros for cleaner display
  const formatPrice = (price: string) => {
    const formatted = price.replace(/\.00$/, '');
    return formatted.includes('.') ? formatted : formatted;
  };
  
  return `${formatPrice(inputPrice)}/${formatPrice(outputPrice)}`;
}

// Helper function to count tokens in text
export function countTokens(text: string): number {
  try {
    return encode(text).length;
  } catch (error) {
    // Fallback: rough estimation if encoding fails (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

// Helper function to calculate actual cost for a model based on its runs
export function calculateModelCost(modelName: string, runs: AugmentedResult[]): number {
  const pricing = getModelPricing(modelName);
  if (!pricing) return 0;
  
  const modelRuns = runs.filter(r => r.modelName === modelName);
  
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  modelRuns.forEach(run => {
    // Input tokens: scenario + rubric context (approximate)
    const inputText = run.question.scenario + 
                     JSON.stringify(run.question.rubric) +
                     "You are a therapist. Respond to this patient."; // Approximate prompt
    totalInputTokens += countTokens(inputText);
    
    // Output tokens: the model's response
    totalOutputTokens += countTokens(run.response);
  });
  
  // Calculate cost: (tokens / 1M) * price per 1M tokens
  const inputCost = (totalInputTokens / 1_000_000) * pricing.input;
  const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;
  
  const totalCost = inputCost + outputCost;
  
  return totalCost;
}

// Helper function to format cost for display
export function formatModelCost(cost: number): string {
  if (cost === 0) return '-';
  
  if (cost < 0.01) {
    // Show in cents for very small amounts
    return `¢${(cost * 100).toFixed(2)}`;
  } else if (cost < 1) {
    // Show cents for amounts under $1
    return `¢${Math.round(cost * 100)}`;
  } else if (cost < 10) {
    // Show 2 decimal places for amounts under $10
    return `$${cost.toFixed(2)}`;
  } else {
    // Show 1 decimal place for larger amounts
    return `$${cost.toFixed(1)}`;
  }
}

// Helper function to get color class for cost display based on relative position
// Lower cost = better (green), higher cost = worse (red)
// Uses percentiles to color costs relative to others in the same dataset
export function getRelativeCostColor(cost: number, allCosts: number[]): string {
  if (cost === 0) return 'text-zinc-600';
  
  // Filter out zero costs for percentile calculation
  const validCosts = allCosts.filter(c => c > 0);
  if (validCosts.length === 0) return 'text-zinc-600';
  
  // Sort costs to find percentiles
  const sortedCosts = [...validCosts].sort((a, b) => a - b);
  
  // Find percentile position (0-100)
  const position = sortedCosts.filter(c => c < cost).length;
  const percentile = (position / sortedCosts.length) * 100;
  
  // Apply color bands based on percentile (same as consensus correlation)
  if (percentile <= 20) return 'text-emerald-400';  // Bottom 20% (cheapest)
  if (percentile <= 40) return 'text-green-400';     // 20-40%
  if (percentile <= 60) return 'text-yellow-400';    // 40-60%
  if (percentile <= 80) return 'text-orange-400';    // 60-80%
  return 'text-red-400';                             // Top 20% (most expensive)
}

// Helper function to calculate actual cost for a judge based on their evaluations
export function calculateJudgeCost(judgeId: string, runs: AugmentedResult[]): number {
  const pricing = getModelPricing(judgeId);
  if (!pricing) return 0;
  
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  runs.forEach(run => {
    // Check if this judge evaluated this run
    const assessments = run.aiAssessments?.[judgeId];
    if (!assessments) return;
    
    // Handle both array and single assessment for backward compatibility
    const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
    
    assessmentArray.forEach(assessment => {
      // Input tokens: scenario + rubric + candidate model response
      const inputText = run.question.scenario + 
                       JSON.stringify(run.question.rubric) +
                       run.response +
                       "Evaluate this therapeutic response."; // Approximate prompt
      totalInputTokens += countTokens(inputText);
      
      // Output tokens: the judge's reasoning + structured output
      const outputText = assessment.reasoning + 
                        JSON.stringify(assessment.flags) +
                        JSON.stringify(assessment.metrics);
      totalOutputTokens += countTokens(outputText);
    });
  });
  
  // Calculate cost: (tokens / 1M) * price per 1M tokens
  const inputCost = (totalInputTokens / 1_000_000) * pricing.input;
  const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;
  
  const totalCost = inputCost + outputCost;
  
  return totalCost;
}
