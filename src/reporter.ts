import path from 'path';
import chalk from 'chalk';
import { findFilesByExtension, readJsonFile } from './fs-utils.js';
import { getLatestRunInfo } from './evaluator.js';
import type { EvaluationFile, EvaluationResult, RunMeta } from './types.js';

const THRESHOLDS = {
  faithfulness: 0.90,
  relevancy: 0.75,
  judge_score: 8,
};

function formatScore(label: string, value: number, threshold: number): string {
  const pass = value >= threshold;
  const color = pass ? chalk.green : chalk.red;
  const icon = pass ? '✅' : '❌';
  return `${label.padEnd(14)} ${color(value.toFixed(2).padStart(5))} ${icon}`;
}

export async function generateReport(dir: string, runId?: string, asJson = false) {
  let finalRunId = runId;
  let runMeta: RunMeta | null = null;
  
  if (!finalRunId) {
    const latestRunInfo = await getLatestRunInfo(dir);
    if (!latestRunInfo) {
      throw new Error('No runs found. Use `thera-bench eval` to create one.');
    }
    finalRunId = latestRunInfo.runId;
    runMeta = latestRunInfo;
  }

  const allFiles = await findFilesByExtension(dir, '.eval.json');
  const runFiles = allFiles.filter(file => file.includes(`.${finalRunId}.`));

  if (runFiles.length === 0) {
    throw new Error(`No evaluation result files found for run ID ${finalRunId}.`);
  }

  if (!runMeta) {
    // If we have a runId but haven't loaded the meta yet, load it from the first file.
    const firstFileContent = await readJsonFile<EvaluationFile>(runFiles[0]);
    if (!firstFileContent?.runMeta) {
        throw new Error(`Could not read metadata from evaluation files for run ID ${finalRunId}.`);
    }
    runMeta = firstFileContent.runMeta;
  }
  
  const allResults: EvaluationResult[] = [];
  for (const file of runFiles) {
    const content = await readJsonFile<EvaluationFile>(file);
    if (content?.results) {
      allResults.push(...content.results);
    }
  }

  if (allResults.length === 0) {
    throw new Error(`No results could be loaded for run ID ${finalRunId}.`);
  }

  const avgFaithfulness = allResults.reduce((sum, r) => sum + r.faithfulness, 0) / allResults.length;
  const avgRelevancy = allResults.reduce((sum, r) => sum + r.relevancy, 0) / allResults.length;
  const avgJudgeScore = allResults.reduce((sum, r) => sum + r.judge_score, 0) / allResults.length;

  const passedMetrics = [
    avgFaithfulness >= THRESHOLDS.faithfulness,
    avgRelevancy >= THRESHOLDS.relevancy,
    avgJudgeScore >= THRESHOLDS.judge_score,
  ];
  const passedCount = passedMetrics.filter(Boolean).length;
  const overallResult = passedCount === passedMetrics.length ? 'PASS' : 'FAIL';
  
  const reportData = {
    run_id: runMeta.runId,
    candidate_model: runMeta.candidateModel,
    started_at: runMeta.startedAt,
    question_count: allResults.length,
    scores: {
      faithfulness: parseFloat(avgFaithfulness.toFixed(4)),
      relevancy: parseFloat(avgRelevancy.toFixed(4)),
      judge_score: parseFloat(avgJudgeScore.toFixed(4)),
    },
    thresholds: THRESHOLDS,
    overall_result: overallResult,
  };

  if (asJson) {
    console.log(JSON.stringify(reportData, null, 2));
    return;
  }

  const runDate = new Date(runMeta.startedAt).toLocaleString();
  console.log(chalk.bold(`Run #${runMeta.runId} — ${runMeta.candidateModel}`) + ` ⏱  ${runDate}`);
  console.log('─'.repeat(60));
  console.log(formatScore('Faithfulness', avgFaithfulness, THRESHOLDS.faithfulness));
  console.log(formatScore('Relevancy', avgRelevancy, THRESHOLDS.relevancy));
  console.log(formatScore('Judge score', avgJudgeScore, THRESHOLDS.judge_score));
  console.log('─'.repeat(60));
  const resultColor = overallResult === 'PASS' ? chalk.green.bold : chalk.red.bold;
  console.log(`${resultColor(overallResult)} (${passedCount}/${passedMetrics.length} thresholds met)`);
}
