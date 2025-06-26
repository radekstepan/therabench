#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCmd, evalCmd, evalKnowledgeCmd, reportCmd, replayCmd } from './commands.js';
import pkg from '../package.json' with { type: 'json' };

const program = new Command();

program
  .name('thera-bench')
  .version(pkg.version)
  .description('A self-contained, file-based framework for evaluating LLM performance.');

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
  .description('Evaluate a model\'s ability to answer questions using provided context (RAG).')
  .option('-m, --model <id>', 'Override candidate model from .env')
  .action(async (dir, options) => {
    try {
      await evalCmd(dir, options);
    } catch (error) {
      console.error(chalk.red('\n❌ RAG Evaluation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('eval-knowledge <dir>')
  .description("Evaluate a model's built-in knowledge (no context provided).")
  .option('-m, --model <id>', 'Override candidate model from .env')
  .action(async (dir, options) => {
    try {
      await evalKnowledgeCmd(dir, options);
    } catch (error) {
      console.error(chalk.red('\n❌ Knowledge Evaluation failed:'), error instanceof Error ? error.message : error);
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
