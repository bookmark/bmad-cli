import { encoding_for_model } from 'tiktoken';

// Cache for encodings to avoid recreating them
const encodingCache = {};

// Get encoding for a specific model
function getEncoding(model) {
  if (!encodingCache[model]) {
    try {
      // Try to get specific model encoding
      encodingCache[model] = encoding_for_model(model);
    } catch {
      // Fallback to cl100k_base encoding (used by GPT-4 and GPT-3.5-turbo)
      encodingCache[model] = encoding_for_model('gpt-4');
    }
  }
  return encodingCache[model];
}

// Count tokens in a text string
export function countTokens(text, model = 'gpt-4-turbo-preview') {
  if (!text) return 0;
  
  try {
    const encoding = getEncoding(model);
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (error) {
    // Fallback to estimation if tiktoken fails
    return estimateTokens(text);
  }
}

// Count tokens in messages array
export function countMessagesTokens(messages, model = 'gpt-4-turbo-preview') {
  let totalTokens = 0;
  
  // Each message has overhead tokens for formatting
  const messageOverhead = 4; // <|im_start|>role\n content<|im_end|>\n
  
  for (const message of messages) {
    totalTokens += messageOverhead;
    totalTokens += countTokens(message.role, model);
    totalTokens += countTokens(message.content, model);
  }
  
  // Add tokens for assistant reply prompt
  totalTokens += 2;
  
  return totalTokens;
}

// Estimate tokens when exact counting is not available
export function estimateTokens(text) {
  if (!text) return 0;
  
  // GPT models use roughly 1 token per 4 characters for English text
  // This is a rough approximation
  const charCount = text.length;
  const wordCount = text.split(/\s+/).length;
  
  // Use a weighted average of character and word-based estimates
  const charBasedEstimate = charCount / 4;
  const wordBasedEstimate = wordCount * 1.3;
  
  return Math.ceil((charBasedEstimate + wordBasedEstimate) / 2);
}

// Track token usage for a session
export class TokenUsageTracker {
  constructor() {
    this.conversations = new Map();
    this.dailyUsage = new Map();
  }

  // Add usage for a conversation
  addUsage(conversationId, usage, cost) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        messages: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        totalCost: 0
      });
    }

    const conv = this.conversations.get(conversationId);
    conv.messages += 1;
    conv.promptTokens += usage.promptTokens || 0;
    conv.completionTokens += usage.completionTokens || 0;
    conv.totalTokens += usage.totalTokens || 0;
    conv.totalCost += cost.totalCost || 0;

    // Update daily usage
    const today = new Date().toDateString();
    if (!this.dailyUsage.has(today)) {
      this.dailyUsage.set(today, {
        conversations: 0,
        totalTokens: 0,
        totalCost: 0
      });
    }

    const daily = this.dailyUsage.get(today);
    daily.totalTokens += usage.totalTokens || 0;
    daily.totalCost += cost.totalCost || 0;
  }

  // Get conversation statistics
  getConversationStats(conversationId) {
    return this.conversations.get(conversationId) || null;
  }

  // Get daily statistics
  getDailyStats(date = new Date()) {
    const dateStr = date.toDateString();
    return this.dailyUsage.get(dateStr) || null;
  }

  // Get all statistics
  getAllStats() {
    let total = {
      conversations: this.conversations.size,
      messages: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalCost: 0
    };

    for (const conv of this.conversations.values()) {
      total.messages += conv.messages;
      total.promptTokens += conv.promptTokens;
      total.completionTokens += conv.completionTokens;
      total.totalTokens += conv.totalTokens;
      total.totalCost += conv.totalCost;
    }

    return {
      total,
      conversations: Array.from(this.conversations.entries()),
      daily: Array.from(this.dailyUsage.entries())
    };
  }

  // Clear statistics
  clear() {
    this.conversations.clear();
    this.dailyUsage.clear();
  }
}

// Global tracker instance
export const globalUsageTracker = new TokenUsageTracker();

// Clean up encodings when done
export function cleanup() {
  for (const encoding of Object.values(encodingCache)) {
    if (encoding && typeof encoding.free === 'function') {
      encoding.free();
    }
  }
  encodingCache.clear();
}