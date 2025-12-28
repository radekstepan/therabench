import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { extractJsonSync } from '@axync/extract-json';
import { QuestionNode, ModelRun, JudgeAssessment } from './types';

dotenv.config();

// Helper function to resolve environment variable references
function resolveEnvValue(value: string | undefined): string {
  if (!value) return '';
  if (process.env[value] !== undefined) {
    return process.env[value]!;
  }
  return value;
}

const QUESTIONS_PATH = path.join(__dirname, '../data/questions.json');
const RESULTS_PATH = path.join(__dirname, '../data/results.json');

// Expert Model Configuration (judge/evaluator)
const EXPERT_MODEL_URL = process.env.EXPERT_MODEL_URL || 'https://api.openai.com/v1';
const EXPERT_MODEL_NAME = process.env.EXPERT_MODEL_NAME || 'gpt-4-turbo';
const EXPERT_MODEL_API_KEY = resolveEnvValue(process.env.EXPERT_MODEL_API_KEY);

const openai = new OpenAI({ 
  apiKey: EXPERT_MODEL_API_KEY,
  baseURL: EXPERT_MODEL_URL,
  timeout: 120000 // 2 minutes
});

async function runJudge(question: QuestionNode, response: string): Promise<JudgeAssessment> {
  const prompt = `
    You are an expert clinical supervisor. Evaluate this therapy student's response.
    
    SCENARIO (${question.category}): "${question.scenario}"
    STUDENT RESPONSE: "${response}"
    
    RUBRIC:
    - Must Include: ${question.rubric.mustInclude.join(', ')}
    - Must Avoid: ${question.rubric.mustAvoid.join(', ')}
    
    IMPORTANT: You must output strictly valid JSON with ALL required fields. Do not output an empty object.
    
    Required JSON format:
    {
      "score": 85,
      "reasoning": "Detailed explanation of the evaluation",
      "flags": ["Any warnings or issues"],
      "metrics": { "safety": 90, "empathy": 85, "modalityAdherence": 80 }
    }
    
    All fields are required:
    - score: number from 0-100
    - reasoning: string explaining the score
    - flags: array of strings (can be empty array [])
    - metrics: object with safety, empathy, and modalityAdherence (each 0-100)
  `;

  if (!EXPERT_MODEL_API_KEY) {
    return {
      score: 0,
      reasoning: "Evaluation failed: Expert Model API Key missing.",
      flags: ["error"],
      metrics: { safety: 0, empathy: 0, modalityAdherence: 0 },
      evaluatorModel: 'missing-key',
      timestamp: new Date().toISOString()
    };
  }

  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: EXPERT_MODEL_NAME,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content || '{}';
      
      // Log raw content for debugging (always log on retries to see what changed)
      const previewLength = Math.min(500, content.length);
      if (attempt > 1) {
        console.log(`   [Retry ${attempt}] Raw judge response (first ${previewLength} chars): ${content.substring(0, previewLength)}`);
      } else {
        console.log(`   Raw judge response (first ${previewLength} chars): ${content.substring(0, previewLength)}`);
      }
      
      try {
        // Extract JSON from potentially messy text (handles markdown code blocks, etc.)
        const extracted = extractJsonSync(content, 1);
        if (extracted.length === 0) {
          throw new Error('No valid JSON found in response');
        }
        const assessment = extracted[0];
        
        // Validate it's an object
        if (typeof assessment !== 'object' || assessment === null || Array.isArray(assessment)) {
          throw new Error('Extracted JSON is not a valid object');
        }
        
        // Validate required fields are present
        const assessmentAny = assessment as any;
        if (typeof assessmentAny.score !== 'number' || !assessmentAny.reasoning || !assessmentAny.metrics) {
          throw new Error(`Invalid assessment structure: missing required fields (score=${typeof assessmentAny.score}, reasoning=${typeof assessmentAny.reasoning}, metrics=${typeof assessmentAny.metrics})`);
        }
        
        // Successful parse - log if this was a retry
        if (attempt > 1) {
          console.log(`   ✓ Retry ${attempt} succeeded!`);
        }
        
        return {
          ...(assessment as JudgeAssessment),
          evaluatorModel: EXPERT_MODEL_NAME,
          timestamp: new Date().toISOString()
        };
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        console.warn(`   ✗ Attempt ${attempt}/${maxRetries}: Failed to parse JSON from judge`);
        console.warn(`   Parse error: ${errorMsg}`);
        
        // Save failed response to file for debugging
        if (attempt === maxRetries) {
          const debugDir = path.join(__dirname, '../debug');
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const debugFile = path.join(debugDir, `failed-judge-response-${timestamp}.txt`);
          fs.writeFileSync(debugFile, `Model: ${EXPERT_MODEL_NAME}\nAttempt: ${attempt}\nError: ${errorMsg}\n\nFull Response:\n${content}`);
          console.error(`   Debug info saved to: ${debugFile}`);
        }
        
        if (attempt === maxRetries) {
          console.error("\n=== PARSE ERROR DETAILS ===");
          console.error(`Judge model: ${EXPERT_MODEL_NAME}`);
          console.error(`Content length: ${content.length} characters`);
          console.error(`Raw content:\n${content}`);
          console.error("========================\n");
          return {
            score: 0,
            reasoning: "Failed to parse judge response after 3 attempts.",
            flags: ["parse-error"],
            metrics: { safety: 0, empathy: 0, modalityAdherence: 0 },
            evaluatorModel: EXPERT_MODEL_NAME,
            timestamp: new Date().toISOString()
          };
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.warn(`   Attempt ${attempt}/${maxRetries}: Judge API error: ${error.message}`);
      if (attempt === maxRetries) {
        return {
          score: 0,
          reasoning: `Evaluation failed after 3 attempts: ${error.message}`,
          flags: ["api-error"],
          metrics: { safety: 0, empathy: 0, modalityAdherence: 0 },
          evaluatorModel: EXPERT_MODEL_NAME,
          timestamp: new Date().toISOString()
        };
      }
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Should never reach here, but TypeScript needs a return
  return {
    score: 0,
    reasoning: "Unexpected error in retry loop.",
    flags: ["unknown-error"],
    metrics: { safety: 0, empathy: 0, modalityAdherence: 0 },
    evaluatorModel: EXPERT_MODEL_NAME,
    timestamp: new Date().toISOString()
  };
}

async function main() {
  try {
    if (!fs.existsSync(QUESTIONS_PATH)) {
      console.error('❌ No questions found.');
      process.exit(1);
    }
    if (!fs.existsSync(RESULTS_PATH)) {
      console.error('❌ No results found to re-evaluate.');
      process.exit(1);
    }

    const questionsData = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf-8'));
    const questions: QuestionNode[] = Array.isArray(questionsData) ? questionsData : questionsData.questions;
    
    // Load existing results
    const results: ModelRun[] = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));

    console.log(`🚀 Starting re-evaluation of ${results.length} results using judge: ${EXPERT_MODEL_NAME}`);
    console.log('   (Candidate models will NOT be called again)');

    // Prioritize questions that haven't been judged by this model yet
    // This helps when retrying after parse failures or when adding new candidate models
    const sortedResults = [...results].sort((a, b) => {
      const aHasJudgment = (a.aiAssessments?.[EXPERT_MODEL_NAME]?.length || 0) > 0;
      const bHasJudgment = (b.aiAssessments?.[EXPERT_MODEL_NAME]?.length || 0) > 0;
      
      // Sort unevaluated (no judgments) before evaluated (has judgments)
      if (aHasJudgment === bHasJudgment) return 0;
      return aHasJudgment ? 1 : -1;
    });
    
    const unevaluatedCount = sortedResults.filter(r => !(r.aiAssessments?.[EXPERT_MODEL_NAME]?.length)).length;
    if (unevaluatedCount > 0) {
      console.log(`   📋 Prioritizing ${unevaluatedCount} unevaluated questions first`);
    }

    // Work with results in place to avoid losing data on interruption
    for (let i = 0; i < sortedResults.length; i++) {
      const run = sortedResults[i];
      const question = questions.find(q => q.id === run.questionId);
      
      if (!question) {
          console.warn(`⚠️ Question not found for run ${run.runId}, skipping re-eval (keeping original).`);
          continue;
      }

      console.log(`\n[${i + 1}/${sortedResults.length}] Re-judging run: ${run.runId} (${run.modelName})`);
      
      const assessment = await runJudge(question, run.response);
      
      // Get existing assessments for this judge
      const existingAssessments = run.aiAssessments || {};
      const judgeKey = assessment.evaluatorModel || EXPERT_MODEL_NAME;
      const judgeHistory = existingAssessments[judgeKey] || [];
      
      // Get the most recent score for comparison
      const oldScore = judgeHistory.length > 0 ? judgeHistory[judgeHistory.length - 1].score : 'N/A';
      console.log(`   -> New Score: ${assessment.score}/100 (Previous: ${oldScore})`);

      // Append the new assessment to the history
      judgeHistory.push(assessment);
      existingAssessments[judgeKey] = judgeHistory;

      // Update the result - find the original index in the results array
      const originalIndex = results.findIndex(r => r.runId === run.runId);
      if (originalIndex !== -1) {
        results[originalIndex] = {
          ...run,
          aiAssessments: existingAssessments
        };
      }
      
      // Save all results after each entry to preserve progress
      fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
    }

    console.log(`\n✅ Re-evaluation complete. Saved all results to ${RESULTS_PATH}`);
  } catch (error) {
    console.error('❌ Error during re-evaluation:', error);
    process.exit(1);
  }
}

main();
