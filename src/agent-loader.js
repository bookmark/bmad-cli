import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';

// Load agents from BMAD-METHOD expansion packs
export async function loadAgents(config) {
  const agents = [];
  const bmadPath = path.resolve(config.bmadPath);
  const expansionPacksPath = path.join(bmadPath, 'expansion-packs');

  // Check if BMAD path exists
  if (!await fs.pathExists(expansionPacksPath)) {
    throw new Error(`BMAD expansion packs not found at: ${expansionPacksPath}`);
  }

  // Load agents from enabled packs
  for (const packName of config.enabledPacks) {
    const packPath = path.join(expansionPacksPath, `bmad-${packName}`);
    
    if (!await fs.pathExists(packPath)) {
      console.warn(chalk.yellow(`Warning: Pack '${packName}' not found`));
      continue;
    }

    // Load pack config
    const configPath = path.join(packPath, 'config.yaml');
    if (await fs.pathExists(configPath)) {
      const packConfig = yaml.load(await fs.readFile(configPath, 'utf8'));
      
      // Load agents
      const agentsPath = path.join(packPath, 'agents');
      if (await fs.pathExists(agentsPath)) {
        const agentFiles = await fs.readdir(agentsPath);
        
        for (const file of agentFiles) {
          if (file.endsWith('.md')) {
            const agentPath = path.join(agentsPath, file);
            const content = await fs.readFile(agentPath, 'utf8');
            
            // Extract agent metadata from markdown
            const agent = parseAgentFile(content, packName, file);
            if (agent) {
              agents.push(agent);
            }
          }
        }
      }
    }
  }

  return agents;
}

// Parse agent markdown file to extract metadata
function parseAgentFile(content, packName, filename) {
  const lines = content.split('\n');
  const agent = {
    packName,
    filename: filename.replace('.md', ''),
    fullPath: filename
  };

  // Look for YAML frontmatter or activation block
  let inYaml = false;
  let yamlContent = '';
  
  for (const line of lines) {
    if (line.includes('```yaml') && !inYaml) {
      inYaml = true;
      continue;
    }
    if (line.includes('```') && inYaml) {
      break;
    }
    if (inYaml) {
      yamlContent += line + '\n';
    }
    
    // Also try to extract from headers
    if (line.startsWith('# ')) {
      agent.title = line.substring(2).trim();
    }
  }

  // Parse YAML if found
  if (yamlContent) {
    try {
      const metadata = yaml.load(yamlContent);
      // Fix: ensure we get string values, not objects
      agent.id = typeof metadata.agent === 'string' ? metadata.agent : agent.filename;
      agent.name = metadata.name || agent.title || agent.filename;
      agent.role = metadata.role || 'Specialist';
      agent.activation = metadata.activation || '';
    } catch (e) {
      // Fallback to basic info
      agent.id = agent.filename;
      agent.name = agent.title || agent.filename;
      agent.role = 'Specialist';
    }
  } else {
    // No YAML found, use defaults
    agent.id = agent.filename;
    agent.name = agent.title || agent.filename;
    agent.role = 'Specialist';
  }

  // Extract persona section
  const personaMatch = content.match(/## Persona[^#]*/);
  if (personaMatch) {
    agent.persona = personaMatch[0].substring(10).trim();
  }

  return agent;
}

// List all available agents
export async function listAgents(config) {
  const agents = await loadAgents(config);
  
  console.log(chalk.cyan('\n📋 Available Agents:\n'));
  
  // Group by pack
  const agentsByPack = {};
  for (const agent of agents) {
    if (!agentsByPack[agent.packName]) {
      agentsByPack[agent.packName] = [];
    }
    agentsByPack[agent.packName].push(agent);
  }

  // Display by pack
  for (const [packName, packAgents] of Object.entries(agentsByPack)) {
    console.log(chalk.yellow(`📦 ${packName}:`));
    for (const agent of packAgents) {
      console.log(`  • ${chalk.green(agent.name)} - ${agent.role}`);
      console.log(`    ID: ${chalk.gray(agent.id)}`);
    }
    console.log();
  }

  console.log(chalk.gray(`Total agents: ${agents.length}`));
}

// Find agent by ID or name
export async function findAgent(config, query) {
  const agents = await loadAgents(config);
  
  // Try exact ID match first
  let agent = agents.find(a => a.id === query);
  
  // Try name match
  if (!agent) {
    agent = agents.find(a => a.name.toLowerCase().includes(query.toLowerCase()));
  }
  
  // Try filename match
  if (!agent) {
    agent = agents.find(a => a.filename === query);
  }

  return agent;
}

// Get agent content
export async function getAgentContent(config, agent) {
  const bmadPath = path.resolve(config.bmadPath);
  const agentPath = path.join(
    bmadPath, 
    'expansion-packs', 
    `bmad-${agent.packName}`, 
    'agents', 
    agent.fullPath
  );
  
  return await fs.readFile(agentPath, 'utf8');
}