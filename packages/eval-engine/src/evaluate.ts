import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import Mustache from 'mustache';
import { extractJsonSync } from '@axync/extract-json';
import { QuestionNode, ModelRun, JudgeAssessment } from './types';
import { saveResults, loadAllResults } from './results-manager';

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
const DEFAULT_QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const TRANSCRIPTS_FILE = path.join(DATA_DIR, 'transcripts.json');
const TEMPLATES_DIR = path.join(__dirname, '../templates');

function renderTemplate(templateName: string, data: any): string {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.mustache`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  const template = fs.readFileSync(templatePath, 'utf-8');
  return Mustache.render(template, data);
}

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

function getQuestions(): { questions: QuestionNode[], sourceName: string } {
  const fileArgIndex = process.argv.indexOf('--file');
  
  if (fileArgIndex > -1 && process.argv[fileArgIndex + 1]) {
    const customPath = path.resolve(process.cwd(), process.argv[fileArgIndex + 1]);
    if (!fs.existsSync(customPath)) {
      console.error(`❌ No questions found at ${customPath}`);
      process.exit(1);
    }
    return {
      questions: loadFileAndHydrate(customPath),
      sourceName: path.basename(customPath)
    };
  }

  const standardQuestions = loadFileAndHydrate(DEFAULT_QUESTIONS_FILE);
  const transcriptQuestions = loadFileAndHydrate(TRANSCRIPTS_FILE);
  
  const allQuestions = [...standardQuestions, ...transcriptQuestions];

  if (allQuestions.length === 0) {
    console.error(`❌ No questions found in ${DATA_DIR}`);
    process.exit(1);
  }
  
  return {
    questions: allQuestions,
    sourceName: 'questions.json + transcripts.json'
  };
}

const CANDIDATE_MODEL_URL = process.env.CANDIDATE_MODEL_URL;
const CANDIDATE_MODEL_NAME = process.env.CANDIDATE_MODEL_NAME;
const CANDIDATE_MODEL_API_KEY = resolveEnvValue(process.env.CANDIDATE_MODEL_API_KEY);

const EXPERT_MODEL_URL = process.env.EXPERT_MODEL_URL;
const EXPERT_MODEL_NAME = process.env.EXPERT_MODEL_NAME;
const EXPERT_MODEL_API_KEY = resolveEnvValue(process.env.EXPERT_MODEL_API_KEY);

const ENHANCED_PROMPTS = process.env.ENHANCED_PROMPTS === 'true';

const openai = new OpenAI({ 
  apiKey: EXPERT_MODEL_API_KEY,
  baseURL: EXPERT_MODEL_URL,
  timeout: 120000 
});

const candidateClient = new OpenAI({ 
  apiKey: CANDIDATE_MODEL_API_KEY || 'dummy-key',
  baseURL: CANDIDATE_MODEL_URL,
  timeout: 120000 
});

function generateSystemPrompt(category: string): string {
  if (category === 'Transcript') {
    return renderTemplate('system_transcript', {});
  }

  const basePrompt = renderTemplate('system_base', {});

  let modalityPrompt = '';
  switch (category) {
    case 'CBT':
      modalityPrompt = renderTemplate('system_cbt', {});
      break;
    case 'DBT':
      modalityPrompt = renderTemplate('system_dbt', {});
      break;
    case 'ACT':
      modalityPrompt = renderTemplate('system_act', {});
      break;
    case 'Safety':
      modalityPrompt = renderTemplate('system_safety', {});
      break;
    default:
      modalityPrompt = renderTemplate('system_general', {});
      break;
  }

  return `${basePrompt}\n\n${modalityPrompt}`;
}

async function queryCandidateModel(question: QuestionNode): Promise<string> {
  const useEnhanced = ENHANCED_PROMPTS && question.category !== 'Transcript';
  
  const systemPrompt = useEnhanced 
    ? generateSystemPrompt(question.category)
    : (question.category === 'Transcript' ? "Answer based on the text provided." : "You are a therapist.");

  let userContent = `Patient says: "${question.scenario}"\n\nProvide a therapeutic response.`;
  
  if (question.category === 'Transcript' && question.context) {
    userContent = `CONTEXT:\n${question.context}\n\nQUERY:\n${question.scenario}`;
  } else if (question.context) {
    userContent = `CONTEXT:\n${question.context}\n\n${userContent}`;
  }

  try {
    const completion = await candidateClient.chat.completions.create({
      model: CANDIDATE_MODEL_NAME!,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      stream: false
    });
    
    return completion.choices[0].message.content || '';
  } catch (e) {
    throw new Error(`Could not reach candidate model at ${CANDIDATE_MODEL_URL}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function runJudge(question: QuestionNode, response: string): Promise<JudgeAssessment> {
  const prompt = renderTemplate('judge', {
    isTranscript: question.category === 'Transcript',
    context: question.context || '',
    category: question.category,
    scenario: question.scenario,
    response: response,
    mustInclude: question.rubric.mustInclude.join(', '),
    mustAvoid: question.rubric.mustAvoid.join(', ')
  });

  if (!EXPERT_MODEL_API_KEY) throw new Error('EXPERT_MODEL_API_KEY is required but not set');
  if (!EXPERT_MODEL_NAME) throw new Error('EXPERT_MODEL_NAME is required but not set');

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

        if (question.category === 'Transcript') {
             if (assessment.metrics.faithfulness === undefined) assessment.metrics.faithfulness = 0;
             assessment.metrics.safety = 0;
             assessment.metrics.empathy = 0;
             assessment.metrics.modalityAdherence = 0;
        } else {
             if (assessment.metrics.safety === undefined) assessment.metrics.safety = 0;
             if (assessment.metrics.empathy === undefined) assessment.metrics.empathy = 0;
             if (assessment.metrics.modalityAdherence === undefined) assessment.metrics.modalityAdherence = 0;
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
    if (!CANDIDATE_MODEL_NAME || !CANDIDATE_MODEL_URL || !EXPERT_MODEL_NAME || !EXPERT_MODEL_URL || !EXPERT_MODEL_API_KEY) {
      console.error('❌ Missing required configuration in environment variables');
      process.exit(1);
    }

    const { questions, sourceName } = getQuestions();
    const runTimestamp = new Date().toISOString();
    const judgeModel = EXPERT_MODEL_NAME!;
    const baseName = CANDIDATE_MODEL_NAME!;
    const enhancedName = `${baseName} (Enhanced)`;
    
    const existingResults = loadAllResults();
    const existingMap = new Map<string, ModelRun>();
    for (const r of existingResults) {
      if (r.modelName === baseName || r.modelName === enhancedName) {
        existingMap.set(`${r.questionId}|${r.modelName}`, r);
      }
    }
    
    console.log(`🚀 Starting evaluation on ${questions.length} questions`);
    const results: ModelRun[] = [];
    let skipped = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const isTranscript = q.category === 'Transcript';
      const useEnhanced = ENHANCED_PROMPTS && !isTranscript;
      const currentRunModelName = useEnhanced ? enhancedName : baseName;
      
      const existingKey = `${q.id}|${currentRunModelName}`;
      const existing = existingMap.get(existingKey);
      const assessments = existing?.aiAssessments?.[judgeModel];
      
      if (Array.isArray(assessments) && assessments.length > 0) {
        console.log(`[${i + 1}/${questions.length}] ⏭️  Skipping ${q.id} (already evaluated)`);
        skipped++;
        continue;
      }
      
      console.log(`[${i + 1}/${questions.length}] Processing ${q.id} (${q.category}) -> ${currentRunModelName}`);
      const response = await queryCandidateModel(q);
      
      try {
        const assessment = await runJudge(q, response);
        const run: ModelRun = {
          runId: randomUUID(),
          questionId: q.id,
          modelName: currentRunModelName,
          timestamp: runTimestamp,
          response,
          aiAssessments: { [assessment.evaluatorModel || judgeModel]: [assessment] }
        };
        results.push(run);
        saveResults([run], currentRunModelName, judgeModel);
      } catch (error: any) {
        console.error(`   ⚠️  Skipping save - evaluation failed: ${error.message}`);
        continue;
      }
    }

    console.log(`\n✅ Evaluation complete! Processed: ${results.length}, Skipped: ${skipped}`);
  } catch (error) {
    console.error('❌ Error during evaluation:', error);
    process.exit(1);
  }
}

main();
