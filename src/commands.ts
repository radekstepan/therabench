import chalk from 'chalk';
import { generateQaFiles } from './expert-labeler.js';
import { runEvaluation, getLatestRunId } from './evaluator.js';
import { generateReport } from './reporter.js';

export async function initCmd(sourceDir: string, dataDir: string) {
  console.log(chalk.cyan('--- Thera-Bench Initialization ---'));
  console.log(chalk.blue(`Generating Q&A files from "${sourceDir}" into "${dataDir}/qa_pairs"...`));
  const generatedCount = await generateQaFiles(sourceDir, dataDir);
  console.log(chalk.green(`Generated ${generatedCount} new Q&A files.`));
}

export async function evalCmd(sourceDir: string, dataDir: string, options: { model?: string }) {
  console.log(chalk.cyan('--- Thera-Bench Evaluation ---'));
  const runId = await runEvaluation(sourceDir, dataDir, { candidateModel: options.model });
  console.log(chalk.green(`\n✅ Evaluation complete. Run ID: ${runId}`));
  console.log(chalk.cyan('\n--- Evaluation Report ---'));
  await generateReport(dataDir, runId);
}

export async function reportCmd(dataDir: string, runId?: string, options: { json?: boolean } = {}) {
  await generateReport(dataDir, runId, options.json);
}

export async function replayCmd(sourceDir: string, dataDir: string) {
  console.log(chalk.cyan('--- Thera-Bench Replay ---'));
  const latestRun = await getLatestRunId(dataDir);
  if (!latestRun) {
    throw new Error('No previous runs found to replay.');
  }
  
  const modelToReplay = latestRun.meta.candidateModel;
  console.log(`Replaying last evaluation for model: ${chalk.yellow(modelToReplay)}`);
  
  await evalCmd(sourceDir, dataDir, { model: modelToReplay });
}
