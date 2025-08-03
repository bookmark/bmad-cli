#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { runConfigWizard } from './src/config-wizard.js';
import { startChat } from './src/chat.js';
import { listAgents } from './src/agent-loader.js';
import { exportConversation } from './src/export.js';
import { showUsageStats } from './src/usage-stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(process.env.HOME, '.bmadrc');

// Create program
const program = new Command();

program
  .name('bmad-cli')
  .description('Simple CLI interface for BMAD-METHOD')
  .version('1.0.0');

// Helper function to check config
async function checkConfig() {
  if (!await fs.pathExists(CONFIG_PATH)) {
    console.log(chalk.yellow('No configuration found. Running setup wizard...\n'));
    await runConfigWizard();
  }
  return await fs.readJson(CONFIG_PATH);
}

// Default command - start chat
program
  .action(async () => {
    try {
      const config = await checkConfig();
      await startChat(config);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Chat command
program
  .command('chat [agent]')
  .description('Start a chat session with an agent')
  .action(async (agent) => {
    try {
      const config = await checkConfig();
      await startChat(config, agent);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all available agents')
  .action(async () => {
    try {
      const config = await checkConfig();
      await listAgents(config);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Export command
program
  .command('export [sessionFile]')
  .description('Export a conversation to markdown')
  .action(async (sessionFile) => {
    try {
      const config = await checkConfig();
      await exportConversation(config, sessionFile);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Run the configuration wizard')
  .action(async () => {
    try {
      await runConfigWizard();
      console.log(chalk.green('✓ Configuration updated successfully!'));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Usage command
program
  .command('usage')
  .description('Show token usage statistics')
  .option('-d, --detailed', 'Show detailed conversation breakdown')
  .option('-t, --today', 'Show only today\'s usage')
  .action(async (options) => {
    try {
      const config = await checkConfig();
      await showUsageStats(config, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}