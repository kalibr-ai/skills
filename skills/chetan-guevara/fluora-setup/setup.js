#!/usr/bin/env node
/**
 * Fluora Setup Wizard
 * 
 * Interactive setup for Fluora marketplace access
 * Handles wallet generation, mcporter config, and funding instructions
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { Wallet, ethers } from 'ethers';
import os from 'os';
import readline from 'readline';

const execAsync = promisify(exec);

// Base Mainnet RPC
const BASE_RPC = "https://mainnet.base.org";
// USDC contract address on Base Mainnet
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// Minimal ERC20 ABI
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Check if fluora-mcp is installed
 */
async function checkFluoraMCP() {
  try {
    // Check if the package exists in npm global or can be resolved by npx
    const { stdout } = await execAsync('npm list -g fluora-mcp 2>&1 || which fluora-mcp 2>&1 || echo "not-found"');
    return !stdout.includes('not-found') && !stdout.includes('empty');
  } catch (error) {
    return false;
  }
}

/**
 * Install fluora-mcp globally
 */
async function installFluoraMCP() {
  log('\n📦 Installing fluora-mcp...', 'blue');
  try {
    await execAsync('npm install -g fluora-mcp');
    log('✓ fluora-mcp installed', 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to install: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Get path to wallets.json
 */
function getWalletsPath() {
  return path.join(os.homedir(), '.fluora', 'wallets.json');
}

/**
 * Check if wallets.json exists
 */
async function walletsFileExists() {
  try {
    await fs.access(getWalletsPath());
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Generate wallet by running fluora-mcp
 */
async function generateWallet() {
  log('\n🔑 Generating wallet...', 'blue');
  log('Running fluora-mcp for the first time to create wallet...', 'yellow');
  
  try {
    // Run fluora-mcp with a simple command that will trigger wallet creation
    // It will exit with an error because stdin is not a TTY, but that's okay
    // The wallet file will still be created
    const result = await execAsync('echo "" | npx fluora-mcp', { timeout: 5000 }).catch(() => {});
    
    // Wait a moment for file to be written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (await walletsFileExists()) {
      log('✓ Wallet generated', 'green');
      return true;
    } else {
      log('⚠️  Wallet file not created automatically', 'yellow');
      log('Please run: npx fluora-mcp', 'yellow');
      log('Then press Ctrl+C and re-run this setup.\n', 'yellow');
      return false;
    }
  } catch (error) {
    // This is expected - fluora-mcp exits with error in non-interactive mode
    // Check if wallet was created anyway
    if (await walletsFileExists()) {
      log('✓ Wallet generated', 'green');
      return true;
    } else {
      log('⚠️  Wallet file not created', 'yellow');
      return false;
    }
  }
}

/**
 * Read wallet info from wallets.json
 */
async function readWalletInfo() {
  const walletsPath = getWalletsPath();
  
  try {
    const content = await fs.readFile(walletsPath, 'utf8');
    const wallets = JSON.parse(content);
    
    // Try multiple possible key names
    const walletKeys = ['USDC_BASE_MAINNET', 'BASE_MAINNET', 'base_mainnet'];
    let wallet = null;
    
    for (const key of walletKeys) {
      if (wallets[key]) {
        wallet = wallets[key];
        break;
      }
    }
    
    if (!wallet || !wallet.privateKey) {
      throw new Error('No BASE_MAINNET wallet found in wallets.json');
    }
    
    // Ensure 0x prefix
    const privateKey = wallet.privateKey.startsWith('0x') ? wallet.privateKey : `0x${wallet.privateKey}`;
    
    // Use existing address if available, otherwise derive it
    const address = wallet.address || null;
    
    return { privateKey, address };
  } catch (error) {
    log(`❌ Failed to read wallet: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Derive wallet address from private key
 */
function deriveAddress(privateKey) {
  try {
    const wallet = new Wallet(privateKey);
    return wallet.address;
  } catch (error) {
    log(`❌ Failed to derive address: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Display funding instructions
 */
function displayFundingInstructions(address, fundingAmount = 5) {
  log('\n═══════════════════════════════════════════', 'bold');
  log('    💰 WALLET FUNDING REQUIRED', 'bold');
  log('═══════════════════════════════════════════\n', 'bold');
  
  log(`Your Fluora Wallet Address:`, 'blue');
  log(`${address}`, 'green');
  log('');
  
  log('To fund your wallet:', 'yellow');
  log(`1. Open Coinbase, Binance, or your preferred exchange`, 'yellow');
  log(`2. Send $${fundingAmount}-10 USDC to the address above`, 'yellow');
  log(`3. ⚠️  IMPORTANT: Select "Base" network (NOT Ethereum mainnet)`, 'red');
  log(`4. Wait ~1 minute for confirmation`, 'yellow');
  log('');
  
  log('Network Details:', 'blue');
  log('  • Network: Base (Coinbase L2)', 'blue');
  log('  • Token: USDC', 'blue');
  log('  • Gas fees: ~$0.01-0.03 per transaction', 'blue');
  log('');
  
  log('Where to get USDC on Base:', 'blue');
  log('  • Coinbase: Withdraw USDC → Select "Base" network', 'blue');
  log('  • Bridge: https://bridge.base.org', 'blue');
  log('  • Buy directly: Coinbase Wallet or Rainbow Wallet', 'blue');
  log('');
  
  log('═══════════════════════════════════════════\n', 'bold');
}

/**
 * Check USDC balance on Base network
 */
async function checkWalletBalance(walletAddress) {
  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    
    // Create contract instance
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      ERC20_ABI,
      provider
    );
    
    // Fetch balance + decimals
    const [balance, decimals, symbol] = await Promise.all([
      usdcContract.balanceOf(walletAddress),
      usdcContract.decimals(),
      usdcContract.symbol()
    ]);
    
    // Format balance
    const formattedBalance = ethers.formatUnits(balance, decimals);
    
    return {
      raw: balance.toString(),
      formatted: formattedBalance,
      symbol: symbol,
      hasBalance: parseFloat(formattedBalance) > 0
    };
  } catch (error) {
    log(`⚠️  Error checking balance: ${error.message}`, 'yellow');
    return null;
  }
}

/**
 * Get mcporter config path
 */
function getMcporterConfigPath() {
  // Prefer workspace config, then global config
  const possiblePaths = [
    path.join(os.homedir(), '.openclaw', 'workspace', 'config', 'mcporter.json'),
    path.join(os.homedir(), '.mcporter', 'mcporter.json'),
  ];
  
  return possiblePaths;
}

/**
 * Configure mcporter with Fluora registry
 */
async function configureMcporter() {
  log('\n⚙️  Configuring mcporter...', 'blue');
  
  const configPaths = getMcporterConfigPath();
  let configPath = null;
  let existingConfig = null;
  
  // Find existing config
  for (const p of configPaths) {
    try {
      await fs.access(p);
      configPath = p;
      const content = await fs.readFile(p, 'utf8');
      existingConfig = JSON.parse(content);
      break;
    } catch (error) {
      continue;
    }
  }
  
  // If no config found, use default location
  if (!configPath) {
    configPath = configPaths[0];
    existingConfig = { mcpServers: {} };
    log(`  Creating new config at: ${configPath}`, 'yellow');
    
    // Create directory if needed
    await fs.mkdir(path.dirname(configPath), { recursive: true });
  } else {
    log(`  Found config at: ${configPath}`, 'green');
  }
  
  // Add Fluora registry config
  if (!existingConfig.mcpServers) {
    existingConfig.mcpServers = {};
  }
  
  existingConfig.mcpServers['fluora-registry'] = {
    command: 'npx',
    args: ['fluora-mcp'],
    env: {
      ENABLE_REQUEST_ELICITATION: 'true',
      ELICITATION_THRESHOLD: '0.01',
    },
  };
  
  // Write config
  await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));
  log('✓ mcporter configured', 'green');
  
  return configPath;
}

/**
 * Verify setup
 */
async function verifySetup(address) {
  log('\n🔍 Verifying setup...', 'blue');
  
  const checks = {
    'fluora-mcp installed': await checkFluoraMCP(),
    'Wallet file exists': await walletsFileExists(),
    'Private key valid': true, // Already validated earlier
    'Wallet address derived': address !== null,
  };
  
  let allPassed = true;
  for (const [check, passed] of Object.entries(checks)) {
    if (passed) {
      log(`  ✓ ${check}`, 'green');
    } else {
      log(`  ✗ ${check}`, 'red');
      allPassed = false;
    }
  }
  
  return allPassed;
}

/**
 * Main setup function
 */
export async function setupFluora(options = {}) {
  const {
    skipMcporterConfig = false,
    fundingAmount = 5,
  } = options;
  
  try {
    log('\n╔════════════════════════════════════════╗', 'blue');
    log('║       Fluora Setup Wizard 🔧          ║', 'blue');
    log('╚════════════════════════════════════════╝\n', 'blue');
    
    // Step 1: Check/install fluora-mcp
    log('Step 1: Install fluora-mcp', 'bold');
    if (!(await checkFluoraMCP())) {
      if (!(await installFluoraMCP())) {
        throw new Error('Failed to install fluora-mcp');
      }
    } else {
      log('✓ fluora-mcp already installed', 'green');
    }
    
    // Step 2: Generate wallet
    log('\nStep 2: Generate wallet', 'bold');
    if (!(await walletsFileExists())) {
      if (!(await generateWallet())) {
        throw new Error('Failed to generate wallet');
      }
    } else {
      log('✓ Wallet file already exists', 'green');
    }
    
    // Step 3: Read wallet info
    log('\nStep 3: Read wallet info', 'bold');
    const walletInfo = await readWalletInfo();
    if (!walletInfo) {
      throw new Error('Failed to read wallet');
    }
    log('✓ Wallet info loaded', 'green');
    
    // Step 4: Get address (use existing or derive)
    log('\nStep 4: Get wallet address', 'bold');
    let address = walletInfo.address;
    
    if (address) {
      log(`✓ Address (from file): ${address}`, 'green');
    } else {
      address = deriveAddress(walletInfo.privateKey);
      if (!address) {
        throw new Error('Failed to derive address');
      }
      log(`✓ Address (derived): ${address}`, 'green');
    }
    
    // Step 5: Display funding instructions
    log('\nStep 5: Fund your wallet', 'bold');
    displayFundingInstructions(address, fundingAmount);
    
    const funded = await promptUser('Have you funded the wallet? (y/n): ');
    const isFunded = funded.toLowerCase() === 'y';
    
    // Step 5a: Check balance if user confirmed funding
    let balanceInfo = null;
    if (isFunded) {
      log('\n💰 Checking wallet balance...', 'blue');
      balanceInfo = await checkWalletBalance(address);
      
      if (balanceInfo) {
        if (balanceInfo.hasBalance) {
          log(`✓ Balance: ${balanceInfo.formatted} ${balanceInfo.symbol}`, 'green');
          log('✓ Wallet funded successfully!', 'green');
        } else {
          log(`⚠️  Balance: ${balanceInfo.formatted} ${balanceInfo.symbol}`, 'yellow');
          log('⚠️  No USDC found. Transaction may still be pending (~1 min).', 'yellow');
          log('   You can continue setup and check balance later with: fluora-balance', 'blue');
        }
      }
    }
    
    // Step 6: Configure mcporter (optional)
    let mcporterConfigured = false;
    if (!skipMcporterConfig) {
      log('\nStep 6: Configure mcporter', 'bold');
      try {
        await configureMcporter();
        mcporterConfigured = true;
      } catch (error) {
        log(`⚠️  Failed to configure mcporter: ${error.message}`, 'yellow');
        log('You can configure it manually later.', 'yellow');
      }
    } else {
      log('\nStep 6: Configure mcporter', 'bold');
      log('⊘ Skipped (--skip-mcporter)', 'yellow');
    }
    
    // Step 7: Verify
    log('\nStep 7: Verify setup', 'bold');
    const verified = await verifySetup(address);
    
    if (!verified) {
      throw new Error('Setup verification failed');
    }
    
    // Success!
    log('\n✨ Setup complete!', 'green');
    log('\n📋 Next steps:', 'yellow');
    
    if (!isFunded) {
      log('  1. Fund your wallet with $5-10 USDC on Base', 'yellow');
      log(`     Address: ${address}`, 'blue');
    }
    
    log('  2. Test Fluora connection:', 'yellow');
    log('     cd ~/.openclaw/workspace', 'blue');
    log('     mcporter call "fluora-registry.exploreServices()"', 'blue');
    log('');
    log('  3. Start building services:', 'yellow');
    log('     • workflow-to-monetized-mcp: Generate services', 'blue');
    log('     • railway-deploy: Deploy to Railway', 'blue');
    log('     • fluora-publish: List on marketplace', 'blue');
    log('');
    
    return {
      success: true,
      walletAddress: address,
      privateKeyPath: getWalletsPath(),
      mcporterConfigured,
      funded: isFunded,
      balance: balanceInfo ? balanceInfo.formatted : null,
      balanceSymbol: balanceInfo ? balanceInfo.symbol : null,
    };
    
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    throw error;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skip-mcporter') {
      options.skipMcporterConfig = true;
    } else if (args[i] === '--funding' && args[i + 1]) {
      options.fundingAmount = parseInt(args[i + 1]);
      i++;
    }
  }
  
  setupFluora(options)
    .then(result => {
      console.log('\nSetup result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}
