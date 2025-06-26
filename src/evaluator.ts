import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { cfg } from './config.js';
import { OpenAIClient } from './model/OpenAIClient.js';
import { calculateMetrics, calculateKnowledgeMetrics } from './metrics.js';
import { findFilesByExtension, readJsonFile } from './fs-utils.js';
import type { QAPair, QAPairsFile, RunMeta, EvaluationResult, EvaluationFile } from './types.js';

interface EvaluationItem {
  /** The path to the source file, used for grouping results and naming output files. */
  sourcePath: string;
  sourceContent?: string;
  qaPair: QAPair;
}

function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function stripThinkingBlocks(responseText: string): string {
  return responseText.replace(/<think>.*?<\/think>/gs, '').trim();
}

/**
 * Loads all evaluation items based on the run type.
 * For RAG, it starts from .txt files to get context.
 * For knowledge, it starts from .qa.json files directly.
 */
async function loadAllEvaluationItems(dir: string, withContext: boolean): Promise<EvaluationItem[]> {
  const allItems: EvaluationItem[] = [];

  if (withContext) {
    // RAG Mode: Find .txt, then find matching .qa.json
    const sourceFiles = await findFilesByExtension(dir, '.txt');
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
  } else {
    // Knowledge Mode: Find .qa.json files directly
    const qaFiles = await findFilesByExtension(dir, '.qa.json');
    for (const qaPath of qaFiles) {
      const qaFile = await readJsonFile<QAPairsFile>(qaPath);
      if (qaFile?.qa_pairs) {
        for (const qaPair of qaFile.qa_pairs) {
          // The sourcePath is the qaPath itself, as there's no .txt context.
          allItems.push({ sourcePath: qaPath, qaPair });
        }
      }
    }
  }
  
  return allItems;
}

async function runEvaluationFlow(dir: string, opts: { candidateModel?: string }, runType: 'rag' | 'knowledge'): Promise<string> {
  const candidateModelName = opts.candidateModel ?? cfg.candidate.model;
  console.log(`Starting evaluation for model: ${chalk.cyan(candidateModelName)}`);

  const expertClient = new OpenAIClient(cfg.expert);
  const candidateClient = new OpenAIClient({
    base: cfg.candidate.base, model: candidateModelName, key: cfg.candidate.key,
  });

  const runId = createRunId();
  const runMeta: RunMeta = { runId, runType, candidateModel: candidateModelName, startedAt: new Date().toISOString() };
  
  const evalItems = await loadAllEvaluationItems(dir, runType === 'rag');
  if (evalItems.length === 0) throw new Error('No Q&A pairs found to evaluate. Run `thera-bench init` or create a `.qa.json` file first.');
  
  const progressBar = new cliProgress.SingleBar({ format: `${chalk.cyan('{bar}')} | {percentage}% | {value}/{total} Questions`, barCompleteChar: '\u2588', barIncompleteChar: '\u2591', hideCursor: true });
  progressBar.start(evalItems.length, 0);

  const limit = pLimit(cfg.maxParallel);
  const resultsByFile = new Map<string, EvaluationResult[]>();

  const evaluationPromises = evalItems.map(item => limit(async () => {
    const candidatePrompt = runType === 'rag'
      ? `Context:\n${item.sourceContent}\n\nQuestion: ${item.qaPair.question}\n\nAnswer:`
      : `Question: ${item.qaPair.question}\n\nAnswer:`;

    const rawCandidateAnswer = await candidateClient.generate({ prompt: candidatePrompt });
    const finalCandidateAnswer = stripThinkingBlocks(rawCandidateAnswer);

    const metrics = runType === 'rag'
      ? await calculateMetrics({ expertClient, question: item.qaPair.question, context: item.sourceContent!, groundTruthAnswer: item.qaPair.answer, candidateAnswer: finalCandidateAnswer })
      : await calculateKnowledgeMetrics({ expertClient, question: item.qaPair.question, groundTruthAnswer: item.qaPair.answer, candidateAnswer: finalCandidateAnswer });

    const result: EvaluationResult = { question: item.qaPair.question, ground_truth_answer: item.qaPair.answer, candidate_answer: finalCandidateAnswer, ...metrics };
    
    if (!resultsByFile.has(item.sourcePath)) resultsByFile.set(item.sourcePath, []);
    resultsByFile.get(item.sourcePath)!.push(result);

    progressBar.increment();
  }));

  await Promise.all(evaluationPromises);
  progressBar.stop();

  const fileSuffix = runType === 'knowledge' ? 'knowledge.eval.json' : 'eval.json';
  for (const [sourcePath, results] of resultsByFile.entries()) {
    const evalFile: EvaluationFile = { runMeta, results };
    
    // Correctly determine the base name for the output file in both modes.
    const baseOutputPath = runType === 'rag'
        ? sourcePath.replace(/\.txt$/, '')
        : sourcePath.replace(/\.qa\.json$/, '');
    
    const outputPath = `${baseOutputPath}.${runId}.${fileSuffix}`;
    await fs.writeFile(outputPath, JSON.stringify(evalFile, null, 2));
  }
  return runId;
}

export const runEvaluation = (dir: string, opts: { candidateModel?: string }) => runEvaluationFlow(dir, opts, 'rag');
export const runKnowledgeEvaluation = (dir: string, opts: { candidateModel?: string }) => runEvaluationFlow(dir, opts, 'knowledge');

export async function getLatestRunInfo(dir: string): Promise<RunMeta | null> {
    const evalFiles = await findFilesByExtension(dir, '.eval.json');
    if (evalFiles.length === 0) return null;
    const latestFile = evalFiles.sort().reverse()[0];
    const latestEval = await readJsonFile<EvaluationFile>(latestFile);
    return latestEval?.runMeta ?? null;
}
