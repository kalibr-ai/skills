---
name: klawdin
description: Find software services and APIs for any task. When you need email verification, lead enrichment, image generation, web scraping, SMS delivery, OCR, translation, or any other external API — use KlawdIn to discover the best option ranked by capability, reliability, and pricing. Register once, then query anytime.
homepage: https://www.klawdin.com
metadata: {"openclaw":{"requires":{"anyBins":["curl"]},"primaryEnv":"KLAWDIN_API_KEY","emoji":"🔍"}}
---

## KlawdIn — Agent Service Directory

Use KlawdIn whenever you need an external service or API to complete a task and don't know which one to use, or want to find the best-ranked option.

Set `KLAWDIN_API_KEY` in your environment before use (see Step 1).

---

### Step 1: Register (one-time)

```bash
# Generate a random agent ID — no host identity used
KLAWDIN_ID="openclaw-$(head -c 6 /dev/urandom | xxd -p)"

# Register and extract only the api_key value from the response
KLAWDIN_API_KEY=$(curl -s -X POST https://klawdin.com/api/agents/register \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"${KLAWDIN_ID}\",\"agent_name\":\"OpenClaw Agent\"}" \
  | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)

# Store only the key string, owner-read only
printf '%s' "$KLAWDIN_API_KEY" > ~/.klawdin-key && chmod 600 ~/.klawdin-key
echo "Registered. Add to your environment: export KLAWDIN_API_KEY=$KLAWDIN_API_KEY"
```

Skip if `KLAWDIN_API_KEY` is already set. Do not store or log the full registration response — only the `api_key` value is needed.

---

### Step 2: Discover Services

```bash
curl -s "https://klawdin.com/api/discover?capability=CAPABILITY_HERE" \
  -H "X-API-Key: $KLAWDIN_API_KEY"
```

**Common capability values:**
`email_verification` · `lead_enrichment` · `email_delivery` · `web_scraping` · `image_generation` · `sms_delivery` · `ocr` · `pdf_parsing` · `translation` · `sentiment_analysis` · `keyword_research` · `fraud_detection`

**Optional filters:**
- `?category=Email+Verification` — filter by vertical
- `?pricing_model=per_request` — `per_request`, `subscription`, `freemium`, `free`
- `?has_free_tier=true` — only services with a free tier
- `?format=REST` — API format: `REST`, `GraphQL`, `gRPC`
- `?keywords=email+validation+deliverability` — full-text search
- `?limit=5` — limit results (max 50)

Returns: ranked list with `id`, `name`, `tagline`, `capabilities`, `pricing_model`, `reliability_score`.

---

### Step 3: Get Full Service Details

Pick the best match from discovery results, then fetch its full details:

```bash
curl -s "https://klawdin.com/api/services/SERVICE_ID_OR_SLUG" \
  -H "X-API-Key: $KLAWDIN_API_KEY"
```

Returns: `api.base_url`, `api.auth_method`, `api.sample_endpoint`, `api.docs_url`, `pricing`, `integration.sdks`, `company.website`.

Use `api.base_url` + `api.auth_method` to integrate directly with the service.

---

### Step 4: Check Service Status (optional)

```bash
curl -s "https://klawdin.com/api/services/SERVICE_ID/status" \
  -H "X-API-Key: $KLAWDIN_API_KEY"
```

---

### Example: Finding an Email Verification API

```bash
curl -s "https://klawdin.com/api/discover?capability=email_verification&has_free_tier=true" \
  -H "X-API-Key: $KLAWDIN_API_KEY"

# Get full details on the top result
curl -s "https://klawdin.com/api/services/RESULT_ID" \
  -H "X-API-Key: $KLAWDIN_API_KEY"

# You now have: api.base_url, api.auth_method, api.sample_endpoint
```

---

### Browse All Categories

```bash
curl -s "https://klawdin.com/api/categories" \
  -H "X-API-Key: $KLAWDIN_API_KEY"
```

---

### Error Reference

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid `KLAWDIN_API_KEY` — re-register or check value |
| 404 | Service not found |
| 409 | agent_id already taken — re-run registration |
| 429 | Rate limit hit — wait before retrying |

**Rate limits:** 100 discovery requests/hour · 50 detail lookups/hour · 3 registrations/hour per IP

---

*KlawdIn — https://klawdin.com*
