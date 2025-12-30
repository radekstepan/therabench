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
  // Thresholds: >=80 green, 61-79 neutral, 41-60 orange, <=40 red
  if (score >= 80) return "text-emerald-500";
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
