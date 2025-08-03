import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { globalUsageTracker } from './token-counter.js';

// Show token usage statistics
export async function showUsageStats(config, options = {}) {
  const stats = globalUsageTracker.getAllStats();
  
  if (stats.total.conversations === 0) {
    console.log(chalk.yellow('\nNo usage data available yet.'));
    console.log(chalk.gray('Start a chat with OpenAI enabled to track usage.\n'));
    return;
  }

  // Header
  console.log(chalk.cyan('\n📊 Token Usage Statistics\n'));

  // Today's usage
  if (options.today) {
    const todayStats = globalUsageTracker.getDailyStats();
    if (todayStats) {
      console.log(chalk.cyan('Today\'s Usage:'));
      console.log(`  ${chalk.gray('Total Tokens:')} ${todayStats.totalTokens.toLocaleString()}`);
      console.log(`  ${chalk.gray('Total Cost:')} ${chalk.yellow(`$${todayStats.totalCost.toFixed(4)}`)}`);
    } else {
      console.log(chalk.yellow('No usage data for today.'));
    }
    console.log();
    return;
  }

  // Overall statistics
  console.log(chalk.cyan('Overall Statistics:'));
  console.log(`  ${chalk.gray('Total Conversations:')} ${stats.total.conversations}`);
  console.log(`  ${chalk.gray('Total Messages:')} ${stats.total.messages}`);
  console.log(`  ${chalk.gray('Total Tokens:')} ${stats.total.totalTokens.toLocaleString()}`);
  console.log(`    ${chalk.gray('• Prompt Tokens:')} ${stats.total.promptTokens.toLocaleString()}`);
  console.log(`    ${chalk.gray('• Completion Tokens:')} ${stats.total.completionTokens.toLocaleString()}`);
  console.log(`  ${chalk.gray('Total Cost:')} ${chalk.yellow(`$${stats.total.totalCost.toFixed(4)}`)}`);
  
  // Average per conversation
  if (stats.total.conversations > 0) {
    const avgTokens = Math.round(stats.total.totalTokens / stats.total.conversations);
    const avgCost = stats.total.totalCost / stats.total.conversations;
    console.log(`  ${chalk.gray('Avg per Conversation:')} ${avgTokens.toLocaleString()} tokens (${chalk.yellow(`$${avgCost.toFixed(4)}`)})`);
  }

  // Daily breakdown
  if (stats.daily.length > 0) {
    console.log(chalk.cyan('\nDaily Breakdown:'));
    const sortedDaily = stats.daily.sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 7);
    
    for (const [date, data] of sortedDaily) {
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      console.log(`  ${chalk.gray(formattedDate)}: ${data.totalTokens.toLocaleString()} tokens (${chalk.yellow(`$${data.totalCost.toFixed(4)}`)})`);
    }
  }

  // Detailed conversation breakdown
  if (options.detailed && stats.conversations.length > 0) {
    console.log(chalk.cyan('\nRecent Conversations:'));
    const sortedConversations = stats.conversations.sort((a, b) => b[0] - a[0]).slice(0, 10);
    
    for (const [id, data] of sortedConversations) {
      const timestamp = new Date(parseInt(id)).toLocaleString();
      console.log(`\n  ${chalk.gray(timestamp)}`);
      console.log(`    ${chalk.gray('Messages:')} ${data.messages}`);
      console.log(`    ${chalk.gray('Tokens:')} ${data.totalTokens.toLocaleString()} (prompt: ${data.promptTokens.toLocaleString()}, completion: ${data.completionTokens.toLocaleString()})`);
      console.log(`    ${chalk.gray('Cost:')} ${chalk.yellow(`$${data.totalCost.toFixed(4)}`)}`);
    }
  }

  // Cost limits if configured
  if (config.openai?.costLimit) {
    console.log(chalk.cyan('\nCost Limits:'));
    if (config.openai.costLimit.perConversation) {
      console.log(`  ${chalk.gray('Per Conversation:')} $${config.openai.costLimit.perConversation.toFixed(2)}`);
    }
    if (config.openai.costLimit.daily) {
      console.log(`  ${chalk.gray('Daily Limit:')} $${config.openai.costLimit.daily.toFixed(2)}`);
      
      // Check against today's usage
      const todayStats = globalUsageTracker.getDailyStats();
      if (todayStats) {
        const percentUsed = (todayStats.totalCost / config.openai.costLimit.daily) * 100;
        const remaining = config.openai.costLimit.daily - todayStats.totalCost;
        
        console.log(`  ${chalk.gray('Today\'s Usage:')} $${todayStats.totalCost.toFixed(4)} (${percentUsed.toFixed(1)}%)`);
        console.log(`  ${chalk.gray('Remaining Today:')} $${remaining.toFixed(4)}`);
        
        if (percentUsed > 80) {
          console.log(chalk.yellow('\n⚠️  Warning: Approaching daily cost limit!'));
        }
      }
    }
  }

  // Check for exported conversations with token data
  const exportDir = config.exportDir || './exports';
  if (await fs.pathExists(exportDir)) {
    const files = await fs.readdir(exportDir);
    const recentFiles = files
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 5);
    
    let filesWithTokens = 0;
    for (const file of recentFiles) {
      const content = await fs.readFile(path.join(exportDir, file), 'utf8');
      if (content.includes('Token Usage:')) {
        filesWithTokens++;
      }
    }
    
    if (filesWithTokens > 0) {
      console.log(chalk.gray(`\n${filesWithTokens} exported conversation(s) include token usage data.`));
    }
  }

  console.log();
}

// Clear usage statistics
export async function clearUsageStats() {
  globalUsageTracker.clear();
  console.log(chalk.green('✓ Usage statistics cleared.'));
}

// Export usage statistics to JSON
export async function exportUsageStats(outputPath) {
  const stats = globalUsageTracker.getAllStats();
  await fs.writeJson(outputPath, stats, { spaces: 2 });
  console.log(chalk.green(`✓ Usage statistics exported to: ${outputPath}`));
}