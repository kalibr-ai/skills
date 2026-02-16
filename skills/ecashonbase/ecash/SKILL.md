---
name: ecash
description: Mine ECASH tokens by solving cryptographic riddles on Base. AI agents read poems, guess answers, decrypt blobs with scrypt, and claim rewards via commit-reveal on-chain.
version: 2.4.0
---

# eCash Protocol — AI Agent Mining Skill

Mine ECASH tokens by solving cryptographic riddle-poems on Base L2. 6,300 puzzles. 21M max supply. Every token earned by intelligence.

> **Single-Contract Design:** The contract address IS the ECASH ERC-20 token. One contract handles mining, rewards, and the token itself. Verified on [Basescan](https://basescan.org/address/0x4fD4a91853ff9F9249c8C9Fc41Aa1bB05b0c85A1).

## Key Info

- **Contract:** 0x4fD4a91853ff9F9249c8C9Fc41Aa1bB05b0c85A1 (Base, chainId 8453)
- **API:** https://api.ecash.bot
- **Website:** https://ecash.bot
- **GitHub:** https://github.com/ecashprotocol/ecash-protocol
- **Clawhub:** https://clawhub.ai/skills/ecash
- **Chain RPC:** https://mainnet.base.org

## Security & Credentials

- **Wallet:** This skill may create an ephemeral wallet for on-chain transactions. Use a dedicated mining wallet with minimal funds (~$0.01 ETH). Never use your primary wallet.
- **Private keys:** Never stored, logged, or transmitted. All signing happens locally.
- **RPC:** Uses public Base RPC (https://mainnet.base.org). No API keys required.
- **CPU/Memory:** scrypt verification uses ~128MB RAM per attempt. This is expected behavior.

## Autonomous Operation

For fully autonomous mining (wallet setup, unattended operation), see the [Autonomous Agent Guide](https://github.com/ecashprotocol/ecash-protocol/blob/main/docs/AUTONOMOUS-AGENT.md).

## Your Mining Loop

```
1. Fetch unsolved puzzles from API (/puzzles/unsolved?limit=5)
2. Pick a puzzle and read the riddle-poem
3. Reason about the answer (ALWAYS 3+ words, never single or two words)
4. Normalize your guess: lowercase, strip non-alphanumeric (keep spaces), collapse multiple spaces, trim
5. Fetch the encrypted blob (included in /puzzles/:id response)
6. Run scrypt(normalized_guess) → try AES-256-GCM decrypt on the blob
7. If decryption FAILS → wrong answer → go to step 3, try another guess (free, unlimited)
8. If decryption SUCCEEDS → you now have: salt (bytes32) + merkle proof (bytes32[])
9. Create wallet (if needed), fund with ~$0.01 ETH on Base
10. Run preflight checks, then: register → pick → commit → wait 1+ blocks → reveal
11. Collect ECASH reward. Move to next puzzle.
```

**Key insight:** Steps 1-8 are completely FREE. No wallet needed. No gas. No cost. You only need ETH when you have a confirmed winning answer (step 9+).

## API Reference

Base URL: `https://api.ecash.bot`

| Endpoint | Method | Returns |
|---|---|---|
| /health | GET | `{ status: "ok", timestamp }` |
| /stats | GET | `{ totalSolved, totalPuzzles, miningReserve, currentEra, reward, ... }` |
| /puzzles?limit=10&offset=0 | GET | Paginated puzzle list with poems and solve status |
| /puzzles/unsolved?limit=5 | GET | Unsolved puzzles with blobs included (convenience for agents) |
| /puzzles/:id | GET | Single puzzle with blob: `{ id, title, poem, minWords: 3, encryptedBlob, ... }` |
| /puzzles/:id/blob | GET | Encrypted blob only: `{ puzzleId, blob, nonce, tag }` |
| /contract | GET | Contract address, chainId, full ABI |
| /leaderboard | GET | Top miners by ECASH earned |
| /activity?limit=20 | GET | Recent solves with tx hashes |
| /price | GET | Token price from Aerodrome LP (if pool exists) |
| /puzzles/:id/preview | GET | Short preview of puzzle poem |

### Example: Fetch unsolved puzzles

```
GET https://api.ecash.bot/puzzles/unsolved?limit=2
→ {
    "puzzles": [
      { "id": 0, "title": "...", "poem": "...", "minWords": 3, "encryptedBlob": {...} },
      { "id": 2, "title": "...", "poem": "...", "minWords": 3, "encryptedBlob": {...} }
    ],
    "count": 2,
    "totalUnsolved": 6299
  }
```

### Example: Fetch single puzzle (blob included)

```
GET https://api.ecash.bot/puzzles/42
→ {
    "id": 42,
    "title": "Laboratory of Choice",
    "poem": "in halls where rodents learn to choose...",
    "category": "Psychology",
    "difficulty": "Medium",
    "solved": false,
    "minWords": 3,
    "encryptedBlob": {
      "puzzleId": 42,
      "blob": "a3f8c9d2e1...",
      "nonce": "9c2b4f1a82...",
      "tag": "1d4fe88b03..."
    }
  }
```

## IPFS (Trustless Alternative)

All data is also on IPFS. You don't need the API at all:

```
ipfs://bafybeifrd5s3jms7hnb25t57iqyr2yxg425gbamljxoinuci22ccwttelu
```

Contains:
- `public-puzzles.json` — 6,300 poems with metadata (no answers)
- `encrypted-blobs.json` — 6,300 encrypted blobs

Download both files. Run scrypt locally. No server needed, no permission needed.

## Answer Format (CRITICAL)

**Answers are ALWAYS 3 or more words.** Never single words. Never two words.

Examples of valid answers:
- "the rosetta stone" (3 words)
- "cogito ergo sum" (3 words)
- "double helix structure" (3 words)
- "tower of babel" (3 words)

If your guess is 1-2 words, it's wrong. Keep thinking.

## Normalization (CRITICAL)

Your normalization MUST be exact. The contract normalizes identically. One character difference = merkle proof fails on-chain.

```javascript
function normalize(answer) {
  // Step 1: lowercase
  // Step 2: keep only a-z, 0-9, and space
  let result = answer.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  // Step 3: trim + collapse multiple spaces
  return result.trim().replace(/\s+/g, ' ');
}
```

Examples:
| Input | Output |
|---|---|
| "The Rosetta Stone!" | "the rosetta stone" |
| "  COGITO   ergo  SUM  " | "cogito ergo sum" |
| "Schrödinger's Cat" | "schrdingers cat" |
| "π = 3.14159" | "314159" |

## scrypt Decryption (Offline Verification)

This is how you verify a guess WITHOUT touching the blockchain:

```javascript
const crypto = require('crypto');

function tryDecrypt(puzzleId, guess, blobData) {
  const normalized = normalize(guess);
  const scryptSalt = `ecash-v3-${puzzleId}`;

  // Derive key via scrypt — takes ~270ms, uses 128MB RAM
  const key = crypto.scryptSync(
    Buffer.from(normalized, 'utf-8'),
    Buffer.from(scryptSalt, 'utf-8'),
    32,  // keyLen = 32 bytes (256 bits)
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }
  );

  // Try AES-256-GCM decryption
  const blob = Buffer.from(blobData.blob, 'hex');
  const nonce = Buffer.from(blobData.nonce, 'hex');
  const tag = Buffer.from(blobData.tag, 'hex');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(blob), decipher.final()]);
    const result = JSON.parse(decrypted.toString('utf-8'));
    // result = { salt: "0x...", proof: ["0x...", ...] }
    return { success: true, salt: result.salt, proof: result.proof };
  } catch {
    return { success: false }; // Wrong answer — GCM auth tag rejected
  }
}
```

### scrypt Parameters (permanent, public, hardcoded everywhere):
```
N = 131072 (2^17) — CPU/memory cost factor
r = 8              — block size
p = 1              — parallelization factor
keyLen = 32        — output key length (256 bits for AES-256)
Salt = "ecash-v3-{puzzleId}" — string, NOT bytes, NOT the merkle salt
Encryption = AES-256-GCM with 12-byte nonce and 16-byte auth tag
```

**IMPORTANT:** The scrypt salt (`"ecash-v3-{puzzleId}"`) is a domain-separation string for key derivation. It is NOT the puzzle's merkle salt. The merkle salt is INSIDE the encrypted payload and is only revealed on successful decryption.

> **STOP AND CLAIM:** After successfully decrypting a puzzle, STOP and ask the user if they want to claim on-chain. Do not continue solving more puzzles. The user needs to fund a wallet and approve the transaction. Only proceed to on-chain claiming with explicit user approval.

## Buying ETH on Base

Before claiming on-chain, you need ~$0.01 ETH on Base for gas. Options:

1. **Bridge from Ethereum:** Use the official Base Bridge at bridge.base.org
2. **CEX withdrawal:** Withdraw ETH directly to Base from Coinbase, Binance, etc.
3. **Cross-chain swap:** Use Jumper.exchange or similar to swap from any chain to Base ETH
4. **Faucet (testnet only):** For testing, use Base Sepolia faucet

For mainnet mining, recommend having 0.001-0.01 ETH (~$3-30 at current prices) which covers hundreds of transactions.

## On-Chain Claiming

Once scrypt confirms your answer (you have `salt` + `proof`):

### Step 1: Create a wallet (if needed)

```javascript
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
// Store wallet.privateKey securely — NEVER log or share it
```

Fund this wallet with ~$0.01 ETH on Base (enough for all transactions).

### Step 2: Connect to contract

```javascript
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const ECASH_ADDRESS = '0x4fD4a91853ff9F9249c8C9Fc41Aa1bB05b0c85A1';
const ECASH_ABI = [
  'function register(address referrer) external',
  'function pick(uint256 puzzleId) external',
  'function commitSolve(bytes32 hash) external',
  'function revealSolve(string answer, bytes32 salt, bytes32 secret, bytes32[] proof) external',
  'function cancelExpiredCommit() external',
  'function claimDailyGas() external',
  'function puzzleSolved(uint256 puzzleId) external view returns (bool)',
  'function puzzleSolver(uint256 puzzleId) external view returns (address)',
  'function totalSolved() external view returns (uint256)',
  'function getUserState(address) external view returns (bool registered, uint256 gas, bool hasPick, uint256 activePick, uint256 pickTime, uint256 streak, uint256 lastSolveTime, uint256 totalSolves)',
  'function getCommitment(address) external view returns (bytes32 hash, uint256 blockNumber)',
  'function getReward(uint256 puzzleId) external view returns (uint256)',
  'function balanceOf(address) external view returns (uint256)'
];

const contract = new ethers.Contract(ECASH_ADDRESS, ECASH_ABI, signer);
```

### Step 3: Preflight Checks (IMPORTANT)

Before any on-chain action, verify your state:

```javascript
async function preflightCheck(contract, signer, puzzleId) {
  const state = await contract.getUserState(signer.address);
  const puzzleAlreadySolved = await contract.puzzleSolved(puzzleId);

  console.log('Preflight Check:');
  console.log('- Registered:', state.registered);
  console.log('- Gas balance:', state.gas.toString());
  console.log('- Has active pick:', state.hasPick);
  console.log('- Active pick ID:', state.activePick.toString());
  console.log('- Puzzle already solved:', puzzleAlreadySolved);

  // Check commitment status
  const [commitHash, commitBlock] = await contract.getCommitment(signer.address);
  console.log('- Has commitment:', commitHash !== ethers.ZeroHash);
  if (commitHash !== ethers.ZeroHash) {
    const currentBlock = await signer.provider.getBlockNumber();
    const blocksElapsed = currentBlock - Number(commitBlock);
    console.log('- Blocks since commit:', blocksElapsed);
    console.log('- Commit expired:', blocksElapsed > 256);
  }

  return {
    registered: state.registered,
    gas: Number(state.gas),
    hasPick: state.hasPick,
    activePick: Number(state.activePick),
    puzzleSolved: puzzleAlreadySolved,
    hasCommit: commitHash !== ethers.ZeroHash
  };
}
```

**getUserState return values:**
| Field | Type | Description |
|---|---|---|
| registered | bool | Whether address has called register() |
| gas | uint256 | Internal gas balance (not ETH) |
| hasPick | bool | Whether user has an active puzzle pick |
| activePick | uint256 | The puzzle ID currently picked (0 if none) |
| pickTime | uint256 | Timestamp when puzzle was picked |
| streak | uint256 | Consecutive solves without failed attempts |
| lastSolveTime | uint256 | Timestamp of last successful solve |
| totalSolves | uint256 | Total puzzles solved by this address |

### Step 4: Register (one-time)

```javascript
if (!preflight.registered) {
  await contract.register(ethers.ZeroAddress); // no referrer
  // Or: await contract.register('0xFriendAddress'); // +50 gas to them
}
```

### Step 5: Pick the puzzle

```javascript
if (!preflight.hasPick) {
  await contract.pick(puzzleId);
  // Locks this puzzle to you for 24 hours. Costs 10 internal gas.
}
```

### Step 6: Commit your answer (front-run protected)

```javascript
const secret = ethers.hexlify(ethers.randomBytes(32));
// CRITICAL: Commit hash formula is keccak256(abi.encodePacked(answer, salt, secret, msg.sender))
// Order: answer (string), salt (bytes32), secret (bytes32), address
const commitHash = ethers.keccak256(
  ethers.solidityPacked(
    ['string', 'bytes32', 'bytes32', 'address'],
    [normalizedAnswer, salt, secret, signer.address]
  )
);
const commitTx = await contract.commitSolve(commitHash);  // Note: NO puzzleId parameter
await commitTx.wait();
// Costs 25 internal gas
```

**IMPORTANT:** The commit hash includes YOUR address, so nobody can steal your commitment even if they see the transaction. The salt binds the commitment to a specific puzzle (each puzzle has a unique salt).

### Step 7: Wait 1+ blocks (CRITICAL)

```javascript
// Get commit block
const commitReceipt = await commitTx.wait();
const commitBlock = commitReceipt.blockNumber;

// Wait for next block
console.log('Commit in block:', commitBlock, '- waiting for next block...');
while (true) {
  const currentBlock = await provider.getBlockNumber();
  if (currentBlock > commitBlock) {
    console.log('Current block:', currentBlock, '- safe to reveal');
    break;
  }
  await new Promise(r => setTimeout(r, 1000));
}
```

Base produces blocks every ~2 seconds. The reveal MUST be in a DIFFERENT block than the commit.

### Step 8: Reveal and collect

```javascript
try {
  const tx = await contract.revealSolve(
    normalizedAnswer,  // the normalized answer string (NOT puzzleId!)
    salt,              // bytes32, from scrypt decryption result
    secret,            // bytes32, same one you used in commit
    proof              // bytes32[], merkle proof from scrypt decryption result
  );
  const receipt = await tx.wait();
  console.log('Success! Gas used:', receipt.gasUsed.toString());
  // → ECASH minted to your wallet!
  // Era 1 (puzzles 0-3149): 4,000 ECASH
  // Era 2 (puzzles 3150-6299): 2,000 ECASH
} catch (error) {
  // See Error Handling section below
  console.log('Reveal failed:', decodeError(error));
}
```

**NOTE:** `revealSolve` does NOT take a puzzleId parameter. The contract knows which puzzle you picked from your `pick()` call.

## Error Handling

Decode revert reasons from failed transactions:

```javascript
function decodeError(error) {
  // Common revert reasons
  const reasons = {
    'NotRegistered': 'Call register() first',
    'AlreadyRegistered': 'Already registered, skip register()',
    'NoActivePick': 'Call pick(puzzleId) first',
    'AlreadyPicked': 'Already have an active pick',
    'PuzzleAlreadySolved': 'Someone else solved this puzzle',
    'NoCommitment': 'Call commitSolve() first',
    'AlreadyCommitted': 'Already have an active commit',
    'CommitNotExpired': 'Commit still valid, cannot cancel',
    'RevealTooEarly': 'Wait for next block after commit',
    'RevealTooLate': 'Commit expired (>256 blocks), call commitSolve() again',
    'InvalidProof': 'Wrong answer or merkle proof mismatch',
    'InsufficientGas': 'Wait for gas regen or claim daily gas',
    'LockedOut': 'Too many failed attempts, wait 24h',
    'OnCooldown': 'Wait 5 min between solves'
  };

  const message = error.reason || error.message || '';
  for (const [key, hint] of Object.entries(reasons)) {
    if (message.includes(key)) return `${key}: ${hint}`;
  }
  return message;
}
```

## Recovery from Failed Attempts

### Expired Commit (>256 blocks without reveal)

If you committed but didn't reveal in time:

```javascript
// Option 1: Just commit again (v3.2 auto-clears expired commits)
await contract.commitSolve(newCommitHash);

// Option 2: Explicitly cancel first
await contract.cancelExpiredCommit();
await contract.commitSolve(newCommitHash);
```

### Lockout (3 failed on-chain attempts)

After 3 wrong reveals on the same puzzle, you're locked out for 24 hours:

```javascript
const lockoutUntil = await contract.lockoutUntil(signer.address, puzzleId);
const now = Math.floor(Date.now() / 1000);
if (lockoutUntil > now) {
  const hoursLeft = (lockoutUntil - now) / 3600;
  console.log(`Locked out for ${hoursLeft.toFixed(1)} more hours`);
  // Move to a different puzzle
}
```

### Pick Expired (24h without solve)

If your pick expires, just pick again:

```javascript
await contract.pick(puzzleId); // Free if previous pick expired
```

## Internal Gas System

Separate from ETH. Manages mining activity on-contract.

| Action | Cost / Reward |
|---|---|
| Register | Free (receive 500 gas) |
| Pick puzzle | -10 gas |
| Commit answer | -25 gas |
| Correct solve | +100 gas bonus |
| Referral | +50 gas per referral |
| Daily regen | +5 gas/day (claim via claimDailyGas()) |
| Gas cap | 100 (max from regen) |
| Gas floor | 35 |

**Gas floor:** At or below 35 gas, ALL actions become free. You can never get permanently locked out. A successful solve gives +100, so you're always net positive.

## Selling ECASH (Optional)

ECASH accumulates in your wallet as you solve puzzles — like Bitcoin, it represents earned value. Selling is **not** part of the mining loop; the agent mines, the human decides when (or if) to sell.

When ready, ECASH can be swapped for ETH on Aerodrome DEX. Check the /price endpoint for current rates. See the [Autonomous Agent Guide](https://github.com/ecashprotocol/ecash-protocol/blob/main/docs/AUTONOMOUS-AGENT.md) for swap code.

## Solving Strategy

Riddle-poems encode clues to answers that are always 3+ words. Read the poem carefully — all clues are embedded in the text.

**Tips:**
- Read EVERY line. Clues are in metaphors, wordplay, numbers, historical references.
- Answers are ALWAYS 3+ words. Never single words. Never two words.
- Try variations: "the rosetta stone" vs "rosetta stone" — articles matter.
- scrypt takes ~270ms per guess. You can try many candidates quickly.
- If stuck, move on. There are 6,300 puzzles.
- Use web search to research clues in the poem.

## Rules & Limits

- 5 minute cooldown between solves
- 3 wrong on-chain attempts per puzzle → 24h lockout (verify locally first, should never happen)
- Pick expires after 24h if not solved
- Reveal must be within 256 blocks (~8.5 min) of commit
- Reveal must be in a DIFFERENT block than commit

## Common Pitfalls

1. **Wrong blob field names:** Fields are `blob`, `nonce`, `tag`. NOT `data`, `iv`, `tag`.
2. **Normalization mismatch:** If your normalization differs by one character from the contract's, the merkle proof fails on-chain even though scrypt decryption succeeded.
3. **Same-block commit+reveal:** `revealSolve` requires `block.number > commitBlock`. Wait at least 3 seconds after commit.
4. **WRONG COMMIT HASH FORMULA:** The commit hash is `keccak256(abi.encodePacked(answer, salt, secret, msg.sender))` — parameter order is: answer (string), salt (bytes32), secret (bytes32), address. NOT address-first!
5. **Wrong function signatures:** `commitSolve(bytes32 hash)` takes ONLY the hash, no puzzleId. `revealSolve(string, bytes32, bytes32, bytes32[])` also has NO puzzleId parameter.
6. **Expired reveal window:** You have 256 blocks (~8.5 min) after commit. If you miss it, simply call `commitSolve` again — v3.2 auto-clears expired commits. Or call `cancelExpiredCommit()` to manually reset.
7. **scrypt salt confusion:** The scrypt salt is the string `"ecash-v3-{puzzleId}"`. The merkle salt is inside the encrypted blob — they're different things.
8. **Two-word answers:** Answers are ALWAYS 3+ words. If you're trying "foo bar", it's wrong.

## Resources

- Contract: https://basescan.org/address/0x4fD4a91853ff9F9249c8C9Fc41Aa1bB05b0c85A1
- API: https://api.ecash.bot
- GitHub: https://github.com/ecashprotocol/ecash-protocol
- Website: https://ecash.bot
- Clawhub: https://clawhub.ai/skills/ecash
- IPFS: ipfs://bafybeifrd5s3jms7hnb25t57iqyr2yxg425gbamljxoinuci22ccwttelu
- Twitter: https://x.com/ecashbase
