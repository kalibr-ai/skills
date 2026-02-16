---
name: guava-guard
description: "GuavaGuard Runtime Guard — intercepts dangerous tool calls using threat intelligence patterns"
metadata: { "openclaw": { "emoji": "🍈", "events": ["agent:before_tool_call"], "requires": { "bins": ["node"] } } }
---

# GuavaGuard Runtime Guard — before_tool_call Hook

Real-time security monitoring for OpenClaw agents. Intercepts dangerous
tool calls before execution and checks against threat intelligence patterns.

## Triggers

| Event                      | Action | Purpose                                    |
|----------------------------|--------|--------------------------------------------|
| `agent:before_tool_call`   | scan   | Check tool args for malicious patterns     |

## What it does

Scans every exec/write/edit/browser/web_fetch/message call against 12 runtime threat patterns:

- Reverse shells, credential exfiltration, Gatekeeper bypass
- ClawHavoc AMOS IoCs, known malicious IPs
- DNS exfiltration, base64-to-shell, curl|bash
- SSH key access, crypto wallet credential access
- Cloud metadata SSRF (169.254.169.254)
- Guardrail disabling attempts (CVE-2026-25253)

## Modes

- **monitor** — log only
- **enforce** (default) — block CRITICAL, log rest
- **strict** — block HIGH+CRITICAL, log MEDIUM+

## Audit Log

All detections logged to `~/.openclaw/guava-guard/audit.jsonl`.
Format: JSON lines with timestamp, tool, check ID, severity, action.

## Configuration

Set mode in openclaw.json:
```json
{
  "hooks": {
    "internal": {
      "entries": {
        "guava-guard": {
          "enabled": true,
          "mode": "enforce"
        }
      }
    }
  }
}
```

## Part of GuavaGuard v9.0.0

- Static scanner: `node guava-guard.js [dir]` — 17 threat categories
- Soul Lock: SOUL.md integrity protection + watchdog daemon
- SoulChain: On-chain identity verification (Polygon)
- **Runtime Guard: This hook** ← you are here
