import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ModelConfig } from './types';

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
  return "text-zinc-500";
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
