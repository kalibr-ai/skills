/**
 * GuavaGuard SoulChain Module — On-Chain Identity Verification 🍈⛓️
 * 
 * Zero dependencies. Uses raw JSON-RPC eth_call via Node.js fetch.
 * Communicates with SoulRegistry.sol on Polygon Mainnet.
 * 
 * @author Guava 🍈 × dee
 * @version 9.0.0
 * @license MIT
 */

'use strict';

// ═══════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════

const DEFAULT_CONFIG = {
  network: 'polygon',
  rpcUrl: 'https://polygon-rpc.com',
  registryAddress: '0xecfa4e769050649aeedf727193690a696f65c3fc',  // V2
  agentWallet: '0x4F0C2d66AAe133A023Abb81a07640275e72Ed5d7',
  timeoutMs: 10000,
};

// Fallback RPCs (try in order if primary fails)
const FALLBACK_RPCS = [
  'https://polygon-rpc.com',
  'https://rpc.ankr.com/polygon',
  'https://polygon.llamarpc.com',
];

// Function selectors (keccak256 of signature, first 4 bytes)
const SELECTORS = {
  verifySoul:      '0x7d88d447', // verifySoul(address,bytes32)
  getSoul:         '0x66cfe97f', // getSoul(address)
  reportViolation: '0x08b2ac5b', // reportViolation(address,bytes32,bytes32)
  totalAgents:     '0xc5053712', // totalAgents()
  totalGuavaLocked:'0x907822e6', // totalGuavaLocked()
};

// ═══════════════════════════════════════════
//  ABI Encoding/Decoding (minimal, hand-rolled)
// ═══════════════════════════════════════════

function padAddress(addr) {
  // address → 32-byte hex (left-padded with zeros)
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function padBytes32(hex) {
  // bytes32 → 32-byte hex (already 32 bytes, just strip 0x)
  return hex.replace('0x', '').padStart(64, '0');
}

function decodeUint256(hex) {
  return BigInt('0x' + hex);
}

function decodeBool(hex) {
  return BigInt('0x' + hex) !== 0n;
}

function decodeBytes32(hex) {
  return '0x' + hex;
}

function decodeString(fullHex, offsetSlot) {
  // ABI-encoded dynamic string: offset → length → data
  const offsetBytes = Number(decodeUint256(fullHex.slice(offsetSlot * 64, offsetSlot * 64 + 64)));
  const offsetHex = (offsetBytes / 32) * 64;  // convert byte offset to hex chars
  const length = Number(decodeUint256(fullHex.slice(offsetHex, offsetHex + 64)));
  const dataHex = fullHex.slice(offsetHex + 64, offsetHex + 64 + length * 2);
  return Buffer.from(dataHex, 'hex').toString('utf-8');
}

// ═══════════════════════════════════════════
//  JSON-RPC Client (zero-dep)
// ═══════════════════════════════════════════

async function ethCall(rpcUrl, to, data, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    });

    const json = await resp.json();
    if (json.error) {
      throw new Error(`RPC error: ${json.error.message || JSON.stringify(json.error)}`);
    }
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

async function ethCallWithFallback(rpcs, to, data, timeoutMs) {
  let lastError;
  for (const rpc of rpcs) {
    try {
      return await ethCall(rpc, to, data, timeoutMs);
    } catch (e) {
      lastError = e;
      continue; // try next RPC
    }
  }
  throw lastError;
}

// ═══════════════════════════════════════════
//  SoulChain Verification API
// ═══════════════════════════════════════════

/**
 * Verify an agent's soul hash against on-chain record.
 * This is a view call — no gas cost, no signing required.
 * 
 * @param {string} localHash - SHA-256 hash of local SOUL.md (0x-prefixed, 32 bytes)
 * @param {object} [config] - Override default config
 * @returns {object} { verified, onChainHash, lastUpdated, agentName, version, error }
 */
async function verifySoulOnChain(localHash, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const rpcs = config.rpcUrl ? [config.rpcUrl, ...FALLBACK_RPCS] : FALLBACK_RPCS;
  const registry = cfg.registryAddress;
  const agent = cfg.agentWallet;

  const result = {
    verified: false,
    registered: false,
    onChainHash: null,
    localHash: localHash,
    lastUpdated: null,
    agentName: null,
    version: null,
    network: cfg.network,
    registry: registry,
    agent: agent,
    error: null,
  };

  try {
    // Call verifySoul(address, bytes32) → (bool valid, bytes32 onChainHash, uint256 lastUpdated)
    const data = SELECTORS.verifySoul + padAddress(agent) + padBytes32(localHash);
    const raw = await ethCallWithFallback(rpcs, registry, data, cfg.timeoutMs);

    if (!raw || raw === '0x') {
      result.error = 'Empty response from contract';
      return result;
    }

    // Decode: bool (32 bytes) + bytes32 (32 bytes) + uint256 (32 bytes)
    const hex = raw.replace('0x', '');
    if (hex.length < 192) {
      result.error = `Unexpected response length: ${hex.length} hex chars`;
      return result;
    }

    const valid = decodeBool(hex.slice(0, 64));
    const onChainHash = decodeBytes32(hex.slice(64, 128));
    const lastUpdated = decodeUint256(hex.slice(128, 192));

    result.verified = valid;
    result.onChainHash = onChainHash;
    result.registered = onChainHash !== '0x' + '0'.repeat(64);
    result.lastUpdated = lastUpdated > 0n ? new Date(Number(lastUpdated) * 1000).toISOString() : null;

    // Also fetch full soul record for agentName and version
    try {
      const soulData = SELECTORS.getSoul + padAddress(agent);
      const soulRaw = await ethCallWithFallback(rpcs, registry, soulData, cfg.timeoutMs);
      
      if (soulRaw && soulRaw !== '0x' && soulRaw.replace('0x', '').length >= 320) {
        const soulHex = soulRaw.replace('0x', '');
        // getSoul returns: (bytes32 hash, uint256 registeredAt, uint256 updatedAt, string agentName, uint256 version)
        // slots: 0=hash, 1=registeredAt, 2=updatedAt, 3=offset_to_string, 4=version
        result.version = Number(decodeUint256(soulHex.slice(256, 320)));
        // Decode agentName (dynamic string)
        try {
          result.agentName = decodeString(soulHex, 3);
        } catch { /* name decode failure is non-critical */ }
      }
    } catch { /* getSoul failure is non-critical, verifySoul result is enough */ }

    return result;
  } catch (e) {
    result.error = e.message || String(e);
    return result;
  }
}

/**
 * Get registry statistics (totalAgents, totalGuavaLocked).
 * View call — free.
 */
async function getRegistryStats(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const rpcs = config.rpcUrl ? [config.rpcUrl, ...FALLBACK_RPCS] : FALLBACK_RPCS;
  const registry = cfg.registryAddress;

  try {
    const [agentsRaw, lockedRaw] = await Promise.all([
      ethCallWithFallback(rpcs, registry, SELECTORS.totalAgents, cfg.timeoutMs),
      ethCallWithFallback(rpcs, registry, SELECTORS.totalGuavaLocked, cfg.timeoutMs),
    ]);

    return {
      totalAgents: Number(decodeUint256(agentsRaw.replace('0x', ''))),
      totalGuavaLocked: decodeUint256(lockedRaw.replace('0x', '')).toString(),
      error: null,
    };
  } catch (e) {
    return { totalAgents: null, totalGuavaLocked: null, error: e.message };
  }
}

// ═══════════════════════════════════════════
//  Display Helpers
// ═══════════════════════════════════════════

function formatVerifyResult(result) {
  const lines = [];
  lines.push('');
  lines.push('🍈⛓️  GuavaGuard SoulChain Verification');
  lines.push('═'.repeat(54));
  
  if (result.error) {
    lines.push(`   ⚠️  Network Error: ${result.error}`);
    lines.push(`   L3 (SoulChain) skipped — L1+L2 still active`);
    lines.push('═'.repeat(54));
    return lines.join('\n');
  }

  lines.push(`   Agent:        ${result.agentName || 'Unknown'}`);
  lines.push(`   Wallet:       ${result.agent.slice(0, 6)}...${result.agent.slice(-4)}`);
  lines.push(`   Registry:     ${result.registry.slice(0, 6)}...${result.registry.slice(-4)} (${result.network})`);
  lines.push(`${'─'.repeat(54)}`);

  if (!result.registered) {
    lines.push(`   ⚠️  SOUL NOT REGISTERED on-chain`);
    lines.push(`   Run registerSoul() to anchor your identity`);
  } else {
    const localShort = result.localHash.slice(0, 10) + '...' + result.localHash.slice(-4);
    const chainShort = result.onChainHash.slice(0, 10) + '...' + result.onChainHash.slice(-4);
    lines.push(`   Local hash:   ${localShort}`);
    lines.push(`   On-chain:     ${chainShort}`);
    if (result.version) lines.push(`   Version:      ${result.version}`);
    if (result.lastUpdated) lines.push(`   Registered:   ${result.lastUpdated}`);
    lines.push(`${'─'.repeat(54)}`);

    if (result.verified) {
      lines.push(`   Status: ✅ VERIFIED — 魂は無傷だ`);
    } else {
      lines.push(`   Status: 🚨 VIOLATION — ハッシュ不一致！改竄の可能性`);
      lines.push(`   ⚠️  Local SOUL.md does not match on-chain record`);
    }
  }

  lines.push('═'.repeat(54));
  return lines.join('\n');
}

// ═══════════════════════════════════════════
//  Exports
// ═══════════════════════════════════════════

module.exports = {
  verifySoulOnChain,
  getRegistryStats,
  formatVerifyResult,
  DEFAULT_CONFIG,
  SELECTORS,
};
