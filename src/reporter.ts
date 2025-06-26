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

function formatScore(label: string, scale: string, value: number, threshold: number): string {
  const pass = value >= threshold;
  const color = pass ? chalk.green : chalk.red;
  const icon = pass ? '✅' : '❌';
  const fullLabel = `${label} ${chalk.gray(scale)}`.padEnd(34);
  return `${fullLabel} ${color(value.toFixed(2).padStart(5))} ${icon}`;
}

export async function generateReport(dir: string, runId?: string, asJson = false) {
  let finalRunId = runId;
  let runMeta: RunMeta | null = null;
  
  if (!finalRunId) {
    const latestRunInfo = await getLatestRunInfo(dir);
    if (!latestRunInfo) throw new Error('No runs found. Use `thera-bench eval` to create one.');
    finalRunId = latestRunInfo.runId;
    runMeta = latestRunInfo;
  }
  
  const allFiles = await findFilesByExtension(dir, '.eval.json');
  const runFiles = allFiles.filter(file => file.includes(`.${finalRunId}.`));

  if (runFiles.length === 0) throw new Error(`No evaluation result files found for run ID ${finalRunId}.`);
  
  if (!runMeta) {
    const firstFileContent = await readJsonFile<EvaluationFile>(runFiles[0]);
    if (!firstFileContent?.runMeta) throw new Error(`Could not read metadata for run ID ${finalRunId}.`);
    runMeta = firstFileContent.runMeta;
  }
  
  const allResults: EvaluationResult[] = [];
  for (const file of runFiles) {
    const content = await readJsonFile<EvaluationFile>(file);
    if (content?.results) allResults.push(...content.results);
  }

  if (allResults.length === 0) throw new Error(`No results could be loaded for run ID ${finalRunId}.`);

  const hasFaithfulness = runMeta.runType === 'rag';
  const faithfulnessResults = allResults.filter(r => r.faithfulness !== null).map(r => r.faithfulness as number);
  const avgFaithfulness = hasFaithfulness && faithfulnessResults.length > 0 ? faithfulnessResults.reduce((sum, r) => sum + r, 0) / faithfulnessResults.length : null;
  const avgRelevancy = allResults.reduce((sum, r) => sum + r.relevancy, 0) / allResults.length;
  const avgJudgeScore = allResults.reduce((sum, r) => sum + r.judge_score, 0) / allResults.length;

  // --- FIX: Dynamically build the list of checks ---
  const checks: boolean[] = [];
  if (hasFaithfulness && avgFaithfulness !== null) {
    checks.push(avgFaithfulness >= THRESHOLDS.faithfulness);
  }
  checks.push(avgRelevancy >= THRESHOLDS.relevancy);
  checks.push(avgJudgeScore >= THRESHOLDS.judge_score);

  const passedCount = checks.filter(Boolean).length;
  const totalMetrics = checks.length;
  const overallResult = passedCount === totalMetrics ? 'PASS' : 'FAIL';
  
  const reportData = { run_id: runMeta.runId, run_type: runMeta.runType, candidate_model: runMeta.candidateModel, started_at: runMeta.startedAt, question_count: allResults.length, scores: { faithfulness: avgFaithfulness ? parseFloat(avgFaithfulness.toFixed(4)) : null, relevancy: parseFloat(avgRelevancy.toFixed(4)), judge_score: parseFloat(avgJudgeScore.toFixed(4)) }, thresholds: THRESHOLDS, overall_result: overallResult };

  if (asJson) {
    console.log(JSON.stringify(reportData, null, 2));
    return;
  }

  const runDate = new Date(runMeta.startedAt).toLocaleString();
  const runTypeLabel = runMeta.runType === 'knowledge' ? ' (Knowledge)' : ' (RAG)';
  console.log(chalk.bold(`Run #${runMeta.runId}${runTypeLabel} — ${runMeta.candidateModel}`) + ` ⏱  ${runDate}`);
  console.log('─'.repeat(60));
  if (hasFaithfulness && avgFaithfulness !== null) {
    console.log(formatScore('Faithfulness', '(0-1)', avgFaithfulness, THRESHOLDS.faithfulness));
  }
  console.log(formatScore('Relevancy',    '(0-1)', avgRelevancy, THRESHOLDS.relevancy));
  console.log(formatScore('Judge score',  '(0-10)', avgJudgeScore, THRESHOLDS.judge_score));
  console.log('─'.repeat(60));
  const resultColor = overallResult === 'PASS' ? chalk.green.bold : chalk.red.bold;
  console.log(`${resultColor(overallResult)} (${passedCount}/${totalMetrics} thresholds met)`);
}
