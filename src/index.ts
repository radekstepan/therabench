#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCmd, evalCmd, reportCmd, replayCmd } from './commands.js';
import pkg from '../package.json' with { type: 'json' };

const program = new Command();

program
  .name('thera-bench')
  .version(pkg.version)
  .description(pkg.description);

program
  .command('init <folder>')
  .description('Import .txt transcripts and generate ground-truth Q&A pairs with the expert model.')
  .action(async (folder) => {
    try {
      await initCmd(folder);
      console.log(chalk.green('\n✅ Initialization complete.'));
    } catch (error) {
      console.error(chalk.red('\n❌ Initialization failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('eval')
  .description('Evaluate the candidate model against the ground-truth dataset.')
  .option('-m, --model <id>', 'Override candidate model from .env (e.g., "llama3:70b")')
  .action(async (options) => {
    try {
      await evalCmd(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Evaluation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('report [run_id]')
  .description('Display a scoreboard for a specific run, or the latest run if no ID is provided.')
  .option('--json', 'Output report as JSON')
  .action(async (run_id, options) => {
    try {
      await reportCmd(run_id, options);
    } catch (error) {
      console.error(chalk.red('\n❌ Report generation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('replay')
  .description('Rerun the last evaluation configuration to check for score stability.')
  .action(async () => {
    try {
      await replayCmd();
    } catch (error) {
      console.error(chalk.red('\n❌ Replay failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Wrapper to make top-level await and error handling clean
const main = async () => {
  await program.parseAsync(process.argv);
};

main();

// Re-export command handlers for potential programmatic use
export * from './commands.js';
