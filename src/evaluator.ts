import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import chalk from 'chalk';
import { cfg } from './config.js';
import { OpenAIClient } from './model/OpenAIClient.js';
import { OllamaClient } from './model/OllamaClient.js';
import { calculateMetrics } from './metrics.js';
import { findFilesByExtension, readJsonFile } from './fs-utils.js';
import type { QAPairsFile, RunMeta, EvaluationResult, EvaluationFile } from './types.js';

function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function runEvaluation(dir: string, opts: { candidateModel?: string }): Promise<string> {
  const candidateModelName = opts.candidateModel ?? cfg.candidate.model;
  console.log(`Starting evaluation for model: ${candidateModelName}`);

  const candidateClient = new OllamaClient({ ...cfg.candidate, model: candidateModelName });
  const expertClient = new OpenAIClient(cfg.expert);

  const runId = createRunId();
  const runMeta: RunMeta = { runId, candidateModel: candidateModelName, startedAt: new Date().toISOString() };

  const sourceFiles = await findFilesByExtension(dir, '.txt');
  if (sourceFiles.length === 0) {
    throw new Error(`No .txt files found in directory: ${dir}`);
  }

  const limit = pLimit(cfg.maxParallel);
  let processedCount = 0;
  let skippedCount = 0;

  const evaluationPromises = sourceFiles.map(sourcePath => limit(async () => {
    const qaPath = sourcePath.replace(/\.txt$/, '.qa.json');
    const qaFile = await readJsonFile<QAPairsFile>(qaPath);

    if (!qaFile || !qaFile.qa_pairs || qaFile.qa_pairs.length === 0) {
      skippedCount++;
      return; // Skip if no corresponding QA file exists
    }

    const sourceContent = await fs.readFile(sourcePath, 'utf-8');
    const resultsForFile: EvaluationResult[] = [];

    for (const qaPair of qaFile.qa_pairs) {
      const candidatePrompt = `Context:\n${sourceContent}\n\nQuestion: ${qaPair.question}\n\nAnswer:`;
      const candidateAnswer = await candidateClient.generate({ prompt: candidatePrompt });

      const metrics = await calculateMetrics({
        expertClient,
        question: qaPair.question,
        context: sourceContent,
        groundTruthAnswer: qaPair.answer,
        candidateAnswer,
      });

      resultsForFile.push({
        question: qaPair.question,
        ground_truth_answer: qaPair.answer,
        candidate_answer: candidateAnswer,
        ...metrics,
      });
    }

    const evalFile: EvaluationFile = { runMeta, results: resultsForFile };
    const outputPath = sourcePath.replace(/\.txt$/, `.${runId}.eval.json`);
    await fs.writeFile(outputPath, JSON.stringify(evalFile, null, 2));
    
    processedCount++;
    process.stdout.write(chalk.blue(`\r  Evaluated ${processedCount}/${sourceFiles.length} transcripts...`));
  }));

  await Promise.all(evaluationPromises);

  if (skippedCount > 0) {
    console.log(chalk.yellow(`\nSkipped ${skippedCount} transcript(s) that did not have a corresponding .qa.json file.`));
  }

  return runId;
}

export async function getLatestRunInfo(dir: string): Promise<RunMeta | null> {
    const evalFiles = await findFilesByExtension(dir, '.eval.json');
    if (evalFiles.length === 0) return null;

    // The run ID is a timestamp, so sorting filenames gives the latest.
    const latestFile = evalFiles.sort().reverse()[0];
    const latestEval = await readJsonFile<EvaluationFile>(latestFile);
    
    return latestEval?.runMeta ?? null;
}
