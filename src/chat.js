import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import { loadAgents, findAgent, getAgentContent } from './agent-loader.js';
import { renderMarkdown } from './markdown-renderer.js';
import { saveConversation } from './export.js';
import { 
  initializeOpenAI, 
  buildSystemPrompt, 
  getOpenAIResponse, 
  calculateCost,
  formatCostDisplay,
  checkCostLimits 
} from './openai-service.js';
import { globalUsageTracker } from './token-counter.js';

// Start chat session
export async function startChat(config, agentQuery = null) {
  let agent;
  let conversation = [];
  let sessionCost = 0;
  const conversationId = Date.now().toString();
  
  // Initialize OpenAI if configured
  const useOpenAI = initializeOpenAI(config);
  
  // Check if running in pipe mode
  const isPiped = !process.stdin.isTTY;
  
  // Load or select agent
  if (agentQuery) {
    agent = await findAgent(config, agentQuery);
    if (!agent) {
      console.error(chalk.red(`Agent '${agentQuery}' not found`));
      return;
    }
  } else if (!isPiped) {
    agent = await selectAgent(config);
    if (!agent) return;
  } else {
    console.error(chalk.red('Please specify an agent when using pipes'));
    return;
  }

  // Load agent content
  const agentContent = await getAgentContent(config, agent);
  
  // Display agent introduction
  console.clear();
  console.log(chalk.cyan('═'.repeat(60)));
  console.log(chalk.cyan.bold(`Chat with ${agent.name}`));
  console.log(chalk.gray(`Role: ${agent.role}`));
  if (useOpenAI) {
    console.log(chalk.gray(`Model: ${config.openai.model || 'gpt-4-turbo-preview'}`));
  }
  console.log(chalk.cyan('═'.repeat(60)));
  console.log();

  // Show initial greeting
  const greeting = getAgentGreeting(agent, agentContent);
  console.log(chalk.green(`${agent.name}:`), renderMarkdown(greeting));
  conversation.push({ role: 'agent', name: agent.name, content: greeting });

  // Handle piped input
  if (isPiped) {
    const stdin = process.stdin;
    let inputData = '';
    
    stdin.on('data', (chunk) => {
      inputData += chunk;
    });
    
    stdin.on('end', async () => {
      const input = inputData.trim();
      if (input) {
        conversation.push({ role: 'user', content: input });
        
        // Get response
        const response = await getResponse(
          config, agent, agentContent, conversation, 
          useOpenAI, sessionCost, conversationId
        );
        
        console.log();
        console.log(chalk.green(`${agent.name}:`), renderMarkdown(response.content));
        conversation.push({ role: 'agent', name: agent.name, content: response.content });
        
        if (response.cost) {
          sessionCost = response.sessionCost;
        }
        
        // Auto-save in pipe mode
        if (config.autoSave !== false && conversation.length > 2) {
          const tokenUsage = useOpenAI ? globalUsageTracker.getConversationStats(conversationId) : null;
          const filename = await saveConversation(config, conversation, agent, null, tokenUsage);
          console.error(chalk.gray(`\nConversation saved to: ${filename}`));
        }
      }
    });
    
    return;
  }

  // Interactive chat loop
  let chatting = true;
  while (chatting) {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: chalk.blue('You:'),
        prefix: ''
      }
    ]);

    // Handle commands
    if (input.startsWith('/')) {
      const handled = await handleCommand(input, conversation, config, agent);
      if (handled === 'exit') {
        chatting = false;
        continue;
      }
    } else {
      // Add user message to conversation
      conversation.push({ role: 'user', content: input });

      // Get response
      const response = await getResponse(
        config, agent, agentContent, conversation, 
        useOpenAI, sessionCost, conversationId
      );
      
      console.log();
      console.log(chalk.green(`${agent.name}:`), renderMarkdown(response.content));
      
      if (response.cost) {
        sessionCost = response.sessionCost;
        if (config.openai?.showCosts !== false) {
          console.log('\n' + response.costDisplay);
        }
      }
      
      console.log();
      
      conversation.push({ role: 'agent', name: agent.name, content: response.content });
    }
  }

  // Auto-save conversation on exit
  if (config.autoSave !== false && conversation.length > 2) {
    // Get token usage stats if OpenAI was used
    const tokenUsage = useOpenAI ? globalUsageTracker.getConversationStats(conversationId) : null;
    const filename = await saveConversation(config, conversation, agent, null, tokenUsage);
    console.log(chalk.gray(`\nConversation saved to: ${filename}`));
  }

  console.log(chalk.cyan('\nGoodbye! 👋\n'));
}

// Select agent interactively
async function selectAgent(config) {
  const agents = await loadAgents(config);
  
  if (agents.length === 0) {
    console.error(chalk.red('No agents found. Please check your configuration.'));
    return null;
  }

  // Group agents by pack
  const choices = [];
  const agentsByPack = {};
  
  for (const agent of agents) {
    if (!agentsByPack[agent.packName]) {
      agentsByPack[agent.packName] = [];
    }
    agentsByPack[agent.packName].push(agent);
  }

  // Create choices with separators
  for (const [packName, packAgents] of Object.entries(agentsByPack)) {
    choices.push(new inquirer.Separator(chalk.yellow(`── ${packName} ──`)));
    for (const agent of packAgents) {
      choices.push({
        name: `${agent.name} - ${chalk.gray(agent.role)}`,
        value: agent
      });
    }
  }

  const { agent } = await inquirer.prompt([
    {
      type: 'list',
      name: 'agent',
      message: 'Select an agent:',
      choices,
      pageSize: 15
    }
  ]);

  return agent;
}

// Get agent greeting
function getAgentGreeting(agent, content) {
  // Extract greeting from agent content or use default
  const greetingMatch = content.match(/## Example Interaction\s*```[^`]*You:[^`]*Agent: "([^"]+)"/);
  if (greetingMatch) {
    return greetingMatch[1];
  }

  // Default greeting based on role
  return `Hello! I'm ${agent.name}, your ${agent.role}. ${agent.activation || 'How can I help you today?'}`;
}

// Get response from OpenAI or simulate
async function getResponse(config, agent, agentContent, conversation, useOpenAI, currentSessionCost, conversationId) {
  const lastMessage = conversation[conversation.length - 1].content;
  
  if (useOpenAI) {
    try {
      // Check cost limits
      const limitCheck = checkCostLimits(config, 0, currentSessionCost);
      if (!limitCheck.allowed) {
        return {
          content: `I apologize, but I cannot continue this conversation. ${limitCheck.reason}`,
          cost: null,
          sessionCost: currentSessionCost
        };
      }

      // Build system prompt
      const systemPrompt = buildSystemPrompt(agent, agentContent);
      
      // Show loading spinner
      const spinner = ora({
        text: 'Thinking...',
        spinner: 'dots'
      }).start();
      
      // Get OpenAI response
      const response = await getOpenAIResponse(
        config,
        systemPrompt,
        conversation,
        config.openai?.streamResponse ? (token) => {
          spinner.stop();
          process.stdout.write(token);
        } : null
      );
      
      if (!config.openai?.streamResponse) {
        spinner.stop();
      }
      
      // Calculate cost
      const cost = calculateCost(response.usage, response.model);
      const newSessionCost = currentSessionCost + cost.totalCost;
      
      // Track usage
      globalUsageTracker.addUsage(conversationId, cost, cost);
      
      return {
        content: response.content,
        cost: cost,
        sessionCost: newSessionCost,
        costDisplay: formatCostDisplay(cost, newSessionCost)
      };
      
    } catch (error) {
      console.error(chalk.red('\nOpenAI Error:'), error.message);
      console.log(chalk.yellow('Falling back to simulated response...\n'));
      // Fall through to simulated response
    }
  }
  
  // Simulated response
  return {
    content: await getSimulatedResponse(agent, agentContent, lastMessage, conversation),
    cost: null,
    sessionCost: currentSessionCost
  };
}

// Simulate agent response (fallback when OpenAI is not available)
async function getSimulatedResponse(agent, content, input, conversation) {
  // Extract agent's expertise and style from content
  const expertiseMatch = content.match(/### Core Expertise\s*([^#]+)/);
  const expertise = expertiseMatch ? expertiseMatch[1].trim() : '';

  // For demo, provide contextual responses based on agent type
  if (agent.packName.includes('problem-solver')) {
    return `Let me analyze this systematically. ${input} appears to be a complex challenge that requires understanding the underlying system dynamics. 

I would approach this by:
1. **Identifying key components** - What are the main elements involved?
2. **Mapping relationships** - How do these components interact?
3. **Finding leverage points** - Where can we intervene most effectively?

Could you provide more context about the specific constraints or goals you're working with?`;
  } else if (agent.packName.includes('market-researcher')) {
    return `Based on my analysis of "${input}", here are my initial observations:

**Market Context**: This appears to relate to market dynamics that require deeper investigation.

**Key Areas to Explore**:
- Target audience characteristics
- Competitive landscape
- Market size and growth potential

What specific market aspects would you like me to focus on?`;
  } else if (agent.packName.includes('product-manager')) {
    return `From a product perspective, "${input}" raises important considerations:

**User Impact**: How does this affect our users' jobs-to-be-done?
**Strategic Alignment**: Does this align with our product vision?
**Prioritization**: Where does this fit in our roadmap?

Let's dig deeper into the user needs behind this request.`;
  }

  // Default response
  return `I understand you're asking about "${input}". As ${agent.name}, I bring expertise in ${agent.role}. Let me think about this from that perspective and provide you with actionable insights.

What specific aspect would you like me to focus on?`;
}

// Handle chat commands
async function handleCommand(input, conversation, config, agent) {
  const command = input.toLowerCase().trim();

  switch (command) {
    case '/exit':
    case '/quit':
      return 'exit';

    case '/export':
      const filename = await saveConversation(config, conversation, agent);
      console.log(chalk.green(`✓ Conversation exported to: ${filename}`));
      return true;

    case '/clear':
      console.clear();
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.cyan.bold(`Chat with ${agent.name}`));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log();
      return true;

    case '/help':
      console.log(chalk.yellow('\nAvailable commands:'));
      console.log('  /exit, /quit  - Exit the chat');
      console.log('  /export      - Export conversation to markdown');
      console.log('  /clear       - Clear the screen');
      console.log('  /help        - Show this help message');
      console.log();
      return true;

    default:
      console.log(chalk.red(`Unknown command: ${command}`));
      console.log(chalk.gray('Type /help for available commands'));
      return true;
  }
}