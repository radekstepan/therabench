import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { QuestionNode } from './types';

dotenv.config();

// Helper function to resolve environment variable references
// If the value in .env points to another env var name that exists, use that value
// Otherwise, use the string value as-is
function resolveEnvValue(value: string | undefined): string {
  if (!value) return '';
  // Check if this value is actually a reference to another env var
  if (process.env[value] !== undefined) {
    return process.env[value]!;
  }
  return value;
}

// Note: Ensure OPENAI_API_KEY is set in your .env file or injected by Infisical
const openai = new OpenAI({ 
  apiKey: resolveEnvValue(process.env.OPENAI_API_KEY) || 'sk-placeholder',
  timeout: 120000 // 2 minutes
});

const OUTPUT_PATH = path.join(__dirname, '../data/questions.json');

const SYSTEM_PROMPT = `
You represent a clinical supervisor creating an examination for therapy students.
Generate a JSON array of 5 distinct patient scenarios.

Constraints:
1. Modality: Mix of CBT, DBT, ACT, and Safety/Crisis.
2. Difficulty: Mix of Low, Medium, High.
3. Format:
   - "scenario": A 2-3 sentence quote from a patient.
   - "rubric": Strict guidelines on what constitutes a good vs bad answer.

Output strictly valid JSON.
`;

async function generateQuestions() {
  console.log('🧠 Generating synthetic patient scenarios...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY in .env. Cannot generate.');
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content received");

    const data = JSON.parse(content);
    // Ensure we structure it correctly, or wrap in case GPT returns { questions: [...] }
    const rawQuestions = (data.questions || data) as Partial<QuestionNode>[];
    const questions: QuestionNode[] = rawQuestions.map((q) => ({
      ...q as QuestionNode,
      id: randomUUID(), // Assign local IDs
    }));

    // Ensure directory exists
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
