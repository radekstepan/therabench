import chalk from 'chalk';
import { dbOps } from './db.js';

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

export async function generateReport(runId?: number, asJson = false) {
  const finalRunId = runId ?? dbOps.getLatestRunId();
  if (!finalRunId) {
    throw new Error('No runs found. Use `thera-bench eval` to create one.');
  }

  const runInfo = dbOps.getRunInfo(finalRunId);
  if (!runInfo) {
    throw new Error(`Run with ID ${finalRunId} not found.`);
  }

  const results = dbOps.getRunResults(finalRunId);
  if (results.length === 0) {
    throw new Error(`No results found for run ID ${finalRunId}. The run may have failed.`);
  }

  const avgFaithfulness = results.reduce((sum, r) => sum + r.faithfulness, 0) / results.length;
  const avgRelevancy = results.reduce((sum, r) => sum + r.relevancy, 0) / results.length;
  const avgJudgeScore = results.reduce((sum, r) => sum + r.judge_score, 0) / results.length;

  const passedMetrics = [
    avgFaithfulness >= THRESHOLDS.faithfulness,
    avgRelevancy >= THRESHOLDS.relevancy,
    avgJudgeScore >= THRESHOLDS.judge_score,
  ];
  const passedCount = passedMetrics.filter(Boolean).length;
  const overallResult = passedCount === passedMetrics.length ? 'PASS' : 'FAIL';
  
  const reportData = {
    run_id: runInfo.id,
    candidate_model: runInfo.candidate_model,
    started_at: runInfo.started_at,
    question_count: results.length,
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

  const runDate = new Date(runInfo.started_at).toLocaleString();
  console.log(chalk.bold(`Run #${runInfo.id} — ${runInfo.candidate_model}`) + ` ⏱  ${runDate}`);
  console.log('─'.repeat(50));
  console.log(formatScore('Faithfulness', avgFaithfulness, THRESHOLDS.faithfulness));
  console.log(formatScore('Relevancy', avgRelevancy, THRESHOLDS.relevancy));
  console.log(formatScore('Judge score', avgJudgeScore, THRESHOLDS.judge_score));
  console.log('─'.repeat(50));
  const resultColor = overallResult === 'PASS' ? chalk.green.bold : chalk.red.bold;
  console.log(`${resultColor(overallResult)} (${passedCount}/${passedMetrics.length} thresholds met)`);
}
