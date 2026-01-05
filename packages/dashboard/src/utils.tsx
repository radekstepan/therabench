import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Mustache from 'mustache';
import type { ModelConfig, AugmentedResult } from './types';
import judgeTemplate from '../../eval-engine/templates/judge.mustache?raw';
import systemBaseTemplate from '../../eval-engine/templates/system_base.mustache?raw';
import systemCBTTemplate from '../../eval-engine/templates/system_cbt.mustache?raw';
import systemDBTTemplate from '../../eval-engine/templates/system_dbt.mustache?raw';
import systemACTTemplate from '../../eval-engine/templates/system_act.mustache?raw';
import systemSafetyTemplate from '../../eval-engine/templates/system_safety.mustache?raw';
import systemTranscriptTemplate from '../../eval-engine/templates/system_transcript.mustache?raw';
import systemGeneralTemplate from '../../eval-engine/templates/system_general.mustache?raw';

// Import model config
import modelConfigData from '../../eval-engine/data/model-config.json';
const modelConfigs: ModelConfig[] = modelConfigData;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getScoreColor(score: number) {
  // Thresholds: >=85 green, 61-84 neutral, 41-60 orange, <=40 red
  if (score >= 85) return "text-emerald-500";
  if (score <= 40) return "text-red-500";
  if (score <= 60) return "text-amber-500";
  return "text-zinc-400";
}

export function getReliabilityIndexColor(score: number) {
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

export function getModelLabels(modelName: string) {
  const config = modelConfigs.find(c => c.modelName === modelName);
  const labels = [...(config?.labels || [])];
  
  return labels;
}

export function isDefaultJudge(modelName: string): boolean {
  const config = modelConfigs.find(c => c.modelName === modelName);
  // Default to true if not explicitly set to false
  return config?.isDefaultJudge !== false;
}

export function isDefaultCandidate(modelName: string): boolean {
  const config = modelConfigs.find(c => c.modelName === modelName);
  // Default to true if not explicitly set to false
  return config?.isDefaultCandidate !== false;
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
  const config = modelConfigs.find(c => c.modelName === modelName);
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
  // Lightweight fallback estimation (approx 4 chars per token)
  // We no longer bundle gpt-tokenizer for the frontend
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Helper function to calculate actual cost for a model based on its runs
export function calculateModelCost(modelName: string, runs: AugmentedResult[]): number {
  const modelRuns = runs.filter(r => r.modelName === modelName);
  
  // PRIMARY: Use precalculated cost injected at build time
  let totalCost = 0;
  let missingUsageData = false;

  for (const run of modelRuns) {
    if (run.usage?.cost !== undefined) {
      totalCost += run.usage.cost;
    } else {
      missingUsageData = true;
    }
  }

  // If we have full coverage from pre-calculated data, return it
  if (!missingUsageData && modelRuns.length > 0) {
    return totalCost;
  }
  
  // FALLBACK: Simple heuristic estimation if build-time data is missing
  // This allows the UI to degrade gracefully without crashing or showing $0.00 incorrectly
  const pricing = getModelPricing(modelName);
  if (!pricing) return totalCost; // Return whatever we found so far
  
  // Only calculate for runs that lacked usage data
  modelRuns.forEach(run => {
    if (run.usage?.cost !== undefined) return;

    // Skip transcript questions and only include first 30 regular questions
    if (run.question.id.startsWith('t') || !run.question.id.startsWith('q')) {
      return;
    }

    // We do NOT send the rubric to the candidate model (the student), only to the judge.
    // So we should not include it in the cost calculation here.
    const inputText = (run.question.context || '') +
                     run.question.scenario + 
                     "You are a therapist. Respond to this patient.";
    const totalInputTokens = countTokens(inputText);
    const totalOutputTokens = countTokens(run.response);
    
    totalCost += (totalInputTokens / 1_000_000) * pricing.input;
    totalCost += (totalOutputTokens / 1_000_000) * pricing.output;
  });
  
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
export function getRelativeCostColor(cost: number, allCosts: number[]): string {
  if (cost === 0) return 'text-zinc-600';
  
  const validCosts = allCosts.filter(c => c > 0);
  if (validCosts.length === 0) return 'text-zinc-600';
  
  const sortedCosts = [...validCosts].sort((a, b) => a - b);
  const position = sortedCosts.filter(c => c < cost).length;
  const percentile = (position / sortedCosts.length) * 100;
  
  if (percentile <= 20) return 'text-emerald-400';
  if (percentile <= 40) return 'text-green-400';
  if (percentile <= 60) return 'text-yellow-400';
  if (percentile <= 80) return 'text-orange-400';
  return 'text-red-400';
}

export function getFaithfulnessColor(score: number): string {
  if (score >= 95) return "text-emerald-500";
  if (score < 85) return "text-amber-500";
  return "text-zinc-500";
}

// Helper function to format the question prompt as the LLM sees it
export function formatQuestionForLLM(question: import('./types').QuestionNode): string {
  const { category, scenario, context } = question;

  const modalityPrompt = (() => {
    switch (category) {
      case 'CBT':
        return systemCBTTemplate;
      case 'DBT':
        return systemDBTTemplate;
      case 'ACT':
        return systemACTTemplate;
      case 'Safety':
        return systemSafetyTemplate;
      default:
        return systemGeneralTemplate;
    }
  })();

  const systemTemplate =
    category === 'Transcript'
      ? systemTranscriptTemplate
      : `${systemBaseTemplate}\n\n${modalityPrompt}`;

  const systemPrompt = Mustache.render(systemTemplate, { category });

  const userPrompt = (() => {
    if (category === 'Transcript' && context) {
      return `CONTEXT:\n${context}\n\nQUERY:\n${scenario}`;
    }
    if (context) {
      return `CONTEXT:\n${context}\n\nPatient says: "${scenario}"\n\nProvide a therapeutic response.`;
    }
    return `Patient says: "${scenario}"\n\nProvide a therapeutic response.`;
  })();

  return `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`;
}

// Helper function to format judge response as JSON (without sensitive fields)
export function formatJudgeResponseJSON(assessment: import('./types').JudgeAssessment): string {
  // Create a copy without the fields to hide
  const { evaluatorModel, timestamp, usage, ...filteredAssessment } = assessment as any;
  return JSON.stringify(filteredAssessment, null, 2);
}

// Helper function to format the judge prompt as the LLM sees it
export function formatJudgePromptForLLM(
  _judgeModel: string,
  scenario: string,
  response: string,
  rubric: import('./types').Rubric,
  category: string,
  isTranscriptQuestion: boolean = false,
  context?: string
): string {
  const isTranscript = isTranscriptQuestion;

  // Use the actual judge template - pass rubric data directly and let template handle formatting
  const rendered = Mustache.render(judgeTemplate, {
    isTranscript,
    context,
    category,
    scenario,
    response,
    criteria: rubric.criteria || '',
    mustInclude: rubric.mustInclude || [],
    mustAvoid: rubric.mustAvoid || []
  });

  return rendered;
}

// Helper function to calculate actual cost for a judge based on their evaluations
export function calculateJudgeCost(judgeId: string, runs: AugmentedResult[]): number {
  let totalCost = 0;
  const pricing = getModelPricing(judgeId);
  
  for (const run of runs) {
    // Skip transcript questions and only include first 30 regular questions
    if (run.question.id.startsWith('t') || !run.question.id.startsWith('q')) {
      continue;
    }
    
    // Only include first 30 regular questions (q1-q30)
    const questionNumber = parseInt(run.question.id.substring(1));
    if (questionNumber > 30) {
      continue;
    }
    
    const assessments = run.aiAssessments?.[judgeId];
    if (!assessments) continue;
    
    const assessmentArray = Array.isArray(assessments) ? assessments : [assessments];
    
    for (const assessment of assessmentArray) {
      // PRIMARY: Use precalculated cost
      if (assessment.usage?.cost !== undefined) {
        totalCost += assessment.usage.cost;
        continue;
      }

      // FALLBACK: Heuristic estimation
      if (pricing) {
        // The Judge DOES see the rubric.
        const inputText = run.question.scenario + 
                         JSON.stringify(run.question.rubric) +
                         run.response +
                         "Evaluate this therapeutic response.";
        const outputText = assessment.reasoning + 
                          JSON.stringify(assessment.flags) +
                          JSON.stringify(assessment.metrics);
        
        const inputTokens = countTokens(inputText);
        const outputTokens = countTokens(outputText);
        
        totalCost += (inputTokens / 1_000_000) * pricing.input;
        totalCost += (outputTokens / 1_000_000) * pricing.output;
      }
    }
  }

  return totalCost;
}
