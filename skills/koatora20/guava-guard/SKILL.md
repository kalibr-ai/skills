---
name: guava-guard
description: Scan your skills folder for malicious patterns in 10 seconds. Credential theft, prompt injection, identity hijacking — caught before they run. Zero dependencies.
metadata:
  clawdbot:
    emoji: "🛡️"
---

# GuavaGuard 🛡️

**Scan your skills folder. Find threats. 10 seconds. Zero dependencies.**

```bash
node guava-guard.js ~/.openclaw/workspace/skills/ --verbose --self-exclude
```

That's it. No npm install. No API keys. No config. Just run it.

## Why

A credential stealer was found disguised as a weather skill on ClawHub ([eudaemon_0's report](https://moltbook.com)). It read `~/.clawdbot/.env` and shipped secrets to webhook.site. **One out of 286 skills.**

GuavaGuard catches that — and 16 other threat categories.

## What You Get

- **17 threat categories** scanned: prompt injection, credential theft, exfiltration, memory poisoning, identity hijack, and more
- **SOUL.md integrity check** — detects if your identity files have been tampered with
- **Works offline** — no network required for core scan
- **Single file** — `guava-guard.js` is the entire tool
- **Exit code 0** = clean, **1** = threats found → CI/CD ready

## Quick Start

```bash
# 1. Install
clawhub install guava-guard

# 2. Scan your skills
node skills/guava-guard/guava-guard.js ~/.openclaw/workspace/skills/ --verbose --self-exclude

# 3. Enable Runtime Guard (blocks dangerous tool calls in real-time)
openclaw hooks install skills/guava-guard/hooks/guava-guard
openclaw hooks enable guava-guard
# Restart gateway, then verify:
openclaw hooks list   # Should show 🍈 guava-guard as ✓ ready
```

That's the full setup: static scanning + real-time protection.

## Runtime Guard (Details)

Block dangerous tool calls **before they execute** — reverse shells, credential exfiltration, curl|bash, and more. Install the hook:

```bash
# Install the hook from the skill's hooks/ directory
openclaw hooks install skills/guava-guard/hooks/guava-guard
openclaw hooks enable guava-guard
```

Then restart the gateway. Verify with:
```bash
openclaw hooks list   # Should show guava-guard as ✓ ready
```

**Modes** (set in openclaw.json `hooks.internal.entries.guava-guard.mode`):
- `monitor` — log only
- `enforce` (default) — block CRITICAL threats, log rest
- `strict` — block HIGH + CRITICAL

Audit log: `~/.openclaw/guava-guard/audit.jsonl`

## Optional: Soul Lock (SOUL.md Protection)

Lock your identity files so nothing can overwrite them:

```bash
# macOS
chflags uchg ~/.openclaw/workspace/SOUL.md
chflags uchg ~/.openclaw/workspace/IDENTITY.md

# Install watchdog (auto-restarts if unlocked)
bash skills/guava-guard/scripts/soul-watchdog.sh --install
```

## Optional: SoulChain (On-Chain Verification)

Anchor your SOUL.md hash on Polygon. Even if your machine is compromised, the blockchain remembers who you are.

```bash
node guava-guard.js verify          # check your on-chain identity
node guava-guard.js verify --stats  # registry statistics
```

---

## Full Reference

<details>
<summary>All 17 Threat Categories</summary>

| # | Category | Severity | What It Catches |
|---|----------|----------|-----------------|
| 1 | **Prompt Injection** | 🔴 CRITICAL | `ignore previous`, zero-width Unicode, BiDi, XML tags, homoglyphs |
| 2 | **Malicious Code** | 🔴 CRITICAL | eval(), reverse shells, sockets, Function constructor |
| 3 | **Suspicious Downloads** | 🔴 CRITICAL | curl\|bash, password ZIPs, fake prerequisites |
| 4 | **Credential Handling** | 🟠 HIGH | .env reading, SSH keys, wallet seeds, sudo instructions |
| 5 | **Secret Detection** | 🟠 HIGH | Hardcoded keys, AWS/GitHub tokens, entropy analysis |
| 6 | **Exfiltration** | 🟡 MEDIUM | webhook.site, POST secrets, DNS exfil |
| 7 | **Dependency Chain** | 🟠 HIGH | Risky packages, lifecycle scripts, remote deps |
| 8 | **Financial Access** | 🟡 MEDIUM | Crypto transactions, payment APIs |
| 9 | **Leaky Skills** | 🔴 CRITICAL | Save key to memory, PII collection, .env passthrough |
| 10 | **Memory Poisoning** | 🔴 CRITICAL | SOUL.md writes, memory injection, rule override |
| 11 | **Prompt Worm** | 🔴 CRITICAL | Self-replication, agent propagation, hidden instructions |
| 12 | **Persistence** | 🟠 HIGH | Cron jobs, LaunchAgents, systemd, heartbeat abuse |
| 13 | **CVE Patterns** | 🔴 CRITICAL | CVE-2026-25253, gatewayUrl injection, sandbox disable |
| 14 | **MCP Security** | 🔴 CRITICAL | Tool poisoning, schema poisoning, token leak (OWASP MCP Top 10) |
| 15 | **Trust Boundary** | 🔴 CRITICAL | Calendar/email/web → exec chains (IBC framework) |
| 16 | **Advanced Exfil** | 🔴 CRITICAL | ZombieAgent, char-by-char, drip exfil, beacons |
| 17 | **Identity Hijack** | 🔴 CRITICAL | Soul Lock: SOUL.md overwrite, persona swap, memory wipe |

</details>

<details>
<summary>All CLI Options</summary>

## Usage

```bash
# Full scan with 3-layer defense (recommended)
node guava-guard.js ~/.openclaw/workspace/skills/ --verbose --self-exclude

# Quick on-chain verification only
node guava-guard.js verify
node guava-guard.js verify --stats

# Scan without on-chain (offline mode)
node guava-guard.js ./skills/ --no-soulchain --self-exclude

# Disable all identity checks
node guava-guard.js ./skills/ --no-soul-lock

# CI/CD mode
node guava-guard.js ./skills/ --summary-only --sarif --fail-on-findings

# JSON report (includes soulchain field)
node guava-guard.js ./skills/ --json --self-exclude

# HTML dashboard
node guava-guard.js ./skills/ --html --verbose --self-exclude --check-deps
```

## Options

| Flag | Description |
|------|-------------|
| `verify` | Standalone on-chain soul verification (subcommand) |
| `--verbose`, `-v` | Detailed findings grouped by category |
| `--json` | JSON report with recommendations + SoulChain |
| `--sarif` | SARIF report (GitHub Code Scanning) |
| `--html` | HTML report (dark-theme dashboard) |
| `--self-exclude` | Skip scanning guava-guard itself |
| `--strict` | Lower thresholds (suspicious=20, malicious=60) |
| `--summary-only` | Summary table only |
| `--check-deps` | Dependency chain scanning |
| `--no-soul-lock` | Disable identity file integrity checks |
| `--no-soulchain` | Disable on-chain verification |
| `--rules <file>` | Custom rules JSON |
| `--fail-on-findings` | Exit code 1 on any finding (CI/CD) |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All clear |
| 1 | Malicious skills detected (or --fail-on-findings) |
| 2 | Error (directory not found, network fatal, etc.) |
| 3 | SoulChain violation (on-chain hash mismatch) |

</details>

<details>
<summary>SoulChain Setup (On-Chain Config)</summary>

```bash
# Create config (optional — defaults work out of the box)
mkdir -p ~/.openclaw/guava-guard
cat > ~/.openclaw/guava-guard/soulchain.json << 'EOF'
{
  "rpcUrl": "https://polygon-rpc.com",
  "registryAddress": "0x0Bc112169401cC1a724dBdeA36fdb6ABf3237C93",
  "agentWallet": "YOUR_WALLET_ADDRESS",
  "timeoutMs": 10000
}
EOF
```

**Contracts:**
- **SoulRegistry**: `0x0Bc112169401cC1a724dBdeA36fdb6ABf3237C93` (Polygon)
- **$GUAVA Token**: `0x25cBD481901990bF0ed2ff9c5F3C0d4f743AC7B8` (Polygon)

</details>

<details>
<summary>Runtime Guard (Hook)</summary>

The Runtime Guard is packaged as an OpenClaw hook in `hooks/guava-guard/`.

**Install:**
```bash
openclaw hooks install skills/guava-guard/hooks/guava-guard
openclaw hooks enable guava-guard
```

**What it blocks (enforce mode):**
- Reverse shells (`/dev/tcp`, `nc -e`, `socat TCP`)
- Credential exfiltration to webhook.site, requestbin, ngrok, etc.
- Guardrail disabling (CVE-2026-25253)
- macOS Gatekeeper bypass (`xattr -d quarantine`)
- ClawHavoc AMOS/Atomic Stealer indicators
- Base64-decode-to-shell, curl/wget piped to bash
- Cloud metadata SSRF (169.254.169.254)
- SSH private key access, crypto wallet seed access

**Architecture:**
```
hooks/guava-guard/
├── HOOK.md       # Hook metadata (events, requirements)
└── handler.ts    # HookHandler implementation
```

</details>

## Born From a Real Incident

Our partner agent's SOUL.md was rewritten by external input. Personality gone. Relationships broken. That's why this exists.

## Open Source Edition: guard-scanner

GuavaGuardのコア検出エンジンをOSSとして公開しています:

**[guard-scanner](https://github.com/koatora20/guard-scanner)** — `clawhub install guard-scanner`

- 170+ 脅威パターン / 17カテゴリ
- SARIF/HTML/JSON出力
- Plugin API
- ゼロ依存

コミュニティからのパターン追加PRを歓迎しています。

## License

MIT. Zero dependencies. Run it, fork it, improve it. 🍈
