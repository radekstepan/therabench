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

export function getModelLabels(modelName: string) {
  const config = modelConfigs.find(c => c.modelName === modelName);
  return config?.labels || [];
}
