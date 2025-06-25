#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCmd, evalCmd, reportCmd, replayCmd } from './commands.js';
import pkg from '../package.json' with { type: 'json' };

const program = new Command();

program
  .name('thera-bench')
  .version(pkg.version)
  .description('A database-free, file-based framework for evaluating LLM performance.');

program
  .command('init <sourceDir> <dataDir>')
  .description('Generate ground-truth Q&A files from .txt transcripts.')
  .action(async (sourceDir, dataDir) => {
    try {
      await initCmd(sourceDir, dataDir);
      console.log(chalk.green('\n✅ Initialization complete.'));
    } catch (error) {
      console.error(chalk.red('\n❌ Initialization failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('eval <sourceDir> <dataDir>')
  .description('Evaluate a candidate model and write results to a new run directory.')
  .option('-m, --model <id>', 'Override candidate model from .env (e.g., "llama3:70b")')
  .action(async (sourceDir, dataDir, options) => {
    try {
      await evalCmd(sourceDir, dataDir, options);
    } catch (error) {
      console.error(chalk.red('\n❌ Evaluation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('report <dataDir> [runId]')
  .description('Display a scoreboard for a specific run, or the latest run.')
  .option('--json', 'Output report as JSON')
  .action(async (dataDir, runId, options) => {
    try {
      await reportCmd(dataDir, runId, options);
    } catch (error) {
      console.error(chalk.red('\n❌ Report generation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('replay <sourceDir> <dataDir>')
  .description('Rerun the last evaluation configuration to check for score stability.')
  .action(async (sourceDir, dataDir) => {
    try {
      await replayCmd(sourceDir, dataDir);
    } catch (error) {
      console.error(chalk.red('\n❌ Replay failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
