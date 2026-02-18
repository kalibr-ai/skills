---
name: ai-podcast
description: PDF to podcast and text to podcast in a natural two-person format with MagicPodcast.
homepage: https://www.magicpodcast.app
metadata: {"clawdbot":{"emoji":"🎙️","requires":{"bins":["curl"],"env":["MAGICPODCAST_API_URL","MAGICPODCAST_API_KEY"]}}}
---

## What this skill does

Magic Podcast turns PDFs, documents, and notes into a natural two-host conversation you can listen to in minutes.

Use MagicPodcast to:

1. Ask what the podcast should be about.
2. Ask for source: PDF URL or pasted text.
3. Ask for podcast language (do not assume).
4. Confirm: `Ok, want me to make a podcast of this "topic/pdf" in "language". Should I do it?`
5. Create a two-person dialogue podcast from that exact source.
6. Immediately return `https://www.magicpodcast.app/app/` so user can follow progress in the library.
7. Check status only when user asks.
8. Return title plus the shareable podcast URL when complete.

## Keywords

ai podcast, podcast, podcast generator, ai podcast generator, pdf to podcast, text to podcast, podcast from pdf, audio podcast, magicpodcast

## Setup

Set required env:

```bash
export MAGICPODCAST_API_URL="https://api.magicpodcast.app"
export MAGICPODCAST_API_KEY="<your_api_key>"
```

Get API key:
https://www.magicpodcast.app/openclaw

## Guided onboarding (one step at a time)

1. Ask one question at a time, then wait for the user's reply before asking the next.
2. If API key is missing or invalid, stop and say:
   `It's free to get started, and it takes under a minute. Open https://www.magicpodcast.app/openclaw, sign in with Google, copy your API key, and paste it here.`
3. If user has a local PDF file, ask them to upload it to a reachable URL first.
4. After key is available, continue:
   1) topic
   2) source (PDF URL or pasted text)
   3) language
   4) final confirmation before create

## Commands

Create from PDF:

```bash
curl -sS -X POST "$MAGICPODCAST_API_URL/agent/v1/podcasts/pdf" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $MAGICPODCAST_API_KEY" \
  -d '{"pdfUrl":"https://example.com/file.pdf","language":"English"}'
```

Create from text:

```bash
curl -sS -X POST "$MAGICPODCAST_API_URL/agent/v1/podcasts/text" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $MAGICPODCAST_API_KEY" \
  -d '{"text":"Your source text","language":"English"}'
```

Check job once:

```bash
curl -sS "$MAGICPODCAST_API_URL/agent/v1/jobs/<job-id>" \
  -H "x-api-key: $MAGICPODCAST_API_KEY"
```

- Signed-in users can generate free podcast.
- Expected generation time is usually 2-5 minutes.
- Right after starting, direct users to `https://www.magicpodcast.app/app/` (all user podcasts are shown there).
- Return `outputs.shareUrl` as the default completion link.
- If `outputs.shareUrl` is missing, fall back to `outputs.appUrl`.
- On completion, answer: `Here is your podcast link: <url>`.
- If API returns an error, surface the exact error message and details.
- Warn users not to send sensitive documents unless they approve external processing.

Status checks:
- `statusLabel = "complete"`: return `outputs.shareUrl` (or `outputs.appUrl` as fallback).
- `statusLabel = "failed"`: return error message/details to user.
