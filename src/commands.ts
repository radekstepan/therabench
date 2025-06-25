import chalk from 'chalk';
import { generateQaFiles } from './expert-labeler.js';
import { runEvaluation, getLatestRunInfo } from './evaluator.js';
import { generateReport } from './reporter.js';

export async function initCmd(dir: string) {
  console.log(chalk.cyan('--- Thera-Bench Initialization ---'));
  console.log(chalk.blue(`Scanning "${dir}" for .txt files to process...`));
  const generatedCount = await generateQaFiles(dir);
  if (generatedCount > 0) {
    console.log(chalk.green(`\nGenerated ${generatedCount} new Q&A files.`));
  } else {
    console.log(chalk.yellow('\nNo new Q&A files were generated. All transcripts may already have corresponding .qa.json files.'));
  }
}

export async function evalCmd(dir: string, options: { model?: string }) {
  console.log(chalk.cyan('--- Thera-Bench Evaluation ---'));
  const runId = await runEvaluation(dir, { candidateModel: options.model });
  console.log(chalk.green(`\n✅ Evaluation complete. Run ID: ${runId}`));
  console.log(chalk.cyan('\n--- Evaluation Report ---'));
  await generateReport(dir, runId);
}

export async function reportCmd(dir: string, runId?: string, options: { json?: boolean } = {}) {
  await generateReport(dir, runId, options.json);
}

export async function replayCmd(dir: string) {
  console.log(chalk.cyan('--- Thera-Bench Replay ---'));
  const latestRunInfo = await getLatestRunInfo(dir);
  if (!latestRunInfo) {
    throw new Error('No previous runs found to replay.');
  }
  
  const modelToReplay = latestRunInfo.candidateModel;
  console.log(`Replaying last evaluation for model: ${chalk.yellow(modelToReplay)}`);
  
  await evalCmd(dir, { model: modelToReplay });
}
