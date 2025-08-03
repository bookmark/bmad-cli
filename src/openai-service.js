import OpenAI from 'openai';
import chalk from 'chalk';
import ora from 'ora';

// Model pricing (as of 2024)
const MODEL_PRICING = {
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 }, // per 1K tokens
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-16k': { input: 0.001, output: 0.002 }
};

// Initialize OpenAI client
let openaiClient = null;

export function initializeOpenAI(config) {
  if (!config.openai?.enabled) {
    return false;
  }

  if (!config.openai.apiKey) {
    throw new Error('OpenAI API key not configured. Run "bmad-cli config" to set it up.');
  }

  openaiClient = new OpenAI({
    apiKey: config.openai.apiKey
  });

  return true;
}

// Get agent system prompt
export function buildSystemPrompt(agent, agentContent) {
  return `You are ${agent.name}, ${agent.role}.

${agentContent}

Important instructions:
- Maintain the personality and expertise described above
- Use the frameworks and methodologies mentioned when relevant
- Speak in first person as ${agent.name}
- Be helpful, professional, and true to the character
- Apply your specialized knowledge to the user's questions`;
}

// Build messages array with full conversation history
export function buildMessages(systemPrompt, conversation) {
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  for (const msg of conversation) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'agent') {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }

  return messages;
}

// Calculate token usage and cost
export function calculateCost(usage, model) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4-turbo-preview'];
  
  const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
  const outputCost = (usage.completion_tokens / 1000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    inputCost,
    outputCost,
    totalCost
  };
}

// Get response from OpenAI (non-streaming)
export async function getOpenAIResponse(config, systemPrompt, conversation, onToken) {
  if (!openaiClient) {
    throw new Error('OpenAI not initialized');
  }

  const messages = buildMessages(systemPrompt, conversation);
  const model = config.openai.model || 'gpt-4-turbo-preview';
  const maxTokens = config.openai.maxTokens || 2000;
  const temperature = config.openai.temperature || 0.7;

  try {
    if (config.openai.streamResponse !== false) {
      // Streaming response
      const stream = await openaiClient.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true
      });

      let fullResponse = '';
      let chunkCount = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          if (onToken) {
            onToken(content);
          }
        }
        chunkCount++;
      }

      // For streaming, we need to make another call to get usage data
      // This is a limitation of the streaming API
      const usageResponse = await openaiClient.chat.completions.create({
        model,
        messages: [...messages, { role: 'assistant', content: fullResponse }],
        max_tokens: 1,
        temperature: 0
      });

      const promptTokens = messages.reduce((acc, m) => acc + estimateTokens(m.content), 0);
      const completionTokens = estimateTokens(fullResponse);
      
      return {
        content: fullResponse,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens
        },
        model
      };

    } else {
      // Non-streaming response
      const response = await openaiClient.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      });

      return {
        content: response.choices[0].message.content,
        usage: response.usage,
        model: response.model
      };
    }
  } catch (error) {
    handleOpenAIError(error);
  }
}

// Estimate tokens (rough approximation when exact count not available)
function estimateTokens(text) {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

// Handle OpenAI API errors
function handleOpenAIError(error) {
  if (error.code === 'invalid_api_key') {
    throw new Error('Invalid OpenAI API key. Please check your configuration.');
  } else if (error.code === 'insufficient_quota') {
    throw new Error('OpenAI API quota exceeded. Please check your billing.');
  } else if (error.code === 'rate_limit_exceeded') {
    throw new Error('Rate limit exceeded. Please try again in a moment.');
  } else if (error.code === 'model_not_found') {
    throw new Error(`Model not found: ${error.message}`);
  } else if (error.message?.includes('network')) {
    throw new Error('Network error. Please check your internet connection.');
  } else {
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

// Format cost display
export function formatCostDisplay(costInfo, sessionTotal = 0) {
  const lines = [
    chalk.gray('─'.repeat(50)),
    chalk.cyan('Tokens: ') + 
      `${costInfo.totalTokens.toLocaleString()} ` +
      chalk.gray(`(prompt: ${costInfo.promptTokens.toLocaleString()} + response: ${costInfo.completionTokens.toLocaleString()})`),
    chalk.cyan('Cost: ') + 
      chalk.yellow(`$${costInfo.totalCost.toFixed(4)}`) +
      (sessionTotal > 0 ? chalk.gray(` (Session total: $${sessionTotal.toFixed(4)})`) : ''),
    chalk.gray('─'.repeat(50))
  ];

  return lines.join('\n');
}

// Check if we're within cost limits
export function checkCostLimits(config, currentCost, sessionCost) {
  const limits = config.openai?.costLimit;
  if (!limits) return { allowed: true };

  if (limits.perConversation && sessionCost > limits.perConversation) {
    return {
      allowed: false,
      reason: `Conversation cost limit reached ($${limits.perConversation})`
    };
  }

  // TODO: Implement daily limit tracking (would need persistent storage)

  return { allowed: true };
}

// Get available models
export function getAvailableModels() {
  return Object.keys(MODEL_PRICING);
}

// Validate API key by making a test request
export async function validateAPIKey(apiKey) {
  try {
    const testClient = new OpenAI({ apiKey });
    await testClient.models.list();
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error.message || 'Invalid API key'
    };
  }
}