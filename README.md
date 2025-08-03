# BMAD CLI Demo

A simple command-line interface for interacting with BMAD-METHOD agents. This demo provides a chat-based interface to communicate with various business strategy and problem-solving agents.

## Features

- 💬 **Interactive Chat** - Have conversations with BMAD agents
- 🎯 **Smart Agent Selection** - Browse and select agents by category
- 📝 **Markdown Support** - Beautiful markdown rendering in terminal
- 💾 **Export Conversations** - Save chats as markdown files
- 🔧 **Easy Configuration** - Interactive setup wizard
- 🔗 **Agent Piping** - Chain agents together for complex workflows
- 🤖 **OpenAI Integration** - Get real AI responses powered by GPT-4
- 📊 **Token Usage Tracking** - Monitor usage and costs
- 💸 **Cost Controls** - Set limits per conversation and daily

## Installation

```bash
# Clone the cli-demo repository
git clone [repository-url] cli-demo
cd cli-demo

# Install dependencies
npm install

# Make CLI executable
chmod +x index.js
```

### OpenAI Setup (Optional)

To enable real AI responses:

1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Run `bmad-cli config` and choose to enable OpenAI
3. Enter your API key when prompted
4. Select your preferred model (GPT-4 Turbo recommended)

## Quick Start

```bash
# Run the CLI (first time will trigger setup wizard)
node index.js

# Or use npm start
npm start
```

## Usage

### Basic Commands

```bash
# Start interactive chat (shows agent selector)
bmad-cli

# Chat with specific agent
bmad-cli chat systems-thinker

# List all available agents
bmad-cli list

# Export conversations
bmad-cli export

# Reconfigure settings
bmad-cli config

# Show token usage statistics
bmad-cli usage

# Show detailed usage breakdown
bmad-cli usage --detailed

# Show only today's usage
bmad-cli usage --today
```

### Chat Commands

During a chat session, you can use these commands:

- `/exit` or `/quit` - Exit the chat
- `/export` - Export current conversation
- `/clear` - Clear the screen
- `/help` - Show available commands

### Agent Piping

You can pipe output between agents for complex workflows:

```bash
# Analyze a problem and get solution
echo "Customer retention is declining" | bmad-cli chat systems-thinker | bmad-cli chat product-lead

# Save the output
echo "Market analysis needed for fintech" | bmad-cli chat market-research-lead > analysis.md
```

## Configuration

The CLI stores configuration in `~/.bmadrc`:

```json
{
  "bmadPath": "../BMAD-METHOD",
  "enabledPacks": ["problem-solver", "market-researcher", "product-manager"],
  "exportDir": "./exports",
  "autoSave": true,
  "openai": {
    "enabled": true,
    "apiKey": "sk-...",
    "model": "gpt-4-turbo-preview",
    "maxTokens": 2000,
    "temperature": 0.7,
    "streamResponse": true,
    "showCosts": true,
    "costLimit": {
      "perConversation": 1.00,
      "daily": 10.00
    }
  }
}
```

### Configuration Options

- **bmadPath**: Path to your BMAD-METHOD installation
- **enabledPacks**: List of expansion packs to load agents from
- **exportDir**: Directory where conversations are saved
- **autoSave**: Automatically save conversations on exit

### OpenAI Configuration

- **enabled**: Enable/disable OpenAI integration
- **apiKey**: Your OpenAI API key (get one at https://platform.openai.com)
- **model**: AI model to use (gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo)
- **maxTokens**: Maximum response length in tokens
- **temperature**: Response creativity (0-1, higher = more creative)
- **streamResponse**: Show responses as they're generated
- **showCosts**: Display token usage and costs after each response
- **costLimit**: Set spending limits per conversation and daily

## Available Agents

The available agents depend on which expansion packs you have enabled:

### Problem Solver Pack
- Dr. Sarah Chen - Systems Thinking Expert
- Marcus Williams - First Principles Thinker
- Lisa Park - Critical Analysis Expert
- And more...

### Market Researcher Pack
- Maya Patel - Market Research Lead
- James Wilson - Consumer Insights Specialist
- Rachel Green - Competitive Intelligence Analyst
- And more...

### Product Manager Pack
- Alex Rivera - Product Management Expert
- Sam Kim - Product Analyst
- Jordan Lee - Product Strategist
- And more...

## Export Format

Conversations are exported as markdown files with metadata:

```markdown
# Chat Conversation with Dr. Sarah Chen

**Date**: 2024-01-15 10:30:00
**Agent**: Dr. Sarah Chen (Systems Thinking Expert)
**Pack**: problem-solver
**Model**: gpt-4-turbo-preview

**Token Usage**:
- Total Tokens: 2,543
- Prompt Tokens: 1,832
- Completion Tokens: 711
- Total Cost: $0.0465

---

## You

I have a customer retention problem...

## Dr. Sarah Chen

Let me analyze this systematically...
```

## Requirements

- Node.js 18.0.0 or higher
- BMAD-METHOD installation with expansion packs
- Terminal with UTF-8 support for best markdown rendering

## Project Structure

```
cli-demo/
├── index.js                 # Main CLI entry point
├── src/
│   ├── chat.js             # Chat interface logic
│   ├── agent-loader.js     # Loads agents from BMAD
│   ├── markdown-renderer.js # Terminal markdown rendering
│   ├── export.js           # Export functionality
│   ├── config-wizard.js    # Configuration wizard
│   ├── openai-service.js   # OpenAI API integration
│   ├── token-counter.js    # Token counting and tracking
│   └── usage-stats.js      # Usage statistics display
├── package.json
└── README.md
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Install globally for system-wide usage
npm link
```

## Troubleshooting

### "BMAD path not found"
Make sure your BMAD-METHOD installation path is correct in the configuration.

### "No agents found"
Check that you have enabled at least one expansion pack and that it contains agent files.

### "Command not found"
Make sure you've made the index.js file executable: `chmod +x index.js`

### "Invalid OpenAI API key"
1. Verify your API key at https://platform.openai.com/api-keys
2. Make sure it starts with `sk-`
3. Check that your account has credits

### "Rate limit exceeded"
OpenAI has rate limits. Wait a moment and try again, or upgrade your OpenAI plan.

### High token costs
- Use shorter conversations
- Set cost limits in configuration
- Consider using GPT-3.5 Turbo for cheaper responses
- Monitor usage with `bmad-cli usage`

## License

MIT

## Contributing

This is a demo project showing how to build a CLI interface for BMAD-METHOD. Feel free to fork and extend!