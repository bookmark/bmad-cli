import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { renderMarkdownPlain } from './markdown-renderer.js';

// Save conversation to markdown file
export async function saveConversation(config, conversation, agent, filename = null, tokenUsage = null) {
  // Ensure export directory exists
  const exportDir = config.exportDir || './exports';
  await fs.ensureDir(exportDir);

  // Generate filename if not provided
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const agentName = agent ? agent.id : 'chat';
    filename = `${agentName}-${timestamp}.md`;
  }

  const filepath = path.join(exportDir, filename);

  // Create markdown content
  let content = `# Chat Conversation with ${agent ? agent.name : 'Agent'}\n\n`;
  content += `**Date**: ${new Date().toLocaleString()}\n`;
  content += `**Agent**: ${agent ? `${agent.name} (${agent.role})` : 'Unknown'}\n`;
  content += `**Pack**: ${agent ? agent.packName : 'Unknown'}\n`;
  
  // Add OpenAI info if used
  if (config.openai?.enabled) {
    content += `**Model**: ${config.openai.model || 'gpt-4-turbo-preview'}\n`;
  }
  
  // Add token usage if available
  if (tokenUsage) {
    content += `\n**Token Usage**:\n`;
    content += `- Total Tokens: ${tokenUsage.totalTokens.toLocaleString()}\n`;
    content += `- Prompt Tokens: ${tokenUsage.promptTokens.toLocaleString()}\n`;
    content += `- Completion Tokens: ${tokenUsage.completionTokens.toLocaleString()}\n`;
    content += `- Total Cost: $${tokenUsage.totalCost.toFixed(4)}\n`;
  }
  
  content += `\n---\n\n`;

  // Add conversation
  for (const message of conversation) {
    if (message.role === 'user') {
      content += `## You\n\n${message.content}\n\n`;
    } else if (message.role === 'agent') {
      content += `## ${message.name || 'Agent'}\n\n`;
      content += renderMarkdownPlain(message.content) + '\n\n';
    }
  }

  // Add footer
  content += `---\n\n`;
  content += `*Exported by BMAD CLI Demo*\n`;

  // Write file
  await fs.writeFile(filepath, content, 'utf8');

  return filepath;
}

// Export conversation command
export async function exportConversation(config, sessionFile) {
  const exportDir = config.exportDir || './exports';

  if (sessionFile) {
    // Export specific session
    const sessionPath = path.join(exportDir, sessionFile);
    
    if (!await fs.pathExists(sessionPath)) {
      console.error(chalk.red(`Session file not found: ${sessionFile}`));
      return;
    }

    console.log(chalk.green(`✓ Session already exported: ${sessionPath}`));
  } else {
    // List available sessions
    if (!await fs.pathExists(exportDir)) {
      console.log(chalk.yellow('No conversations exported yet.'));
      return;
    }

    const files = await fs.readdir(exportDir);
    const mdFiles = files.filter(f => f.endsWith('.md')).sort().reverse();

    if (mdFiles.length === 0) {
      console.log(chalk.yellow('No conversations found.'));
      return;
    }

    console.log(chalk.cyan('\n📄 Exported Conversations:\n'));
    
    for (const file of mdFiles) {
      const stats = await fs.stat(path.join(exportDir, file));
      const size = (stats.size / 1024).toFixed(1) + ' KB';
      const date = stats.mtime.toLocaleString();
      
      console.log(`  ${chalk.green(file)}`);
      console.log(`    ${chalk.gray(`${date} • ${size}`)}`);
    }

    console.log(chalk.gray(`\nTotal: ${mdFiles.length} conversations`));
    console.log(chalk.gray(`Location: ${path.resolve(exportDir)}`));
  }
}

// Load conversation from file
export async function loadConversation(filepath) {
  if (!await fs.pathExists(filepath)) {
    throw new Error(`Conversation file not found: ${filepath}`);
  }

  const content = await fs.readFile(filepath, 'utf8');
  const conversation = [];

  // Parse markdown back to conversation format
  const sections = content.split(/^## /m);
  
  for (const section of sections) {
    if (section.startsWith('You\n')) {
      const text = section.substring(4).trim();
      conversation.push({ role: 'user', content: text });
    } else if (section.includes('\n')) {
      const lines = section.split('\n');
      const name = lines[0].trim();
      const text = lines.slice(1).join('\n').trim();
      
      if (name && text) {
        conversation.push({ role: 'agent', name, content: text });
      }
    }
  }

  return conversation;
}

// Get latest conversation file
export async function getLatestConversation(config) {
  const exportDir = config.exportDir || './exports';
  
  if (!await fs.pathExists(exportDir)) {
    return null;
  }

  const files = await fs.readdir(exportDir);
  const mdFiles = files.filter(f => f.endsWith('.md')).sort().reverse();

  if (mdFiles.length === 0) {
    return null;
  }

  return path.join(exportDir, mdFiles[0]);
}