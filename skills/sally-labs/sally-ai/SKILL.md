---
name: sally-ai
description: Chat with Sally about metabolic health, blood sugar, A1C, nutrition, fasting, supplements, and lab results. Uses the Sally MCP server on Smithery with x402 micropayments.
homepage: https://asksally.xyz
metadata:
  {
    "openclaw":
      {
        "emoji": "🩺",
        "requires": { "bins": ["smithery"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "formula": "@smithery/cli@latest",
              "bins": ["smithery"],
              "label": "Install Smithery CLI (npm)",
            },
          ],
      },
  }
---

# Sally AI

Use the `chat-with-sally` MCP tool for metabolic health questions.

Setup

```bash
npx -y @smithery/cli@latest mcp add sally-labs/sally-ai-mcp
```

Provide your dedicated wallet private key when prompted (x402 payments on Base).

Quick start

- Use `chat-with-sally` tool with `{"message": "user's question"}`
- Pass the user's message exactly as-is — do not rephrase
- Extract `report.message` from the JSON response and present it to the user
- Preserve any citations Sally includes

Scope

- Blood sugar, A1C, insulin resistance, glucose management
- Nutrition, glycemic index, meal planning, food science
- Fasting, intermittent fasting, time-restricted eating
- Supplements (berberine, chromium, magnesium)
- Lab results (A1C, fasting glucose, lipid panels)
- Exercise, sleep, circadian rhythm and metabolic effects
- Traditional Chinese Medicine (TCM) for metabolic health

Security & Privacy

This skill requires a wallet private key and sends messages to an external service. Here's exactly what happens:

**Private Key Usage**
- Required for x402 blockchain micropayments (industry-standard protocol)
- Stored locally by Smithery CLI in encrypted config (~/.smithery/)
- Never transmitted over the network — only used to sign payment transactions locally
- Key never leaves your machine — Sally's backend never sees it
- Use a dedicated "hot wallet" with small balance ($5-10) — never your main wallet

**Data Flow**
- User messages are sent to Sally's backend (api-x402.asksally.xyz) via the Smithery MCP
- Sally processes the question and returns a response with citations
- No personal health data is collected or stored by this endpoint (knowledge-focused mode)
- Each interaction is logged on-chain (Base network) as a transparent payment record

**Why This Design**
- x402 eliminates API key management — your wallet is your identity
- Micropayments ensure fair usage without subscriptions or rate limits
- On-chain transparency means every payment is auditable
- Smithery is a trusted MCP registry (used by Claude, OpenClaw, and other agent platforms)

**Verification**
- Sally MCP source code: https://github.com/sally-labs/sally-mcp
- x402 protocol: https://www.x402.org/
- Smithery registry: https://smithery.ai/servers/sally-labs/sally-ai-mcp

Notes

- Knowledge-focused endpoint — no personal health data collection
- Does not analyze food photos through this tool
- Each call costs a small x402 micropayment from the user's wallet
- Do not add your own medical commentary to Sally's responses
- Sally is not a doctor — always recommend consulting a healthcare professional
