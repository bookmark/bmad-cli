import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.bmadrc');

// Run configuration wizard
export async function runConfigWizard() {
  console.log(chalk.cyan.bold('\n🚀 BMAD CLI Configuration Wizard\n'));

  // Check for existing config
  let existingConfig = {};
  if (await fs.pathExists(CONFIG_PATH)) {
    existingConfig = await fs.readJson(CONFIG_PATH);
    console.log(chalk.yellow('Existing configuration found. Your answers will update it.\n'));
  }

  // Ask configuration questions
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'bmadPath',
      message: 'Enter path to BMAD-METHOD folder:',
      default: existingConfig.bmadPath || '../BMAD-METHOD',
      validate: async (input) => {
        const expandedPath = path.resolve(input);
        const expansionPacksPath = path.join(expandedPath, 'expansion-packs');
        
        if (!await fs.pathExists(expandedPath)) {
          return `Path does not exist: ${expandedPath}`;
        }
        
        if (!await fs.pathExists(expansionPacksPath)) {
          return `Not a valid BMAD-METHOD installation (missing expansion-packs): ${expandedPath}`;
        }
        
        return true;
      }
    },
    {
      type: 'checkbox',
      name: 'enabledPacks',
      message: 'Which expansion packs do you want to enable?',
      choices: async (answers) => {
        const bmadPath = path.resolve(answers.bmadPath);
        const expansionPacksPath = path.join(bmadPath, 'expansion-packs');
        
        try {
          const dirs = await fs.readdir(expansionPacksPath);
          const packs = [];
          
          for (const dir of dirs) {
            if (dir.startsWith('bmad-')) {
              const packName = dir.substring(5); // Remove 'bmad-' prefix
              const packPath = path.join(expansionPacksPath, dir);
              
              // Check if it's a valid pack
              if (await fs.pathExists(path.join(packPath, 'config.yaml'))) {
                packs.push({
                  name: packName,
                  value: packName,
                  checked: existingConfig.enabledPacks?.includes(packName) || false
                });
              }
            }
          }
          
          return packs;
        } catch (error) {
          console.error(chalk.red('Error reading expansion packs:', error.message));
          return [];
        }
      },
      validate: (answer) => {
        if (answer.length < 1) {
          return 'You must choose at least one expansion pack.';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'exportDir',
      message: 'Where should conversations be exported?',
      default: existingConfig.exportDir || './exports'
    },
    {
      type: 'confirm',
      name: 'autoSave',
      message: 'Auto-save conversations on exit?',
      default: existingConfig.autoSave !== false
    },
    {
      type: 'confirm',
      name: 'enableOpenAI',
      message: 'Enable OpenAI integration for real AI responses?',
      default: existingConfig.openai?.enabled || false
    }
  ]);

  // OpenAI configuration if enabled
  let openaiConfig = {};
  if (answers.enableOpenAI) {
    const openaiAnswers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your OpenAI API key:',
        mask: '*',
        default: existingConfig.openai?.apiKey,
        validate: (input) => {
          if (!input) return 'API key is required for OpenAI integration';
          if (!input.startsWith('sk-')) return 'Invalid API key format';
          return true;
        }
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select default OpenAI model:',
        choices: [
          { name: 'GPT-4 Turbo (Recommended)', value: 'gpt-4-turbo-preview' },
          { name: 'GPT-4', value: 'gpt-4' },
          { name: 'GPT-3.5 Turbo (Fast & Cheap)', value: 'gpt-3.5-turbo' },
          { name: 'GPT-3.5 Turbo 16K', value: 'gpt-3.5-turbo-16k' }
        ],
        default: existingConfig.openai?.model || 'gpt-4-turbo-preview'
      },
      {
        type: 'number',
        name: 'maxTokens',
        message: 'Maximum response tokens:',
        default: existingConfig.openai?.maxTokens || 2000,
        validate: (input) => {
          if (input < 100 || input > 4000) return 'Please enter a value between 100 and 4000';
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'streamResponse',
        message: 'Enable streaming responses?',
        default: existingConfig.openai?.streamResponse !== false
      },
      {
        type: 'confirm',
        name: 'showCosts',
        message: 'Show token usage and costs?',
        default: existingConfig.openai?.showCosts !== false
      }
    ]);

    openaiConfig = {
      enabled: true,
      apiKey: openaiAnswers.apiKey,
      model: openaiAnswers.model,
      maxTokens: openaiAnswers.maxTokens,
      temperature: 0.7,
      streamResponse: openaiAnswers.streamResponse,
      showCosts: openaiAnswers.showCosts
    };

    // Cost limits
    const costLimitAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableCostLimits',
        message: 'Set cost limits?',
        default: false
      }
    ]);

    if (costLimitAnswer.enableCostLimits) {
      const limitAnswers = await inquirer.prompt([
        {
          type: 'number',
          name: 'perConversation',
          message: 'Maximum cost per conversation ($):',
          default: 1.00,
          validate: (input) => input > 0 ? true : 'Must be greater than 0'
        },
        {
          type: 'number',
          name: 'daily',
          message: 'Maximum daily cost ($):',
          default: 10.00,
          validate: (input) => input > 0 ? true : 'Must be greater than 0'
        }
      ]);

      openaiConfig.costLimit = limitAnswers;
    }
  }

  // Create configuration object
  const config = {
    bmadPath: answers.bmadPath,
    enabledPacks: answers.enabledPacks,
    exportDir: answers.exportDir,
    autoSave: answers.autoSave,
    version: '1.0.0'
  };

  // Add OpenAI config if enabled
  if (answers.enableOpenAI) {
    config.openai = openaiConfig;
  }

  // Save configuration
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });

  // Create export directory if it doesn't exist
  await fs.ensureDir(path.resolve(config.exportDir));

  // Display summary
  console.log(chalk.green('\n✓ Configuration saved successfully!\n'));
  console.log(chalk.cyan('Summary:'));
  console.log(`  BMAD Path: ${chalk.gray(path.resolve(config.bmadPath))}`);
  console.log(`  Enabled Packs: ${chalk.gray(config.enabledPacks.join(', '))}`);
  console.log(`  Export Directory: ${chalk.gray(path.resolve(config.exportDir))}`);
  console.log(`  Auto-save: ${chalk.gray(config.autoSave ? 'Yes' : 'No')}`);
  
  if (config.openai?.enabled) {
    console.log(chalk.cyan('\nOpenAI Settings:'));
    console.log(`  Model: ${chalk.gray(config.openai.model)}`);
    console.log(`  Max Tokens: ${chalk.gray(config.openai.maxTokens)}`);
    console.log(`  Streaming: ${chalk.gray(config.openai.streamResponse ? 'Yes' : 'No')}`);
    console.log(`  Show Costs: ${chalk.gray(config.openai.showCosts ? 'Yes' : 'No')}`);
    if (config.openai.costLimit) {
      console.log(`  Cost Limits: ${chalk.gray(`$${config.openai.costLimit.perConversation}/conv, $${config.openai.costLimit.daily}/day`)}`);
    }
  }
  
  console.log();
  console.log(chalk.gray(`Configuration file: ${CONFIG_PATH}`));
  console.log();

  return config;
}

// Load configuration
export async function loadConfig() {
  if (!await fs.pathExists(CONFIG_PATH)) {
    return null;
  }
  
  return await fs.readJson(CONFIG_PATH);
}

// Validate configuration
export async function validateConfig(config) {
  if (!config) {
    return { valid: false, error: 'No configuration found' };
  }

  // Check BMAD path
  const bmadPath = path.resolve(config.bmadPath);
  if (!await fs.pathExists(bmadPath)) {
    return { valid: false, error: `BMAD path not found: ${bmadPath}` };
  }

  // Check expansion packs
  const expansionPacksPath = path.join(bmadPath, 'expansion-packs');
  if (!await fs.pathExists(expansionPacksPath)) {
    return { valid: false, error: `Expansion packs not found: ${expansionPacksPath}` };
  }

  // Check enabled packs
  if (!config.enabledPacks || config.enabledPacks.length === 0) {
    return { valid: false, error: 'No expansion packs enabled' };
  }

  return { valid: true };
}

// Reset configuration
export async function resetConfig() {
  if (await fs.pathExists(CONFIG_PATH)) {
    await fs.remove(CONFIG_PATH);
    console.log(chalk.yellow('Configuration reset. Run the wizard again to set up.'));
  } else {
    console.log(chalk.gray('No configuration to reset.'));
  }
}