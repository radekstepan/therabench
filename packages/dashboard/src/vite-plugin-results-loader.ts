/**
 * Vite plugin to load results and questions from data/
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
  context?: string;
  contextFile?: string;
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
  const config = configs.find(c => c.modelName === modelName);
  return config?.pricing || null;
}

function calculateRunCosts(runs: ModelRun[], questions: QuestionNode[], configs: ModelConfig[]): ModelRun[] {
  const questionMap = new Map(questions.map(q => [q.id, q]));

  return runs.map(run => {
    const question = questionMap.get(run.questionId);
    if (!question) return run;
    
    // Skip transcript questions for cost calculation and only include first 30 regular questions
    if (question.id.startsWith('t') || !question.id.startsWith('q')) {
      return run;
    }

    // 1. Calculate Candidate Model Cost
    const candidatePricing = getPricing(run.modelName, configs);
    if (candidatePricing) {
      // Input: context (if any) + scenario + prompt
      // NOTE: We do NOT send the rubric to the candidate model.
      const inputText = (question.context || '') + 
                       question.scenario + 
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
          // Input: context + scenario + rubric + response + prompt
          // NOTE: The Judge DOES receive the rubric.
          const judgeInputText = (question.context || '') +
                                question.scenario + 
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

/**
 * Scan data directory for questions.json and transcripts.json
 * Merge them into a single array and hydrate context from files if needed.
 */
function loadAllQuestions(dataDir: string): QuestionNode[] {
  const allQuestions: QuestionNode[] = [];
  
  // 1. Load questions.json
  const questionsPath = path.join(dataDir, 'questions.json');
  if (fs.existsSync(questionsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
      const qArray = Array.isArray(data) ? data : data.questions || [];
      allQuestions.push(...qArray);
    } catch (e) {
      console.error('Error loading questions.json:', e);
    }
  }

  // 2. Load transcripts.json
  const transcriptsPath = path.join(dataDir, 'transcripts.json');
  if (fs.existsSync(transcriptsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(transcriptsPath, 'utf-8'));
      const tArray = Array.isArray(data) ? data : data.questions || [];
      allQuestions.push(...tArray);
    } catch (e) {
      console.error('Error loading transcripts.json:', e);
    }
  }

  // 3. Hydrate context from files
  return allQuestions.map(q => {
    if (q.contextFile && !q.context) {
      const filePath = path.resolve(dataDir, q.contextFile);
      if (fs.existsSync(filePath)) {
        try {
          return {
            ...q,
            context: fs.readFileSync(filePath, 'utf-8')
          };
        } catch (e) {
          console.warn(`Failed to read context file: ${filePath}`);
        }
      } else {
        console.warn(`Context file not found: ${filePath}`);
      }
    }
    return q;
  });
}

export default function resultsLoaderPlugin(): Plugin {
  const virtualResultsId = 'virtual:results';
  const resolvedVirtualResultsId = '\0' + virtualResultsId;
  
  const virtualQuestionsId = 'virtual:questions';
  const resolvedVirtualQuestionsId = '\0' + virtualQuestionsId;

  return {
    name: 'results-loader',
    resolveId(id) {
      if (id === virtualResultsId) return resolvedVirtualResultsId;
      if (id === virtualQuestionsId) return resolvedVirtualQuestionsId;
    },
    load(id) {
      const pluginDir = path.dirname(new URL(import.meta.url).pathname);
      const dataDir = path.resolve(pluginDir, '../../eval-engine/data');
      const resultsDir = path.join(dataDir, 'results');
      const configPath = path.join(dataDir, 'model-config.json');

      if (id === resolvedVirtualResultsId) {
        let results: ModelRun[] = [];
        
        if (fs.existsSync(resultsDir)) {
          console.log('📦 Loading and calculating token costs...');
          
          results = loadAllResults(resultsDir);
          
          try {
            // Load all questions to map for cost calculation
            const questions = loadAllQuestions(dataDir);
            
            if (fs.existsSync(configPath)) {
              const configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
              results = calculateRunCosts(results, questions, configs);
              console.log(`✅ Processed costs for ${results.length} runs`);
            }
          } catch (e) {
            console.error('❌ Error calculating costs:', e);
          }
        }
        
        return `export default ${JSON.stringify(results)}`;
      }

      if (id === resolvedVirtualQuestionsId) {
        console.log('📦 Loading questions and transcripts...');
        const questions = loadAllQuestions(dataDir);
        console.log(`✅ Loaded ${questions.length} total scenarios`);
        return `export default ${JSON.stringify(questions)}`;
      }
    }
  };
}
