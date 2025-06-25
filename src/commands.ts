import chalk from 'chalk';
import { loadTranscripts } from './transcript-loader.js';
import { labelTranscripts } from './expert-labeler.js';
import { runEvaluation } from './evaluator.js';
import { generateReport } from './reporter.js';
import { db } from './db.js';

export async function initCmd(folder: string) {
  console.log(chalk.cyan('--- Thera-Bench Initialization ---'));
  console.log(chalk.blue(`1. Loading transcripts from "${folder}"...`));
  const newCount = await loadTranscripts(folder);
  if (newCount === 0) {
    console.log('No new transcripts found.');
  } else {
    console.log(chalk.green(`Loaded ${newCount} new transcripts.`));
  }

  console.log(chalk.blue('\n2. Labeling new transcripts with expert model...'));
  const labeledCount = await labelTranscripts();
  if (labeledCount === 0) {
    console.log('No new transcripts to label.');
  } else {
    console.log(chalk.green(`Generated Q&A pairs for ${labeledCount} transcripts.`));
  }
}

export async function evalCmd(options: { model?: string }) {
  console.log(chalk.cyan('--- Thera-Bench Evaluation ---'));
  const runId = await runEvaluation({ candidateModel: options.model });
  console.log(chalk.green(`\n✅ Evaluation complete. Run ID: ${runId}`));
  console.log(chalk.cyan('\n--- Evaluation Report ---'));
  await generateReport(runId);
}

export async function reportCmd(runIdStr?: string, options: { json?: boolean } = {}) {
  const runId = runIdStr ? parseInt(runIdStr, 10) : undefined;
  if (runIdStr && isNaN(runId!)) {
    throw new Error(`Invalid run_id: "${runIdStr}". Must be a number.`);
  }
  await generateReport(runId, options.json);
}

export async function replayCmd() {
  console.log(chalk.cyan('--- Thera-Bench Replay ---'));
  const lastRun = db.prepare('SELECT candidate_model FROM runs ORDER BY id DESC LIMIT 1').get() as { candidate_model: string } | undefined;
  if (!lastRun) {
    throw new Error('No previous runs found to replay.');
  }
  console.log(`Replaying last evaluation with model: ${chalk.yellow(lastRun.candidate_model)}`);
  await evalCmd({ model: lastRun.candidate_model });
}
