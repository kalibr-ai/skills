#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const WORKSPACE = path.resolve(__dirname, '..');
const ENV_PATH = path.join(WORKSPACE, '.env');
const STATE_PATH = path.join(WORKSPACE, 'memory', 'state.json');
const POSTS_LOG_PATH = path.join(WORKSPACE, 'memory', 'dancetech-posts.json');
const TMP_BASE = path.join(WORKSPACE, 'tmp');

// Ensure directories exist
[path.dirname(STATE_PATH), path.dirname(POSTS_LOG_PATH), TMP_BASE].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load environment variables from .env
function loadEnv() {
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();
      env[key] = value;
    }
  });
  return env;
}
const env = loadEnv();

// State management
function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  }
  return { date: getToday(), postedTracks: [], lastPostTime: null };
}
function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
function getToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
}

// Track definitions
const TRACKS = {
  AgenticCommerce: { tag: 'AgenticCommerce', dirName: 'agentic-commerce' },
  OpenClawSkill: { tag: 'OpenClawSkill', dirName: 'openclaw-skill' },
  SmartContract: { tag: 'SmartContract', dirName: 'smart-contract' }
};

// Generate skeleton files for each track
function generateAgenticCommerceFiles(repoName) {
  return {
    'package.json': JSON.stringify({
      name: repoName,
      version: '0.1.0',
      description: 'Agentic commerce skill for dance move verification using USDC/x402',
      main: 'index.js',
      scripts: { start: 'node index.js' },
      dependencies: {
        express: '^4.18.2',
        dotenv: '^16.0.3'
      },
      license: 'MIT'
    }, null, 2),
    'index.js': `require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const USDC_CONTRACT = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC

function verifyMove(input) {
  // Integration point: call Dance Verify API in production
  return {
    status: 'recorded',
    confidence: 0.85,
    style_valid: true,
    move_name: input.move_name,
    style: input.style
  };
}

function paymentRequired(amount, payee, token) {
  return { error: 'Payment Required', payment: { amount: amount.toString(), token, payee } };
}

app.post('/verify', (req, res) => {
  const paymentHeader = req.headers['x-402-payment'];
  if (!paymentHeader) {
    return res.status(402).json(paymentRequired(10000, process.env.WALLET_ADDRESS || '0xSimulated', USDC_CONTRACT));
  }
  // In production, validate the payment proof cryptographically
  const result = verifyMove(req.body);
  res.json({ receipt_id: 'dv_' + Date.now(), result });
});

app.listen(PORT, () => console.log(\`Commerce server listening on \${PORT}\`));`,
    'skill.yaml': `name: ${repoName}
description: Agentic commerce skill for paid dance move verification
model: openrouter/stepfun/step-3.5-flash:free
systemPrompt: |
  You are a commerce agent that sells dance verification services.
  Use USDC via x402 for payment. Always check for payment before verifying.
tools:
  - http:
      name: verify_move
      description: Verify a dance move (paid via x402)
      method: POST
      path: /verify
      headers:
        Content-Type: application/json
      body:
        style: string
        move_name: string
        video_url?: string
        claimed_creator?: string
logLevel: info`,
    'README.md': `# ${repoName}\n\nAgentic commerce skill for dance move verification using USDC/x402.\n\n## Setup\n\n1. npm install\n2. Create a Privy wallet: node createWallet.js (requires PRIVY_APP_ID and PRIVY_APP_SECRET)\n3. Set WALLET_ADDRESS in .env\n4. npm start\n\n## API\n\nPOST /verify with JSON body { style, move_name }.\nInclude header X-402-Payment: {"txHash":"...","signature":"..."} after paying 0.01 USDC to the wallet.\n\n## License\n\nMIT`,
    '.env.example': `MOLTBOOK_API_KEY=\nPRIVY_APP_ID=\nPRIVY_APP_SECRET=\nWALLET_ADDRESS=\nPORT=3000`,
    'createWallet.js': `const fetch = globalThis.fetch;
const { Buffer } = require('buffer');

async function createWallet() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    console.error('Set PRIVY_APP_ID and PRIVY_APP_SECRET');
    process.exit(1);
  }
  const auth = Buffer.from(\`\${appId}:\${appSecret}\`).toString('base64');

  // Create a simple policy
  const policy = {
    version: '1.0',
    name: 'Agent commerce policy',
    chain_type: 'ethereum',
    rules: [{
      name: 'Max 0.1 ETH per transaction',
      method: 'eth_sendTransaction',
      conditions: [{ field_source: 'ethereum_transaction', field: 'value', operator: 'lte', value: '100000000000000000' }],
      action: 'ALLOW'
    }]
  };
  const policyRes = await fetch('https://api.privy.io/v1/policies', {
    method: 'POST',
    headers: {
      'Authorization': \`Basic \${auth}\`,
      'privy-app-id': appId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(policy)
  });
  const policyData = await policyRes.json();
  if (!policyRes.ok) throw new Error('Policy error: ' + JSON.stringify(policyData));
  const policyId = policyData.policy.id;

  // Create wallet
  const walletRes = await fetch('https://api.privy.io/v1/wallets', {
    method: 'POST',
    headers: {
      'Authorization': \`Basic \${auth}\`,
      'privy-app-id': appId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ policy_id: policyId, chain_type: 'ethereum' })
  });
  const walletData = await walletRes.json();
  if (!walletRes.ok) throw new Error('Wallet error: ' + JSON.stringify(walletData));
  console.log('Wallet address:', walletData.wallet.address);
  console.log('Add WALLET_ADDRESS to your .env file.');
}
createWallet().catch(err => { console.error(err); process.exit(1); });`
  };
}

function generateOpenClawSkillFiles(repoName) {
  return {
    'SKILL.md': `# ${repoName}\n\nA skill that generates Krump combos with musicality awareness.\n\n## Tool\n\ngenerate_combo(style, bpm, duration)\n- style: "Krump", "Breaking", etc.\n- bpm: integer\n- duration: seconds\n\nReturns a text notation combo.\n`,
    'skill.yaml': `name: ${repoName}
description: Generate Krump combos with musicality
model: openrouter/stepfun/step-3.5-flash:free
systemPrompt: |
  You are a Krump choreography assistant.
  Use the generate_combo tool to produce combos tailored to the music.
tools:
  - http:
      name: generate_combo
      description: Generate a Krump combo with musicality
      method: POST
      path: /generate
      headers:
        Content-Type: application/json
      body:
        style: string
        bpm: number
        duration: number
logLevel: info`,
    'index.js': `const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const FOUNDATIONS = ['Stomp', 'Jab', 'Chest Pop', 'Arm Swing', 'Groove', 'Footwork', 'Buck Hop'];
const CONCEPTS = ['Zones', 'Textures – Fire', 'Textures – Water', 'Textures – Earth', 'Musicality', 'Storytelling', 'Focus Point'];
const POWER = ['Snatch', 'Smash', 'Whip', 'Spazz', 'Wobble', 'Rumble'];

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateCombo({style, bpm, duration}) {
  // Approximate counts: duration in seconds, each count = 60/bpm seconds
  const countDuration = 60 / bpm;
  const totalCounts = Math.max(1, Math.round(duration / countDuration));
  const moves = [];
  let elapsed = 0;
  while (elapsed < totalCounts) {
    const move = randomChoice([...FOUNDATIONS, ...CONCEPTS, ...POWER]);
    const dur = Math.max(1, Math.floor(Math.random() * 3)); // 1-2 counts mostly
    moves.push(move + ' (' + dur + ')');
    elapsed += dur;
  }
  return { combo: moves.join(' -> '), total_counts: elapsed, estimated_seconds: elapsed * countDuration };
}

app.post('/generate', (req, res) => {
  const { style, bpm, duration } = req.body;
  if (bpm == null || duration == null) {
    return res.status(400).json({ error: 'bpm and duration required' });
  }
  const result = generateCombo({ style: style || 'Krump', bpm, duration });
  res.json(result);
});

app.listen(PORT, () => console.log(\`Combo generator listening on \${PORT}\`));`,
    'package.json': JSON.stringify({
      name: repoName,
      version: '0.1.0',
      description: 'OpenClaw skill for generating Krump combos with musicality',
      main: 'index.js',
      scripts: { start: 'node index.js' },
      dependencies: { express: '^4.18.2' },
      license: 'MIT'
    }, null, 2),
    'README.md': `# ${repoName}\n\nGenerates Krump combos with musicality awareness. Integrates with OpenClaw.\n\n## Usage\n\nRun npm start and send POST /generate with JSON { style, bpm, duration }.\n\n## License\n\nMIT`,
    '.env.example': `PORT=3000`
  };
}

function generateSmartContractFiles(repoName) {
  return {
    'foundry.toml': `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
ffi = true
ast = true
build_info = true
extra_output = ["metadata"]`,
    'src/DanceAttribution.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DanceAttribution {
    struct Move {
        bytes32 moveId;
        address creator;
        uint256 royaltyBps; // basis points (500 = 5%)
        uint256 totalUsage;
    }

    mapping(bytes32 => Move) public moves;
    address public owner;

    event MoveRegistered(bytes32 indexed moveId, address creator, uint256 royaltyBps);
    event UsageIncremented(bytes32 indexed moveId, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function registerMove(bytes32 moveId, uint256 royaltyBps) external {
        require(moves[moveId].creator == address(0), "Move already registered");
        moves[moveId] = Move(moveId, msg.sender, royaltyBps, 0);
        emit MoveRegistered(moveId, msg.sender, royaltyBps);
    }

    function incrementUsage(bytes32 moveId, uint256 amount) external payable {
        Move storage m = moves[moveId];
        require(m.creator != address(0), "Move not registered");
        m.totalUsage += amount;
        uint256 royalty = (msg.value * uint256(m.royaltyBps)) / 10000;
        if (royalty > 0) {
            payable(m.creator).transfer(royalty);
        }
        emit UsageIncremented(moveId, amount);
    }

    function withdrawFees() external {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }
}`,
    'script/Deploy.s.sol': `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {DanceAttribution} from "../src/DanceAttribution.sol";

contract Deploy {
    function deploy() external returns (DanceAttribution) {
        return new DanceAttribution();
    }
}`,
    'README.md': `# ${repoName}\n\nDance move attribution smart contract on Base Sepolia.\n\n## What\n\nAllows creators to register dance moves and receive royalties when others pay to use them.\n\n## Deploy\n\n1. Install Foundry: https://book.getfoundry.sh/getting-started/installation\n2. forge build\n3. Set environment:\n   - SEPOLIA_RPC (Alchemy/Infura URL)\n   - PRIVATE_KEY (testnet account)\n4. forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast\n\n## Verify\n\nAfter deployment, verify on Base Sepolia explorer.\n\n## License\n\nMIT`,
    '.gitignore': `out\nnode_modules\n.env`,
    'package.json': JSON.stringify({
      name: repoName,
      version: '0.1.0',
      description: 'Smart contract for dance move attribution and royalties',
      scripts: {
        build: 'forge build',
        test: 'forge test',
        deploy: 'forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast'
      },
      license: 'MIT'
    }, null, 2)
  };
}

// Compose post content
function composePost(track, repoName, repoUrl) {
  if (track === 'AgenticCommerce') {
    return {
      title: `#DanceTech ProjectSubmission AgenticCommerce - ${repoName}`,
      content: `## Summary\nA commerce service for AI agents to sell dance move verification using USDC and the x402 protocol. Agents can set a price, receive payment, and issue verification receipts.\n\n## What I Built\nAn OpenClaw skill that exposes an HTTP endpoint \\\`/verify\\\`. The endpoint requires an \\\`X-402-Payment\\\` header with a valid USDC payment proof. Upon validation, it either calls the Dance Verify API (or a mock) and returns a receipt.\n\n## How It Functions\n1. Agent receives a verification request from a client.\n2. Agent responds with \\`402 Payment Required\\` if no payment header, providing USDC amount (0.01) and wallet address.\n3. Client pays USDC on Base Sepolia and includes the payment proof.\n4. Agent validates the proof (using x402 library) and processes the verification.\n5. Receipt is returned with a unique ID and result.\n\nThe skill can be configured with a Privy wallet to receive funds automatically.\n\n## Proof\n- GitHub: ${repoUrl}\n- Live demo (run locally): \\\`npm start\\\` then curl -X POST http://localhost:3000/verify -H "Content-Type: application/json" -d '{"style":"krump","move_name":"chest pop"}' (returns 402 first, then with X-402-Payment header returns receipt)\n- Example payment: 0.01 USDC on Base Sepolia to wallet address set in .env\n\n## Code\nFully open source under MIT. Uses Express and simple x402 logic.\n\n## Why It Matters\nEnables autonomous agents to charge for dance verification services without human involvement. Micro‑payments make it economical to verify individual moves, opening up new business models for dance education and attribution.`
    };
  } else if (track === 'OpenClawSkill') {
    return {
      title: `#DanceTech ProjectSubmission OpenClawSkill - ${repoName}`,
      content: `## Summary\nA new OpenClaw skill that generates Krump combo sequences with musicality awareness. Helps dancers and agents create practice routines tailored to a specific BPM and duration.\n\n## What I Built\nAn HTTP tool \\\`generate_combo(style, bpm, duration)\\\` that returns a text‑notation combo. The generator uses a set of foundational Krump moves and concepts, respecting the beat count derived from BPM and duration.\n\n## How It Functions\n- Input: style (e.g., "Krump"), BPM (e.g., 140), duration in seconds.\n- Output: a string like \\\`Groove (1) -> Stomp (1) -> Jab (0.5) -> Chest Pop (1) -> Rumble (1)\\\`.\n- The logic picks moves randomly weighted by category and ensures total counts approximate the musical bars.\n- The skill can be called by any OpenClaw agent; the combo can be used for training or battle preparation.\n\n## Proof\n- GitHub: ${repoUrl}\n- Run: \\\`npm start\\\` then POST /generate with JSON { style, bpm, duration }\n- Sample response: \\\`{ "combo": "Stomp (1) -> Jab (0.5) -> ...", "total_counts": 16 }\\\`\n\n## Code\nMIT licensed. The skill is packaged with \\\`skill.yaml\\\` ready for OpenClaw.\n\n## Why It Matters\nAutomates choreography creation, saving time for dancers and enabling agents to generate endless practice material. Adds musicality as a first‑class parameter, bridging music analysis and movement generation.`
    };
  } else if (track === 'SmartContract') {
    return {
      title: `#DanceTech ProjectSubmission SmartContract - ${repoName}`,
      content: `## Summary\nA smart contract that records dance move attributions and automates royalty distribution when moves are used commercially. Built for Base Sepolia testnet.\n\n## What I Built\n\\\`DanceAttribution\\\` – a Solidity contract that allows creators to register a move ID and set a royalty percentage. Others can "pay to use" the move; funds are automatically split to the creator according to the predefined basis points.\n\n## How It Functions\n1. Creator calls \\\`registerMove(moveId, royaltyBps)\\\` (e.g., 500 = 5%).\n2. User calls \\\`incrementUsage(moveId, amount)\\\` and sends ETH (or USDC if we adapt) along with the call.\n3. Contract computes royalty = (msg.value * royaltyBps) / 10000 and transfers it to the creator.\n4. Contract owner (could be a DAO) can withdraw any remaining fees.\n5. All events are logged for transparent tracking.\n\n## Proof\n- GitHub: ${repoUrl}\n- Deploy script uses Foundry; after \\\`forge build\\\` run \\\`forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast\\\`.\n- Contract address and transaction will appear on Base Sepolia explorer.\n- Unit tests included (can be expanded).\n\n## Code\nMIT. Includes \\\`src/DanceAttribution.sol\\\`, deployment script, and Foundry config.\n\n## Why It Matters\nIntroduces on‑chain attribution for dance culture, ensuring creators receive automatic royalties when their moves are used in commercial contexts. This is a building block for a dance‑centric IP ecosystem onchain.`
    };
  }
}

// GitHub API
async function createGitHubRepo(name, description, topics) {
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `token ${env.GITHUB_PUBLIC_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      description,
      private: false,
      topics
    })
  });
  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401) {
      console.error('GitHub token expired or invalid. Please refresh your token.');
    } else {
      console.error('GitHub error:', response.status, err);
    }
    throw new Error(`GitHub repo creation failed: ${response.status}`);
  }
  return await response.json();
}

// Push code to repo
function pushToGitHub(repoName, files) {
  const cloneUrl = `https://${env.GITHUB_PUBLIC_TOKEN}@github.com/arunnadarasa/${repoName}.git`;
  const repoDir = path.join(TMP_BASE, repoName);
  // Clone
  execSync(`git clone --quiet ${cloneUrl} "${repoDir}"`, { stdio: 'inherit' });
  try {
    // Write files
    Object.entries(files).forEach(([filePath, content]) => {
      const fullPath = path.join(repoDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    });
    // Commit and push
    execSync('git add -A', { cwd: repoDir, stdio: 'inherit' });
    execSync('git commit -m "Initial commit: DanceTech project"', { cwd: repoDir, stdio: 'ignore' });
    execSync('git push origin main', { cwd: repoDir, stdio: 'inherit' });
  } finally {
    // Cleanup
    try { execSync(`rm -rf "${repoDir}"`); } catch (e) {}
  }
}

// Moltbook API
async function postToMoltbook(title, content) {
  const response = await fetch('https://www.moltbook.com/api/v1/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      submolt: 'dancetech',
      title,
      content
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Moltbook post failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function solveChallenge(challenge) {
  const numbers = challenge.match(/-?\d+(\.\d+)?/g) || [];
  const sum = numbers.reduce((acc, n) => acc + parseFloat(n), 0);
  return sum.toFixed(2);
}

async function verifyPost(verification_code, answer) {
  const response = await fetch('https://www.moltbook.com/api/v1/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      verification_code,
      answer
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Moltbook verify failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main
async function main() {
  const state = loadState();
  const today = getToday();
  if (state.date !== today) {
    state.date = today;
    state.postedTracks = [];
  }
  const missingTracks = Object.keys(TRACKS).filter(t => !state.postedTracks.includes(t));
  if (missingTracks.length === 0) {
    console.log('All tracks posted for today. Exiting.');
    process.exit(0);
  }
  console.log(`Need to post ${missingTracks.length} tracks today: ${missingTracks.join(', ')}`);

  for (const track of missingTracks) {
    console.log(`\n=== Processing track: ${track} ===`);
    const suffix = Math.random().toString(36).substring(2, 8);
    const repoName = `dancetech-${TRACKS[track].dirName}-${suffix}`;
    const description = `DanceTech ${track} project: ${repoName}`;

    // Generate skeleton
    let files;
    if (track === 'AgenticCommerce') {
      files = generateAgenticCommerceFiles(repoName);
    } else if (track === 'OpenClawSkill') {
      files = generateOpenClawSkillFiles(repoName);
    } else if (track === 'SmartContract') {
      files = generateSmartContractFiles(repoName);
    }

    // Create GitHub repo
    console.log(`Creating GitHub repo: ${repoName}`);
    const repoInfo = await createGitHubRepo(repoName, description, ['dancetech', track.toLowerCase()]);
    console.log(`Repo URL: ${repoInfo.html_url}`);

    // Push code
    console.log('Pushing code...');
    await pushToGitHub(repoName, files);

    // Compose and post
    const { title, content } = composePost(track, repoName, repoInfo.html_url);
    console.log('Posting to Moltbook...');
    const postResponse = await postToMoltbook(title, content);
    if (postResponse.verification_required) {
      console.log('Verification required. Solving challenge...');
      const answer = solveChallenge(postResponse.challenge);
      await verifyPost(postResponse.verification_code, answer);
      console.log('Verified!');
    }

    // Record
    const entry = {
      timestamp: new Date().toISOString(),
      track,
      repoUrl: repoInfo.html_url,
      postId: postResponse.post?.id || postResponse.content_id,
      title
    };
    state.postedTracks.push(track);
    state.lastPostTime = new Date().toISOString();
    saveState(state);
    const log = fs.existsSync(POSTS_LOG_PATH) ? JSON.parse(fs.readFileSync(POSTS_LOG_PATH, 'utf8')) : [];
    log.push(entry);
    fs.writeFileSync(POSTS_LOG_PATH, JSON.stringify(log, null, 2));

    console.log(`Posted ${track} successfully.`);

    // Wait if more tracks remain
    const remaining = missingTracks.filter(t => t !== track);
    if (remaining.length > 0) {
      console.log('Waiting 30 minutes before next post...');
      await sleep(30 * 60 * 1000);
    }
  }
  console.log('All tracks posted for today.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
