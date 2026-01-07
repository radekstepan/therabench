import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import Mustache from 'mustache';
import { extractJsonSync } from '@axync/extract-json';
import { QuestionNode, ModelRun, JudgeAssessment } from './types';
import { loadAllResults, saveResults } from './results-manager';

dotenv.config();

interface ModelConfig {
  modelName: string;
  labels: Array<{ text: string; color: string }>;
  useTextMode?: boolean;
}

const MODEL_CONFIG_PATH = path.join(__dirname, '../data/model-config.json');
const modelConfigs: ModelConfig[] = JSON.parse(fs.readFileSync(MODEL_CONFIG_PATH, 'utf-8'));

function resolveEnvValue(value: string | undefined): string {
  if (!value) return '';
  if (process.env[value] !== undefined) {
    return process.env[value]!;
  }
  return value;
}

const DATA_DIR = path.join(__dirname, '../data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const TRANSCRIPTS_FILE = path.join(DATA_DIR, 'transcripts.json');
const TEMPLATES_DIR = path.join(__dirname, '../templates');

function loadFileAndHydrate(filePath: string): QuestionNode[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const questions = Array.isArray(data) ? data : data.questions || [];
    
    for (const q of questions) {
      if (q.contextFile && !q.context) {
        const contextPath = path.resolve(path.dirname(filePath), q.contextFile);
        if (fs.existsSync(contextPath)) {
          q.context = fs.readFileSync(contextPath, 'utf-8');
        } else {
          console.warn(`⚠️ Context file not found: ${contextPath}`);
        }
      }
    }
    return questions;
  } catch (e) {
    console.error(`Error loading ${filePath}:`, e);
    return [];
  }
}

function loadAllQuestions(): QuestionNode[] {
    const q1 = loadFileAndHydrate(QUESTIONS_FILE);
    const q2 = loadFileAndHydrate(TRANSCRIPTS_FILE);
    return [...q1, ...q2];
}

const EXPERT_MODEL_URL = process.env.EXPERT_MODEL_URL;
const EXPERT_MODEL_NAME = process.env.EXPERT_MODEL_NAME;
const EXPERT_MODEL_API_KEY = resolveEnvValue(process.env.EXPERT_MODEL_API_KEY);

const openai = new OpenAI({ 
  apiKey: EXPERT_MODEL_API_KEY,
  baseURL: EXPERT_MODEL_URL,
  timeout: 120000 
});

async function runJudge(question: QuestionNode, response: string): Promise<JudgeAssessment> {
  const templatePath = path.join(TEMPLATES_DIR, 'judge.mustache');
  const template = fs.readFileSync(templatePath, 'utf-8');

  const mustInclude = question.rubric.mustInclude || [];
  const mustAvoid = question.rubric.mustAvoid || [];

  const prompt = Mustache.render(template, {
    isTranscript: question.category === 'Transcript',
    context: question.context || '',
    category: question.category,
    scenario: question.scenario,
    response: response,
    criteria: question.rubric.criteria || '',
    mustInclude,
    mustAvoid,
    hasMustInclude: mustInclude.length > 0,
    hasMustAvoid: mustAvoid.length > 0
  });

  if (!EXPERT_MODEL_API_KEY || !EXPERT_MODEL_NAME) {
    throw new Error('EXPERT_MODEL_API_KEY and EXPERT_MODEL_NAME are required');
  }

  const modelConfig = modelConfigs.find(c => c.modelName === EXPERT_MODEL_NAME!);
  const maxRetries = 5;
  let useTextFormat = modelConfig?.useTextMode || false;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const requestParams: any = {
        model: EXPERT_MODEL_NAME!,
        messages: [{ role: "user", content: prompt }]
      };
      
      if (useTextFormat) {
        requestParams.response_format = { type: "text" };
      } else {
        requestParams.response_format = { type: "json_object" };
      }
      
      const completion = await openai.chat.completions.create(requestParams);
      const content = completion.choices[0].message.content || '{}';
      
      try {
        const extracted = extractJsonSync(content, 1);
        if (extracted.length === 0) throw new Error('No valid JSON found');
        const assessment = extracted[0] as any;
        if (typeof assessment.score !== 'number') throw new Error('Missing score');
        if (!assessment.metrics) assessment.metrics = {};
        
        // FIXED: Use delete to remove irrelevant metrics instead of setting to 0
        if (question.category === 'Transcript') {
             if (assessment.metrics.faithfulness === undefined) assessment.metrics.faithfulness = 0;
             delete assessment.metrics.safety;
             delete assessment.metrics.empathy;
             delete assessment.metrics.modalityAdherence;
        } else {
             if (assessment.metrics.safety === undefined) assessment.metrics.safety = 0;
             if (assessment.metrics.empathy === undefined) assessment.metrics.empathy = 0;
             if (assessment.metrics.modalityAdherence === undefined) assessment.metrics.modalityAdherence = 0;
             delete assessment.metrics.faithfulness;
        }
        
        return {
          ...assessment,
          evaluatorModel: EXPERT_MODEL_NAME!,
          timestamp: new Date().toISOString()
        } as JudgeAssessment;

      } catch (parseError) {
        if (attempt === maxRetries) throw parseError;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    } catch (error: any) {
      const errorMsg = error.message || JSON.stringify(error);
      const isFormatError = errorMsg.includes("response_format") || (error.status === 400 && errorMsg.includes("json_schema"));
      
      if (isFormatError && !useTextFormat) {
        useTextFormat = true;
        attempt--; 
        continue;
      }
      
      if (attempt === maxRetries) throw new Error(`Evaluation failed after ${maxRetries} attempts: ${errorMsg}`);
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  throw new Error('Evaluation failed: All retries exhausted');
}

async function main() {
  try {
    if (!EXPERT_MODEL_NAME || !EXPERT_MODEL_URL || !EXPERT_MODEL_API_KEY) {
      console.error('❌ Missing expert model configuration');
      process.exit(1);
    }

    const force = process.argv.includes('--force') || process.argv.includes('--all');
    
    const questions = loadAllQuestions();
    const allResults = loadAllResults();
    
    if (allResults.length === 0) {
      console.error('❌ No results found to re-evaluate.');
      process.exit(1);
    }

    const judgeModel = EXPERT_MODEL_NAME!;
    console.log(`🚀 Starting re-evaluation using judge: ${judgeModel}`);
    if (force) console.log(`⚠️  Force mode enabled: Will re-judge all responses.`);
    
    const itemsToJudge = allResults.filter(r => {
      // If forcing, judge everything.
      if (force) return true;
      
      // Otherwise, only judge if missing assessment from this judge
      const assessments = r.aiAssessments?.[judgeModel];
      return !(Array.isArray(assessments) && assessments.length > 0);
    });

    if (itemsToJudge.length === 0) {
      console.log('✨ All caught up!');
      process.exit(0);
    }

    for (let i = 0; i < itemsToJudge.length; i++) {
      const run = itemsToJudge[i];
      const question = questions.find(q => q.id === run.questionId);
      if (!question) continue;

      console.log(`[${i + 1}/${itemsToJudge.length}] Re-judging ${run.modelName} - Q: ${question.id}`);
      try {
        const assessment = await runJudge(question, run.response);
        if (!run.aiAssessments) run.aiAssessments = {};
        const currentList = Array.isArray(run.aiAssessments[judgeModel]) ? run.aiAssessments[judgeModel] : [];
        currentList.push(assessment);
        run.aiAssessments[judgeModel] = currentList;
        saveResults([run], run.modelName, judgeModel);
      } catch (error: any) {
        console.error(`   ⚠️  Failed: ${error.message}`);
      }
    }
    console.log(`\n✅ Re-evaluation complete.`);
  } catch (error) {
    console.error('❌ Error during re-evaluation:', error);
    process.exit(1);
  }
}

main();
