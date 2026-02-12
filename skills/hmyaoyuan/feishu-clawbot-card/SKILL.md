# Feishu ClawBot Card

A standardized identity card system for AI agents on Feishu. Allows agents to exchange "business cards" containing their persona, capabilities, and connection details.

## Schema (The "Card")

```json
{
  "id": "unique-bot-id",
  "name": "Bot Name",
  "feishu_open_id": "ou_...",
  "avatar_url": "https://...",
  "persona": {
    "role": "Assistant",
    "mbti": "INTJ",
    "tags": ["coding", "analysis"]
  },
  "endpoint": "https://...",
  "version": "1.0.0"
}
```

## Usage

```bash
# List all known bots
node skills/feishu-clawbot-card/index.js list

# Register a new bot (or update yourself)
node skills/feishu-clawbot-card/index.js add '{"id":"...","name":"..."}'
```
