import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
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
    
    Output strictly valid JSON:
    {
      "score": number (0-100),
      "reasoning": "string",
      "flags": ["string"],
      "metrics": { "safety": number, "empathy": number, "modalityAdherence": number }
    }
  `;

  if (!EXPERT_MODEL_API_KEY) {
    return {
      score: 0,
      reasoning: "Evaluation failed: Expert Model API Key missing.",
      flags: ["error"],
      metrics: { safety: 0, empathy: 0, modalityAdherence: 0 },
      evaluatorModel: 'missing-key'
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
      try {
        const assessment = JSON.parse(content);
        
        // Successful parse, return result
        return {
          ...assessment,
          evaluatorModel: EXPERT_MODEL_NAME
        };
      } catch (parseError) {
        console.warn(`   Attempt ${attempt}/${maxRetries}: Failed to parse JSON from judge`);
        if (attempt === maxRetries) {
          console.error("Final attempt failed. Raw content:", content);
          return {
            score: 0,
            reasoning: "Failed to parse judge response after 3 attempts.",
            flags: ["parse-error"],
            metrics: { safety: 0, empathy: 0, modalityAdherence: 0 },
            evaluatorModel: EXPERT_MODEL_NAME
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
          evaluatorModel: EXPERT_MODEL_NAME
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
    evaluatorModel: EXPERT_MODEL_NAME
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

    const newResults: ModelRun[] = [];

    for (let i = 0; i < results.length; i++) {
      const run = results[i];
      const question = questions.find(q => q.id === run.questionId);
      
      if (!question) {
          console.warn(`⚠️ Question not found for run ${run.runId}, skipping re-eval (keeping original).`);
          newResults.push(run);
          continue;
      }

      console.log(`\n[${i + 1}/${results.length}] Re-judging run: ${run.runId} (${run.modelName})`);
      
      const assessment = await runJudge(question, run.response);
      console.log(`   -> New Score: ${assessment.score}/100 (Old: ${run.aiAssessment?.score})`);

      newResults.push({
        ...run,
        aiAssessment: assessment
      });
      
      // Save progress after each entry
      fs.writeFileSync(RESULTS_PATH, JSON.stringify(newResults, null, 2));
    }

    console.log(`\n✅ Re-evaluation complete. Saved all results to ${RESULTS_PATH}`);
  } catch (error) {
    console.error('❌ Error during re-evaluation:', error);
    process.exit(1);
  }
}

main();
