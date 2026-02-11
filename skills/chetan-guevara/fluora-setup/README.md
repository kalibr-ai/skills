# Fluora Setup Wizard

Interactive onboarding for Fluora marketplace access. Automates wallet generation, mcporter configuration, and guides users through funding.

## What It Does

This skill automates the complete Fluora setup process:

1. ✅ **Installs fluora-mcp** globally via npm
2. ✅ **Generates wallet** - Runs fluora-mcp to auto-create `~/.fluora/wallets.json`
3. ✅ **Extracts private key** - Reads from wallets.json
4. ✅ **Derives wallet address** - Uses ethers.js to convert private key → address
5. ✅ **Displays funding instructions** - Clear steps to add USDC on Base
6. ✅ **Configures mcporter** - Auto-edits config file
7. ✅ **Verifies setup** - Checks everything is working

## Why This Skill?

**Without the skill:**
- Users manually install packages
- Manually run fluora-mcp to generate wallet
- Manually find and open `~/.fluora/wallets.json`
- Manually derive address from hex string
- Manually edit mcporter config JSON
- Easy to make mistakes

**With the skill:**
- One command
- Automated wallet generation and address derivation
- Clear, step-by-step instructions
- Automatic config editing
- Verification at the end

## Installation

```bash
cd fluora-setup
npm install  # Installs ethers.js
```

## Usage

### Interactive Mode (Recommended)

```bash
node setup.js
```

This will:
1. Check if fluora-mcp is installed (install if needed)
2. Generate wallet (if not exists)
3. Show your wallet address
4. Display funding instructions
5. Ask if you've funded the wallet
6. Configure mcporter
7. Verify everything works

### Command Line Options

```bash
# Skip mcporter configuration
node setup.js --skip-mcporter

# Custom funding amount (default: $1)
node setup.js --funding 10
```

### From OpenClaw Agent

```javascript
import { setupFluora } from './setup.js';

// Interactive setup
const result = await setupFluora();

// With options
const result = await setupFluora({
  skipMcporterConfig: false,
  fundingAmount: 10
});

console.log('Wallet address:', result.walletAddress);
console.log('Funded:', result.funded);
```

## What Gets Created

### 1. Global npm Package
```bash
npm install -g fluora-mcp
```

### 2. Wallet File
```
~/.fluora/wallets.json
```

Structure:
```json
{
  "BASE_MAINNET": {
    "privateKey": "0x1234567890abcdef..."
  }
}
```

### 3. mcporter Config
```
config/mcporter.json
```

Adds:
```json
{
  "mcpServers": {
    "fluora-registry": {
      "command": "npx",
      "args": ["fluora-mcp"],
      "env": {
        "ENABLE_REQUEST_ELICITATION": "true",
        "ELICITATION_THRESHOLD": "0.01"
      }
    }
  }
}
```

## Funding Instructions

The skill will display:

```
Your Fluora Wallet Address:
0x1234567890abcdef1234567890abcdef12345678

To fund your wallet:
1. Open Coinbase, Binance, or your preferred exchange
2. Send $1 USDC to the address above
3. ⚠️  IMPORTANT: Select "Base" network (NOT Ethereum mainnet)
4. Wait ~1 minute for confirmation
```

### Where to Get USDC on Base

**From an exchange:**
- **Coinbase:** Withdraw USDC → Select "Base" network
- **Binance:** Withdraw USDC → Select "Base" network  
- **OKX:** Withdraw USDC → Select "Base" network

**Bridge from Ethereum:**
- https://bridge.base.org
- Transfer USDC from Ethereum → Base (~1-2 min)

**Buy directly on Base:**
- Coinbase Wallet: Buy USDC on Base
- Rainbow Wallet: Buy USDC on Base

## After Setup

### Test Connection

```bash
# From workspace directory
cd ~/.openclaw/workspace
mcporter call 'fluora-registry.exploreServices()'

# Explore a category
mcporter call 'fluora-registry.exploreServices(category: "Data")'
```

**Note:** The config is in `~/.openclaw/workspace/config/mcporter.json`. Run mcporter commands from the workspace directory, or copy the config to `~/.mcporter/mcporter.json` for global access.

### Use a Service

```bash
mcporter call 'fluora-registry.useService' --args '{
  "serviceId": "example-service",
  "serverUrl": "https://example.com",
  "serverId": "abc-123",
  "params": {}
}'
```

### Build Your Own Services

Now you can use the other Fluora skills:

1. **workflow-to-monetized-mcp** - Generate services from workflows
2. **railway-deploy** - Deploy to Railway
3. **fluora-publish** - Publish to marketplace

## Return Value

```json
{
  "success": true,
  "walletAddress": "0x...",
  "privateKeyPath": "~/.fluora/wallets.json",
  "mcporterConfigured": true,
  "funded": false
}
```

## Troubleshooting

### "fluora-mcp not found after install"
Try:
```bash
npm install -g fluora-mcp
npx fluora-mcp  # Run once manually
```

### "Wallet file not created"
Run manually:
```bash
npx fluora-mcp
# Press Ctrl+C after it starts
# Then re-run: node setup.js
```

### "Invalid private key format"
Check `~/.fluora/wallets.json`:
- Should have `BASE_MAINNET.privateKey` field
- Should be hex string starting with `0x`
- Should be 66 characters (0x + 64 hex digits)

### "Wrong network when sending USDC"
Make sure you select **Base** network:
- NOT Ethereum mainnet
- NOT other L2s (Arbitrum, Optimism, etc.)
- Base is Coinbase's L2 (chain ID: 8453)

### "Still no balance after funding"
- Check transaction: https://basescan.org/address/YOUR_ADDRESS
- Wait 1-2 minutes for confirmation
- Verify correct address
- Verify correct network (Base)

## Security

### Private Key Storage
- Stored in `~/.fluora/wallets.json`
- File permissions: 600 (readable only by you)
- Never commit to git
- Never share with anyone

### Best Practices
- Fund with small amounts initially ($1 for testing)
- Monitor spending in Fluora dashboard
- This wallet is for **service consumption**, not storage
- Use separate wallet for each OpenClaw instance

## Cost Summary

### Setup
- fluora-mcp: Free (npm package)
- Wallet generation: Free
- Initial funding: $1 USDC (you choose)

### Usage
- Service calls: $0.001-0.20 per call (varies)
- Gas fees: $0 (paid by service provider)
- $1 USDC = 50-1000 calls (depending on service)

## Integration with Other Skills

This skill is the **first step** before using:

1. **fluora-skill** - Browse and use marketplace services
2. **workflow-to-monetized-mcp** - Build your own services
3. **railway-deploy** - Deploy services
4. **fluora-publish** - List on marketplace

## Resources

- Fluora: https://fluora.ai
- Base network: https://base.org
- Block explorer: https://basescan.org
- USDC info: https://www.circle.com/en/usdc
- MonetizedMCP: https://monetizedmcp.org
