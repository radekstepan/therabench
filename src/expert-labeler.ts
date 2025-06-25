import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import chalk from 'chalk';
import { cfg } from './config.js';
import { OpenAIClient } from './model/OpenAIClient.js';
import { findFilesByExtension, fileExists } from './fs-utils.js';
import type { QAPair, QAPairsFile } from './types.js';

const expertClient = new OpenAIClient(cfg.expert);
const limit = pLimit(cfg.maxParallel);

const CHUNK_SIZE_WORDS = 400;
const CHUNK_OVERLAP_WORDS = 50;

function chunkTextByWords(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  if (words.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunkEnd = Math.min(i + chunkSize, words.length);
    chunks.push(words.slice(i, chunkEnd).join(' '));
    i += chunkSize - overlap;
    if (i + overlap >= words.length) break;
  }
  return chunks;
}

function createLabelingPrompt(transcriptChunk: string): string {
  return `
    Given the following TEXT CHUNK, please generate 2-3 high-quality question and answer pairs.
    Each pair must be grounded in the text. The answer MUST be a direct quote or a very close paraphrase of a sentence or two from the text.
    For each pair, also provide the "span", which is the exact text snippet from the text chunk that contains the answer.
    The output must be a single JSON object containing a key "qa_pairs" which is an array of objects.
    Each object in the array should have three keys: "question", "answer", and "span".
    TEXT CHUNK:
    ---
    ${transcriptChunk}
    ---
  `;
}

async function generateAndSave(sourceTxtPath: string): Promise<boolean> {
  const outputPath = sourceTxtPath.replace(/\.txt$/, '.qa.json');

  try {
    if (await fileExists(outputPath)) {
      return false; // Silently skip if file exists.
    }
    
    console.log(chalk.blue(`  - Processing: ${path.basename(sourceTxtPath)}`));

    const content = await fs.readFile(sourceTxtPath, 'utf-8');
    if (!content.trim()) {
      console.warn(chalk.yellow(`    - Skipped (empty file).`));
      return false;
    }

    const chunks = chunkTextByWords(content, CHUNK_SIZE_WORDS, CHUNK_OVERLAP_WORDS);
    const allPairs: QAPair[] = [];

    const chunkPromises = chunks.map((chunk, index) => limit(async () => {
      const prompt = createLabelingPrompt(chunk);
      const responseJson = await expertClient.generate({ prompt, json: true });
      const parsed = JSON.parse(responseJson) as QAPairsFile;
      if (!parsed.qa_pairs || !Array.isArray(parsed.qa_pairs)) {
        throw new Error(`Invalid JSON structure for chunk ${index + 1}`);
      }
      return parsed.qa_pairs;
    }));
    
    // FIX: Use Promise.allSettled to handle individual chunk failures gracefully.
    const settledResults = await Promise.allSettled(chunkPromises);

    settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            allPairs.push(...result.value);
        } else {
            console.error(chalk.red(`    - Error processing chunk ${index + 1}: ${result.reason.message}`));
        }
    });

    const uniquePairsMap = new Map<string, QAPair>();
    for (const pair of allPairs) {
      if (pair.question && !uniquePairsMap.has(pair.question.toLowerCase().trim())) {
        uniquePairsMap.set(pair.question.toLowerCase().trim(), pair);
      }
    }
    const finalPairs = Array.from(uniquePairsMap.values());
    
    if (finalPairs.length === 0) {
        console.warn(chalk.yellow(`    - No valid Q&A pairs were generated after processing all chunks.`));
        return false;
    }
    
    const finalJson: QAPairsFile = { qa_pairs: finalPairs };
    await fs.writeFile(outputPath, JSON.stringify(finalJson, null, 2), 'utf-8');
    console.log(chalk.green(`    - Generated ${path.basename(outputPath)} with ${finalPairs.length} unique Q&A pairs.`));
    return true;

  } catch (e: any) {
    console.error(chalk.red(`\n❌ An unexpected error occurred while processing file: ${path.basename(sourceTxtPath)}`));
    console.error(`  - Error: ${e.message}`);
    return false;
  }
}

export async function generateQaFiles(dir: string): Promise<number> {
  const transcriptFiles = await findFilesByExtension(dir, '.txt');
  if (transcriptFiles.length === 0) {
    throw new Error(`No .txt files found in source directory "${dir}".`);
  }
  
  console.log(`Found ${transcriptFiles.length} source transcript(s).`);

  const filesToProcess = [];
  for (const filePath of transcriptFiles) {
    const qaPath = filePath.replace(/\.txt$/, '.qa.json');
    if (!(await fileExists(qaPath))) {
        filesToProcess.push(filePath);
    } else {
        console.log(chalk.gray(`  - Skipping, QA file already exists: ${path.basename(qaPath)}`));
    }
  }

  if (filesToProcess.length === 0) {
    return 0; // Return early if there's nothing to do.
  }

  console.log(chalk.cyan(`\nStarting generation for ${filesToProcess.length} new transcript(s)...`));

  const generationPromises = filesToProcess.map(filePath => 
    generateAndSave(filePath) // No need for p-limit here as it's used inside generateAndSave
  );

  const results = await Promise.all(generationPromises);
  
  return results.filter(Boolean).length;
}
