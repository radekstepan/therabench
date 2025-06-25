#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCmd, evalCmd, reportCmd, replayCmd } from './commands.js';
import pkg from '../package.json' with { type: 'json' };

const program = new Command();

program
  .name('thera-bench')
  .version(pkg.version)
  .description('A self-contained, file-based framework for evaluating LLM performance in a single directory.');

program
  .command('init <dir>')
  .description('Generate ground-truth *.qa.json files from .txt files in the specified directory.')
  .action(async (dir) => {
    try {
      await initCmd(dir);
      console.log(chalk.green('\n✅ Initialization complete.'));
    } catch (error) {
      console.error(chalk.red('\n❌ Initialization failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('eval <dir>')
  .description('Evaluate a candidate model and generate new *.eval.json files.')
  .option('-m, --model <id>', 'Override candidate model from .env (e.g., "llama3:70b")')
  .action(async (dir, options) => {
    try {
      await evalCmd(dir, options);
    } catch (error) {
      console.error(chalk.red('\n❌ Evaluation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('report <dir> [runId]')
  .description('Display a scoreboard for a specific run, or the latest run.')
  .option('--json', 'Output report as JSON')
  .action(async (dir, runId, options) => {
    try {
      await reportCmd(dir, runId, options);
    } catch (error) {
      console.error(chalk.red('\n❌ Report generation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('replay <dir>')
  .description('Rerun the last evaluation configuration to check for score stability.')
  .action(async (dir) => {
    try {
      await replayCmd(dir);
    } catch (error) {
      console.error(chalk.red('\n❌ Replay failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
