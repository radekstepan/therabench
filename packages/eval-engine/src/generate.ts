import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import Mustache from 'mustache';
import { QuestionNode } from './types';

dotenv.config();

function resolveEnvValue(value: string | undefined): string {
  if (!value) return '';
  if (process.env[value] !== undefined) {
    return process.env[value]!;
  }
  return value;
}

const openai = new OpenAI({ 
  apiKey: resolveEnvValue(process.env.OPENAI_API_KEY) || 'sk-placeholder',
  timeout: 120000 
});

const OUTPUT_PATH = path.join(__dirname, '../data/questions.json');
const TEMPLATES_DIR = path.join(__dirname, '../templates');

async function generateQuestions() {
  console.log('🧠 Generating synthetic patient scenarios...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY in .env. Cannot generate.');
    return;
  }

  const templatePath = path.join(TEMPLATES_DIR, 'generate_questions.mustache');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const systemPrompt = Mustache.render(template, { count: 5 });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content received");

    const data = JSON.parse(content);
    const rawQuestions = (data.questions || data) as Partial<QuestionNode>[];
    const questions: QuestionNode[] = rawQuestions.map((q) => ({
      ...q as QuestionNode,
      id: randomUUID(),
    }));

    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(questions, null, 2));
    console.log(`✅ Generated ${questions.length} questions to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Error generating questions:', error);
    process.exit(1);
  }
}

generateQuestions();
