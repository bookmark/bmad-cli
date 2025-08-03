import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import chalk from 'chalk';

// Configure marked with terminal renderer
marked.setOptions({
  renderer: new TerminalRenderer({
    // Code block styling
    code: chalk.yellow,
    blockquote: chalk.gray.italic,
    html: chalk.gray,
    
    // Heading styles
    heading: chalk.cyan.bold,
    firstHeading: chalk.cyan.bold.underline,
    
    // List styling
    hr: chalk.gray('─'.repeat(40)),
    listitem: chalk.gray('•'),
    
    // Table styling
    table: chalk.gray,
    tablerow: chalk.gray,
    tablecell: chalk.gray,
    
    // Text styling
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow,
    del: chalk.strikethrough,
    
    // Link styling
    link: chalk.blue.underline,
    href: chalk.blue.underline,
    
    // Configure widths
    width: 80,
    reflowText: true,
    
    // Show link URLs
    showSectionPrefix: false,
    unescape: true
  })
});

// Render markdown to terminal-formatted text
export function renderMarkdown(text) {
  if (!text) return '';
  
  try {
    // Pre-process for better terminal display
    let processed = text;
    
    // Convert multi-line code blocks for better display
    processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const langLabel = lang ? chalk.gray(`[${lang}]`) + '\n' : '';
      return '\n' + langLabel + chalk.yellow(code.trim()) + '\n';
    });
    
    // Render with marked
    return marked(processed).trim();
  } catch (error) {
    // Fallback to plain text if markdown parsing fails
    return text;
  }
}

// Render markdown for file export (without terminal colors)
export function renderMarkdownPlain(text) {
  if (!text) return '';
  
  // Configure marked for plain text output
  const plainRenderer = new marked.Renderer();
  
  // Override renderers for plain text
  plainRenderer.heading = (text, level) => {
    const underline = level === 1 ? '=' : '-';
    return `\n${text}\n${underline.repeat(text.length)}\n`;
  };
  
  plainRenderer.list = (body, ordered) => {
    return body + '\n';
  };
  
  plainRenderer.listitem = (text) => {
    return `• ${text}\n`;
  };
  
  plainRenderer.paragraph = (text) => {
    return text + '\n\n';
  };
  
  plainRenderer.code = (code, lang) => {
    const langLabel = lang ? `[${lang}]\n` : '';
    return `\n\`\`\`${lang || ''}\n${code}\n\`\`\`\n\n`;
  };
  
  plainRenderer.codespan = (text) => {
    return `\`${text}\``;
  };
  
  plainRenderer.strong = (text) => {
    return `**${text}**`;
  };
  
  plainRenderer.em = (text) => {
    return `*${text}*`;
  };
  
  plainRenderer.link = (href, title, text) => {
    return `[${text}](${href})`;
  };
  
  plainRenderer.hr = () => {
    return '\n---\n\n';
  };
  
  try {
    return marked(text, { renderer: plainRenderer }).trim();
  } catch (error) {
    return text;
  }
}

// Format conversation for display
export function formatConversation(conversation) {
  let formatted = '';
  
  for (const message of conversation) {
    if (message.role === 'user') {
      formatted += chalk.blue('\nYou: ') + message.content + '\n';
    } else if (message.role === 'agent') {
      formatted += chalk.green(`\n${message.name}: `) + renderMarkdown(message.content) + '\n';
    }
  }
  
  return formatted;
}

// Create a styled box for important messages
export function createBox(content, title = '') {
  const width = 60;
  const horizontal = '─'.repeat(width - 2);
  
  let box = chalk.cyan('┌' + horizontal + '┐\n');
  
  if (title) {
    const titlePadding = Math.floor((width - title.length - 2) / 2);
    box += chalk.cyan('│') + ' '.repeat(titlePadding) + chalk.cyan.bold(title) + 
           ' '.repeat(width - titlePadding - title.length - 2) + chalk.cyan('│\n');
    box += chalk.cyan('├' + horizontal + '┤\n');
  }
  
  // Split content into lines
  const lines = content.split('\n');
  for (const line of lines) {
    const truncated = line.length > width - 4 ? line.substring(0, width - 7) + '...' : line;
    const padding = width - truncated.length - 2;
    box += chalk.cyan('│') + ' ' + truncated + ' '.repeat(padding - 1) + chalk.cyan('│\n');
  }
  
  box += chalk.cyan('└' + horizontal + '┘');
  
  return box;
}