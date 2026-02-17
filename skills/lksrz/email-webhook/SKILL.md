---
name: email-webhook
description: A generic receiver for incoming emails delivered via JSON webhooks. Saves messages to a local JSONL file for agent consumption. Agnostic to the source (Cloudflare, Mailgun, custom proxy).
metadata: {
  "author": "Skippy & Lucas (AI Commander)",
  "homepage": "https://aicommander.dev",
  "env": {
    "PORT": { "description": "Port to listen on (default: 19192).", "default": "19192" },
    "WEBHOOK_SECRET": { "description": "Secret token for webhook authentication (Bearer token). REQUIRED for startup." },
    "INBOX_FILE": { "description": "Filename for the JSONL inbox (default: inbox.jsonl). Path traversal protected.", "default": "inbox.jsonl" }
  },
  "openclaw": {
    "requires": { "bins": ["node"] },
    "install": [
      {
        "id": "npm-deps",
        "kind": "exec",
        "command": "npm install express",
        "label": "Install Node.js dependencies"
      }
    ]
  }
}
---

# Generic Email Webhook Receiver

This skill allows an agent to receive emails as standardized JSON webhooks. It provides an endpoint that can be integrated with any email-to-webhook provider (like Cloudflare Email Routing, Mailgun Inbound, or SendGrid Inbound Parse).

## Expected Webhook Schema

The receiver expects a `POST` request with the following JSON structure:

```json
{
  "from": "sender@example.com",
  "to": "agent@yourdomain.com",
  "subject": "Hello world",
  "text": "The plain text body",
  "html": "<div>Optional HTML content</div>",
  "timestamp": "ISO-8601 string",
  "attachments": [
    {
      "filename": "document.pdf",
      "mimeType": "application/pdf",
      "content": "base64-encoded-string"
    }
  ]
}
```

## Security & Setup

1.  **Start Receiver**: Run `scripts/webhook_server.js`.
2.  **Auth**: All requests MUST include an `Authorization: Bearer <WEBHOOK_SECRET>` header.
3.  **Local Inbox**: Messages are appended to `inbox.jsonl` in the workspace directory.

## Implementation Example: Cloudflare Worker

You can use the following code in a Cloudflare Worker connected to **Email Routing** to push emails to this skill:

```javascript
import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const parser = new PostalMime();
    const parsedEmail = await parser.parse(rawEmail);

    const payload = {
      from: message.from,
      to: message.to,
      subject: parsedEmail.subject,
      text: parsedEmail.text,
      html: parsedEmail.html,
      timestamp: new Date().toISOString()
    };

    await fetch(env.WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WEBHOOK_SECRET}`
      },
      body: JSON.stringify(payload)
    });
  }
}
```

## Tools

### Start Webhook Server
```bash
WEBHOOK_SECRET=my-strong-token INBOX_FILE=inbox.jsonl node scripts/webhook_server.js
```

## Runtime Requirements
Requires: `express` and `node`.
