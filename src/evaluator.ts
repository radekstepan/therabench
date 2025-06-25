import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import { cfg } from './config.js';
import { OpenAIClient } from './model/OpenAIClient.js';
import { OllamaClient } from './model/OllamaClient.js';
import { calculateMetrics } from './metrics.js';
import { findFilesByExtension, readJsonFile, ensureDir } from './fs-utils.js';
import type { QAPairsFile, RunMeta, EvaluationResult, EvaluationFile } from './types.js';

function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeModelName(name: string): string {
    return name.replace(/[:/]/g, '_');
}

export async function runEvaluation(sourceDir: string, dataDir: string, opts: { candidateModel?: string }): Promise<string> {
  const candidateModelName = opts.candidateModel ?? cfg.candidate.model;
  console.log(`Starting evaluation for model: ${candidateModelName}`);

  const candidateClient = new OllamaClient({ ...cfg.candidate, model: candidateModelName });
  const expertClient = new OpenAIClient(cfg.expert);

  const runId = createRunId();
  const runDir = path.join(dataDir, 'runs', runId);
  const qaPairsDir = path.join(dataDir, 'qa_pairs');
  await ensureDir(runDir);

  const runMeta: RunMeta = {
    runId,
    candidateModel: candidateModelName,
    startedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(runDir, '_meta.json'), JSON.stringify(runMeta, null, 2));

  const sourceFiles = await findFilesByExtension(sourceDir, '.txt');
  if (sourceFiles.length === 0) {
    throw new Error(`No .txt files found in source directory: ${sourceDir}`);
  }

  const limit = pLimit(cfg.maxParallel);
  let processedCount = 0;

  const evaluationPromises = sourceFiles.map(sourcePath => limit(async () => {
    const basename = path.basename(sourcePath, '.txt');
    const qaPath = path.join(qaPairsDir, `${basename}.qa.json`);

    const qaFile = await readJsonFile<QAPairsFile>(qaPath);
    if (!qaFile || !qaFile.qa_pairs || qaFile.qa_pairs.length === 0) {
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
    const outputPath = path.join(runDir, `${basename}.eval.json`);
    await fs.writeFile(outputPath, JSON.stringify(evalFile, null, 2));
    
    processedCount++;
    process.stdout.write(`\r  Evaluated ${processedCount}/${sourceFiles.length} transcripts...`);
  }));

  await Promise.all(evaluationPromises);
  return runId;
}

export async function getLatestRunId(dataDir: string): Promise<{id: string, meta: RunMeta} | null> {
    const runsBaseDir = path.join(dataDir, 'runs');
    try {
        const runDirs = await fs.readdir(runsBaseDir, { withFileTypes: true });
        const sortedDirs = runDirs
            .filter(d => d.isDirectory())
            .map(d => d.name)
            .sort()
            .reverse();
        
        if (sortedDirs.length > 0) {
            const latestRunId = sortedDirs[0];
            const meta = await readJsonFile<RunMeta>(path.join(runsBaseDir, latestRunId, '_meta.json'));
            if (!meta) return null;
            return { id: latestRunId, meta };
        }
        return null;
    } catch (error: any) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}
