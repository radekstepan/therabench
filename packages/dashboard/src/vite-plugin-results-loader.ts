/**
 * Vite plugin to load results from simplified structure
 * data/results/{candidate}/{judge}.json
 * AND pre-calculate token costs to avoid expensive runtime calculation
 */

import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { encode } from 'gpt-tokenizer';

interface ModelRun {
  runId: string;
  questionId: string;
  modelName: string;
  response: string;
  aiAssessments?: Record<string, any[]>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  [key: string]: any;
}

interface QuestionNode {
  id: string;
  scenario: string;
  rubric: any;
  [key: string]: any;
}

interface ModelConfig {
  modelName: string;
  pricing?: {
    input: number;
    output: number;
  };
  [key: string]: any;
}

function stripEnhancedSuffix(modelName: string): string {
  return modelName.replace(' (Enhanced)', '');
}

function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch (error) {
    // Fallback estimation (approx 4 chars per token)
    return Math.ceil(text.length / 4);
  }
}

function getPricing(modelName: string, configs: ModelConfig[]) {
  const baseName = stripEnhancedSuffix(modelName);
  const config = configs.find(c => c.modelName === baseName);
  return config?.pricing || null;
}

function calculateRunCosts(runs: ModelRun[], questions: QuestionNode[], configs: ModelConfig[]): ModelRun[] {
  const questionMap = new Map(questions.map(q => [q.id, q]));

  return runs.map(run => {
    const question = questionMap.get(run.questionId);
    if (!question) return run;

    // 1. Calculate Candidate Model Cost
    const candidatePricing = getPricing(run.modelName, configs);
    if (candidatePricing) {
      // Input: scenario + rubric + prompt
      const inputText = question.scenario + 
                       JSON.stringify(question.rubric) +
                       "You are a therapist. Respond to this patient.";
      const inputTokens = countTokens(inputText);
      const outputTokens = countTokens(run.response);
      
      const cost = ((inputTokens / 1_000_000) * candidatePricing.input) + 
                   ((outputTokens / 1_000_000) * candidatePricing.output);
      
      run.usage = {
        inputTokens,
        outputTokens,
        cost
      };
    }

    // 2. Calculate Judge Costs
    if (run.aiAssessments) {
      Object.entries(run.aiAssessments).forEach(([judgeName, assessments]) => {
        const judgePricing = getPricing(judgeName, configs);
        if (!judgePricing) return;

        // Ensure array
        const assessmentList = Array.isArray(assessments) ? assessments : [assessments];

        assessmentList.forEach((assessment: any) => {
          // Input: scenario + rubric + response + prompt
          const judgeInputText = question.scenario + 
                                JSON.stringify(question.rubric) +
                                run.response +
                                "Evaluate this therapeutic response.";
          
          // Output: reasoning + flags + metrics
          const judgeOutputText = (assessment.reasoning || '') + 
                                 JSON.stringify(assessment.flags || []) +
                                 JSON.stringify(assessment.metrics || {});

          const inputTokens = countTokens(judgeInputText);
          const outputTokens = countTokens(judgeOutputText);
          
          const cost = ((inputTokens / 1_000_000) * judgePricing.input) + 
                       ((outputTokens / 1_000_000) * judgePricing.output);

          assessment.usage = {
            inputTokens,
            outputTokens,
            cost
          };
        });
      });
    }

    return run;
  });
}

function loadAllResults(resultsDir: string): ModelRun[] {
  if (!fs.existsSync(resultsDir)) {
    return [];
  }
  
  const resultsMap = new Map<string, ModelRun>();
  
  try {
    const candidateDirs = fs.readdirSync(resultsDir);
    
    for (const candidateDir of candidateDirs) {
      const candidatePath = path.join(resultsDir, candidateDir);
      
      if (!fs.statSync(candidatePath).isDirectory()) continue;
      
      const judgeFiles = fs.readdirSync(candidatePath).filter(f => f.endsWith('.json'));
      
      for (const file of judgeFiles) {
        const filePath = path.join(candidatePath, file);
        try {
          const runs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (Array.isArray(runs)) {
            for (const run of runs) {
              if (resultsMap.has(run.runId)) {
                // Merge assessments
                const existing = resultsMap.get(run.runId)!;
                const mergedAssessments = { ...existing.aiAssessments, ...run.aiAssessments };
                resultsMap.set(run.runId, { ...existing, aiAssessments: mergedAssessments });
              } else {
                resultsMap.set(run.runId, run);
              }
            }
          }
        } catch (error) {
          console.warn(`Warning: Failed to load results from ${filePath}`);
        }
      }
    }
  } catch (error) {
    console.error('Error loading results:', error);
  }
  
  return Array.from(resultsMap.values());
}

export default function resultsLoaderPlugin(): Plugin {
  const virtualModuleId = 'virtual:results';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'results-loader',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        // Use path relative to this file's location
        const pluginDir = path.dirname(new URL(import.meta.url).pathname);
        const resultsDir = path.resolve(pluginDir, '../../eval-engine/data/results');
        const questionsPath = path.resolve(pluginDir, '../../eval-engine/data/questions.json');
        const configPath = path.resolve(pluginDir, '../../eval-engine/data/model-config.json');
        
        let results: ModelRun[] = [];
        
        if (fs.existsSync(resultsDir)) {
          console.log('📦 Loading and calculating token costs...');
          
          // Load base results
          results = loadAllResults(resultsDir);
          
          // Load auxiliary data for cost calculation
          try {
            if (fs.existsSync(questionsPath) && fs.existsSync(configPath)) {
              const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
              const questions = Array.isArray(questionsData) ? questionsData : questionsData.questions;
              const configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
              
              // Inject costs
              results = calculateRunCosts(results, questions, configs);
              console.log(`✅ Processed costs for ${results.length} runs`);
            } else {
              console.warn('⚠️ Missing questions.json or model-config.json, skipping cost calculation');
            }
          } catch (e) {
            console.error('❌ Error calculating costs:', e);
          }
        } else {
          console.warn('⚠️  Results directory not found at:', resultsDir);
        }
        
        return `export default ${JSON.stringify(results)}`;
      }
    }
  };
}
