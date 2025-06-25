import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { cfg } from './config.js';
import { OpenAIClient } from './model/OpenAIClient.js';
import { calculateMetrics } from './metrics.js';
import { findFilesByExtension, readJsonFile } from './fs-utils.js';
import type { QAPair, QAPairsFile, RunMeta, EvaluationResult, EvaluationFile } from './types.js';

// --- Helper Types for Progress Bar ---
interface EvaluationItem {
  sourcePath: string;
  sourceContent: string;
  qaPair: QAPair;
}

function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Pre-scans all QA files to build a flat list of every single question to be evaluated.
 * This is necessary to get the total count for the progress bar.
 */
async function loadAllEvaluationItems(dir: string): Promise<EvaluationItem[]> {
  const sourceFiles = await findFilesByExtension(dir, '.txt');
  const allItems: EvaluationItem[] = [];

  for (const sourcePath of sourceFiles) {
    const qaPath = sourcePath.replace(/\.txt$/, '.qa.json');
    const qaFile = await readJsonFile<QAPairsFile>(qaPath);

    if (qaFile?.qa_pairs) {
      const sourceContent = await fs.readFile(sourcePath, 'utf-8');
      for (const qaPair of qaFile.qa_pairs) {
        allItems.push({ sourcePath, sourceContent, qaPair });
      }
    }
  }
  return allItems;
}


export async function runEvaluation(dir: string, opts: { candidateModel?: string }): Promise<string> {
  const candidateModelName = opts.candidateModel ?? cfg.candidate.model;
  console.log(`Starting evaluation for model: ${chalk.cyan(candidateModelName)}`);

  const expertClient = new OpenAIClient(cfg.expert);
  const candidateClient = new OpenAIClient({
    base: cfg.candidate.base,
    model: candidateModelName,
    key: cfg.candidate.key,
  });

  const runId = createRunId();
  const runMeta: RunMeta = { runId, candidateModel: candidateModelName, startedAt: new Date().toISOString() };

  // 1. Pre-load all evaluation items to get a total count.
  const evalItems = await loadAllEvaluationItems(dir);
  if (evalItems.length === 0) {
    throw new Error('No Q&A pairs found to evaluate. Run `thera-bench init` first.');
  }

  // 2. Setup and start the progress bar.
  const progressBar = new cliProgress.SingleBar({
    format: `${chalk.cyan('{bar}')} | {percentage}% | {value}/{total} Questions`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  progressBar.start(evalItems.length, 0);

  const limit = pLimit(cfg.maxParallel);
  const resultsByFile = new Map<string, EvaluationResult[]>();

  // 3. Process each individual Q&A pair.
  const evaluationPromises = evalItems.map(item => limit(async () => {
    const candidatePrompt = `Context:\n${item.sourceContent}\n\nQuestion: ${item.qaPair.question}\n\nAnswer:`;
    const candidateAnswer = await candidateClient.generate({ prompt: candidatePrompt });

    const metrics = await calculateMetrics({
      expertClient,
      question: item.qaPair.question,
      context: item.sourceContent,
      groundTruthAnswer: item.qaPair.answer,
      candidateAnswer,
    });

    const result: EvaluationResult = {
      question: item.qaPair.question,
      ground_truth_answer: item.qaPair.answer,
      candidate_answer: candidateAnswer,
      ...metrics,
    };
    
    // Group results by their original source file
    if (!resultsByFile.has(item.sourcePath)) {
      resultsByFile.set(item.sourcePath, []);
    }
    resultsByFile.get(item.sourcePath)!.push(result);

    // 4. Increment the progress bar after each item is fully processed.
    progressBar.increment();
  }));

  await Promise.all(evaluationPromises);

  // 5. Stop the progress bar and write the grouped results to files.
  progressBar.stop();
  for (const [sourcePath, results] of resultsByFile.entries()) {
    const evalFile: EvaluationFile = { runMeta, results };
    const outputPath = sourcePath.replace(/\.txt$/, `.${runId}.eval.json`);
    await fs.writeFile(outputPath, JSON.stringify(evalFile, null, 2));
  }

  return runId;
}

export async function getLatestRunInfo(dir: string): Promise<RunMeta | null> {
    const evalFiles = await findFilesByExtension(dir, '.eval.json');
    if (evalFiles.length === 0) return null;
    const latestFile = evalFiles.sort().reverse()[0];
    const latestEval = await readJsonFile<EvaluationFile>(latestFile);
    return latestEval?.runMeta ?? null;
}
