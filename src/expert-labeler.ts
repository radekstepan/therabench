import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import { cfg } from './config.js';
import { OpenAIClient } from './model/OpenAIClient.js';
import { findFilesByExtension, ensureDir, fileExists } from './fs-utils.js';
import type { QAPairsFile } from './types.js';

const expertClient = new OpenAIClient(cfg.expert);
const limit = pLimit(cfg.maxParallel);

function createLabelingPrompt(transcriptContent: string): string {
  // ... (prompt is unchanged)
  return `
    Given the following transcript, please generate 3-5 high-quality question and answer pairs.
    Each pair should be grounded in the text. The answer MUST be a direct quote or a very close paraphrase of a sentence or two from the transcript.
    For each pair, also provide the "span", which is the exact text snippet from the transcript that contains the answer.
    The output must be a single JSON object containing a key "qa_pairs" which is an array of objects.
    Each object in the array should have three keys: "question", "answer", and "span".
    Transcript:
    ---
    ${transcriptContent}
    ---
  `;
}

async function generateAndSave(sourceTxtPath: string, qaPairsDir: string): Promise<boolean> {
  const basename = path.basename(sourceTxtPath, '.txt');
  const outputPath = path.join(qaPairsDir, `${basename}.qa.json`);

  // This variable is declared outside the try block to be accessible in the catch block.
  let responseJson: string | undefined;

  try {
    if (await fileExists(outputPath)) {
      return false; // Already exists, skip generation.
    }

    const content = await fs.readFile(sourceTxtPath, 'utf-8');
    if (!content.trim()) {
      console.warn(`Skipping empty transcript: ${sourceTxtPath}`);
      return false;
    }

    const prompt = createLabelingPrompt(content);
    responseJson = await expertClient.generate({ prompt, json: true });

    const parsed = JSON.parse(responseJson) as QAPairsFile;
    if (!parsed.qa_pairs || !Array.isArray(parsed.qa_pairs) || parsed.qa_pairs.length === 0) {
      console.warn(`Warning: No valid Q&A pairs generated for ${sourceTxtPath}. Skipping.`);
      return false;
    }
    
    await fs.writeFile(outputPath, JSON.stringify(parsed, null, 2), 'utf-8');
    console.log(`  - Generated ${outputPath}`);
    return true;
  } catch (e: any) {
    // FIX: This catch block is now safe. It logs the original error `e`
    // without causing a ReferenceError if `responseJson` is not yet defined.
    console.error(`\n❌ Error processing file: ${sourceTxtPath}`);
    console.error(`  - Original Error: ${e.message}`);
    if (responseJson) {
      console.error(`  - LLM response that may have caused the error: ${responseJson}`);
    }
    return false;
  }
}

export async function generateQaFiles(sourceDir: string, dataDir: string): Promise<number> {
  const qaPairsDir = path.join(dataDir, 'qa_pairs');
  await ensureDir(qaPairsDir);

  const transcriptFiles = await findFilesByExtension(sourceDir, '.txt');
  if (transcriptFiles.length === 0) {
    console.warn(`Warning: No .txt files found in source directory "${sourceDir}".`);
    return 0;
  }
  
  console.log(`Found ${transcriptFiles.length} source transcript(s). Checking for corresponding QA files...`);

  const generationPromises = transcriptFiles.map(filePath => 
    limit(() => generateAndSave(filePath, qaPairsDir))
  );

  const results = await Promise.all(generationPromises);
  return results.filter(Boolean).length;
}
