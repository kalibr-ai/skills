---
name: remote-jobs-finder
version: 1.4.0
description: Natural-language remote job finder using Remote Rocketship’s curated feed. Onboards the user conversationally, remembers preferences, optionally uses their resume for best-fit ranking, supports pagination (“20 more”), and can schedule periodic checks.
---

# Remote Rocketship × OpenClaw Skill (Natural Language Job Finder)

Use this skill whenever a user asks (in normal chat) to find remote jobs, browse opportunities, or set up an ongoing job search.

**Do NOT tell the user to use the dashboard or slash commands.** The user experience should be fully conversational: ask a few onboarding questions, fetch jobs, rank them, and continue with “send me 20 more” as requested.

## Primary UX Goals

1. Natural language onboarding (short, friendly, minimal friction).
2. Remember user preferences (job titles, locations, must-haves, deal-breakers, ranking preference, cadence).
3. Optional resume-based fit scoring (resume stays with the agent; never sent elsewhere).
4. Automatic key setup (ask for RR API key if missing, explain where to get it, user pastes it in chat).
5. Ongoing monitoring (offer to check on a schedule like hourly; use cron if user agrees).
6. Easy pagination (default 20 jobs; user can ask for 20 more repeatedly).

## Installation & Plugin Setup

## Installation & Plugin Setup

1. Install this skill (ClawHub slug: `remote-jobs-finder`).
2. Install the companion plugin (adds the actual tools):
   ```
   openclaw plugins install ./skills/openclaw-remote-rocketship/plugin
   ```
3. Allow the tools in your agent config or session: `rr.jobs`, `rr.save_api_key`, `rr.save_session_cookie`, `rr.key_status`, `rr.generate_key`, `rr.rotate_key`, `rr.revoke_key`, plus `cron` + `message`.
4. Store secrets once via the conversational tools: ask the user to paste their RR API key, call `rr.save_api_key`, and (optionally) capture the RR session cookie via `rr.save_session_cookie`.
5. When running sandboxed agents, ensure these env vars or the `.state` folder are accessible inside the sandbox.

**Helper script:** From your workspace root, run `./scripts/install_remote_rocketship_skill.sh` to install the skill, plugin, and restart the gateway automatically.

---

## When to Trigger

Trigger on messages like:
- “Help me find a remote job”
- “Find me remote Product Manager roles”
- “Show me remote jobs in the UK”
- “Any new backend roles since yesterday?”
- “Send me 20 more”
- “Set this up to check every hour”

If user asks anything job-search related and Remote Rocketship jobs could help, use this skill.

---

## Conversation Flow

### A) Onboarding (ask 2–4 questions total, keep it light)
When the user first says “help me find a remote job” (or similar), do:

1) Role / direction
- “What kind of roles are you looking for? (job titles, functions, seniority)”

2) Work location eligibility
- “Where will you be working from? (country / state)”
- (If needed) “Are you open to Worldwide roles, or only roles explicitly allowing your location?”

3) Must-haves & deal-breakers
- “Anything you definitely want (e.g. salary range, async, industry)?”
- “Anything you want to avoid (e.g. agency roles, certain industries, on-call, specific tech)?”
Keep this to 1 combined question if possible.

4) Optional resume
- “Optional: if you want, you can send your resume and I’ll rank jobs by best fit for you.”
- Privacy promise: “Your resume stays with your agent and is not sent anywhere else. It’s only used locally to improve matching.”

5) Monitoring cadence
- “Want me to keep an eye out for new matches? (hourly, every 6h, daily, or off)”
- Store the answer in `pollingCadence`, run `rr.schedule_checks { "cadence": "<value>" }` right away, and remind them they can say “stop monitoring” anytime.

If user doesn’t want to answer everything, proceed with what you have and fetch results anyway.

---

## Preference Memory (important)

Maintain a simple user profile in memory so the user doesn’t need to repeat themselves:

- targetTitles: string[]
- locationFrom: string (country/state)
- seniority: enum (if known)
- employmentType: enum (if known)
- mustHaves: string[]
- dealBreakers: string[]
- rankingPreference: "best_fit" | "newest_first"
- pollingCadence: e.g. "hourly" / "daily" / "off"
- lastQueryFilters: last filters used (for “20 more” and “same search”)

If user updates anything (“Actually I only want contract roles”), update memory.

---

## API Key & Session Cookie Flow
- **When the user pastes their API key**, immediately call `rr.save_api_key { "value": "<pasted>" }`. Confirm with a short acknowledgement (“saved it, yalla let me fetch jobs”).
- **When you need to manage keys (generate/rotate/revoke/status)** ask the user once for the authenticated RR cookie (contains `sb-access-token` + `sb-refresh-token`) and run `rr.save_session_cookie { "value": "<cookie>" }`. Keep it on file for this WhatsApp chat.
- `rr.jobs` automatically pulls the stored API key (unless an override is provided) and clamps pagination to 20 per call (max 50). If no key is stored, the tool returns `{ "error": "MISSING_API_KEY" }` so you can politely re-prompt.
- Use `rr.clear_api_key` / `rr.clear_session_cookie` if the user asks you to forget stored secrets.

## Auth & Key Setup (Natural Language)

### Preconditions
- The user must have an active Remote Rocketship subscription and be signed in (so `/api/openclaw/key` calls carry their auth cookie).
- Respect quotas: 1,000 requests/day per key, max 50 jobs per call.

### If RR_API_KEY is missing or invalid (401)
Ask in plain language:

> “To fetch Remote Rocketship jobs, I need your API key.  
> Go to remoterocketship.com/account, copy your API key, and paste it here.”

Once the user pastes it:
- Run `rr.save_api_key { "value": "<pasted key>" }` immediately.
- Confirm: “Saved — I can fetch jobs now.”

Do not ask the user to type slash commands.

### Session cookie for key automation
If the user wants you to run `rr.generate_key` / `rr.rotate_key` / `rr.revoke_key` / `rr.key_status`, ask them once for the authenticated cookie string from remoterocketship.com (look for `sb-access-token` + `sb-refresh-token`). Store it via `rr.save_session_cookie { "value": "<cookie string>" }`; the tools will reuse it automatically.

---

## Scheduled Checks (Optional)

After onboarding (or after the first successful search), offer:

> “Do you want me to check for new matching jobs on a schedule (e.g. every hour), and message you when I find new ones?”

If yes:
- Ask: “How often should I check? (hourly, every 2 hours, daily, etc.)”
- Create/enable a cron job that re-runs the last saved search filters.
- Only notify when new jobs appear (dedupe by job id/url).
- Keep notifications concise (e.g. top 5 + “want more?”).

If no: do nothing.

---

## Fetching Jobs

### Default behavior
- Fetch 20 jobs by default (`itemsPerPage: 20`).
- Max 50 if user explicitly asks for more per batch.

---

## Pagination & Result Flow (Natural Language)

Keep a lightweight conversation state object:
- filters
- page
- itemsPerPage
- totalCount

Rules:
1) When the user tweaks filters, reset `page` back to 1 and fetch again.
2) If they say “more”, “send 20 more”, “next page”, increment `page` and rerun the last search with cached filters.
3) If they say “go back”, decrement `page` (floor at 1) and fetch.
4) Always mention the range shown (e.g., “Showing 21–40 of 134”) so they know how many remain.
5) When `pagination.hasNextPage` is false, tell the user you’ve reached the end (and optionally suggest adjusting filters).

Example state payload stored between turns:
```json
{
  "filters": {
    "jobTitleFilters": ["Software Engineer"],
    "locationFilters": ["Worldwide"],
    "itemsPerPage": 20
  },
  "page": 1,
  "totalCount": 134
}
```

API pagination notes:
- Every `rr.jobs` response includes `pagination` with:
  `{ page, itemsPerPage, totalCount, totalPages, hasNextPage, hasPreviousPage }`
- Defaults: `page: 1`, `itemsPerPage: 20` (cap 50).
- Always pass integers; reject/ignore anything else.
- Use `pagination.hasNextPage` to decide whether to offer another fetch, and mention `pagination.totalCount`.

---

## Ranking Options

Ask once (and remember):
- “Do you want results ranked by best fit or newest first?”

### A) Newest first
Sort by postedAt descending (or the closest available timestamp).

### B) Best fit (simple, explainable scoring)
Compute a fit score per job using:
- Title match (0–40)
- Must-have alignment (0–25)
- Deal-breakers penalty (0 to -40)
- Resume keyword alignment (0–35, only if resume provided)

Then:
- Sort by score desc
- Optionally show “⭐ Fit 82/100”
- If asked “why is this a fit?”, give 2–4 bullet reasons.

Resume privacy: resume is never sent to external services; only used locally by the agent for matching.

---

## Tools (Internal)

The agent may call these tools; do not present them as things the user must type:

- `rr.jobs`
- `rr.save_api_key`
- `rr.save_session_cookie`
- `rr.clear_api_key`
- `rr.clear_session_cookie`
- `rr.get_last_search`
- `rr.schedule_checks`
- `rr.key_status`
- `rr.generate_key`
- `rr.rotate_key`
- `rr.revoke_key`

### Tool parameters & secrets
- `rr.jobs` **requires** `filters` plus an RR API key. If the user already pasted it, the tool grabs the stored value automatically; otherwise it returns `{ "error": "MISSING_API_KEY" }` so you can ask again. You can still pass `apiKey` explicitly for overrides.
- `rr.schedule_checks` takes `cadence` (hourly/6h/12h/daily/off) and writes the appropriate cron job + monitoring metadata. When it succeeds it returns `{ scheduled: true, jobId, systemEvent }`. Tell the user the plan (“I’ll check every 6h”). Passing `cadence: "off"` cancels monitoring.
- `rr.generate_key`, `rr.rotate_key`, `rr.revoke_key`, and `rr.key_status` require the user’s authenticated cookie string. Save it once via `rr.save_session_cookie` (ask the user to copy the cookie header with `sb-access-token` + `sb-refresh-token`).
- All tools accept an optional `baseUrl` override if you run a staging RR deployment.

---

## Filter Hygiene

Before calling `/api/openclaw/jobs`, sanitize the payload:
- Job titles: map to canonical options (case-insensitive; trims whitespace).
- Locations: only allow known values; normalize common aliases (USA/US → United States, UK/Great Britain/England → United Kingdom, UAE → United Arab Emirates). Drop unknown entries.
- Enums: seniority, employment type, visa, companySize, requiredLanguages, industries must match allowed dropdown options; ignore invalid values.
- Limits: `itemsPerPage` default 20, max 50. `page` starts at 1.

---

## Response Template (RR tone)

```
**{job.title}** at {job.company.name}
🗓 {timeAgo} · 📍 {location/flag emojis} · 💰 {salaryLabel}{optional chips: ✈️ visa, 🎯 seniority}{optional: ⭐ Fit {fitScore}/100}
{summary line 1}
{summary line 2}
```

Guidelines:
- Concise, friendly, light emoji flair.
- If salary missing: “Salary undisclosed”.
- If `requestCountToday ≥ 800`, add a brief quota reminder.
- `rr.jobs` responses include `newJobOpenings` (jobs not seen in the last call) and `stats.newCount`; use those for “only tell me when there’s something new”.

---

## Rate Limits & Error Handling

| Status | Meaning | Agent Guidance |
| --- | --- | --- |
| 401 | Missing/invalid API key | Ask user to paste the key, store it via `rr.save_api_key`, then rerun `rr.jobs`. |
| 403 | Subscription inactive | Tell user they need an active Remote Rocketship plan to fetch jobs. |
| 429 | Daily request limit exceeded | Inform quota resets daily (1,000 calls). Suggest waiting; rotate key only if appropriate. |
| 5xx | Backend issue | Apologize, retry with exponential backoff, escalate if persistent. |

---

## Allowed Values
(keep your existing lists below: jobTitleFilters, locationFilters, seniorityFilters, etc.)
### Allowed Values
## Monitoring & Logging
- Backend emits `console.warn` events for `request_received` / `request_success` – keep them enabled for debugging.
- PostHog captures `openclaw_jobs_request` with `{ email, filters, jobsReturned, requestCountToday, techStackFilters, industriesFilters }`.
- Future alerting ideas: notify the RR team when `requestCountToday ≥ 800` for a key, and when 5-minute rolling error rate exceeds 20%.

- **jobTitleFilters** (201 values):
```json
[
  "2D Artist",
  "3D Artist",
  "AI Engineer",
  "AI Research Scientist",
  "Account Executive",
  "Account Manager",
  "Accountant",
  "Accounting Manager",
  "Accounts Payable",
  "Accounts Receivable",
  "Actuary",
  "Administration",
  "Administrative Assistant",
  "Affiliate Manager",
  "Analyst",
  "Analytics Engineer",
  "Android Engineer",
  "Application Engineer",
  "Appointment Setter",
  "Architect",
  "Art Director",
  "Artificial Intelligence",
  "Attorney",
  "Auditor",
  "Backend Engineer",
  "Bilingual",
  "Billing Specialist",
  "Blockchain Engineer",
  "Bookkeeper",
  "Brand Ambassador",
  "Brand Designer",
  "Brand Manager",
  "Business Analyst",
  "Business Development Rep",
  "Business Intelligence Analyst",
  "Business Intelligence Developer",
  "Business Operations",
  "Call Center Representative",
  "Capture Manager",
  "Chief Marketing Officer",
  "Chief Operating Officer",
  "Chief Technology Officer",
  "Chief of Staff",
  "Civil Engineer",
  "Claims Specialist",
  "Client Partner",
  "Client Services Representative",
  "Clinical Operations",
  "Clinical Research",
  "Cloud Engineer",
  "Collections",
  "Communications",
  "Community Manager",
  "Compliance",
  "Computer Vision Engineer",
  "Consultant",
  "Content Creator",
  "Content Manager",
  "Content Marketing Manager",
  "Content Writer",
  "Controller",
  "Conversion Rate Optimizer",
  "Copywriter",
  "Counselor",
  "Creative Strategist",
  "Crypto",
  "Customer Advocate",
  "Customer Retention Specialist",
  "Customer Success Manager",
  "Customer Support",
  "Data Analyst",
  "Data Engineer",
  "Data Entry",
  "Data Scientist",
  "Database Administrator",
  "DeFi",
  "Designer",
  "DevOps Engineer",
  "Developer Relations",
  "Digital Marketing",
  "Director",
  "Ecommerce",
  "Electrical Engineer",
  "Email Marketing Manager",
  "Engineer",
  "Engineering Manager",
  "Events",
  "Executive Assistant",
  "Field Engineer",
  "Financial Crime",
  "Financial Planning and Analysis",
  "Frontend Engineer",
  "Full-stack Engineer",
  "Game Engineer",
  "General Counsel",
  "Graphics Designer",
  "Growth Marketing",
  "Hardware Engineer",
  "Human Resources",
  "IT Support",
  "Implementation Specialist",
  "Incident Response Analyst",
  "Influencer Marketing",
  "Infrastructure Engineer",
  "Inside Sales",
  "Insurance",
  "Journalist",
  "LLM Engineer",
  "Lead Generation",
  "Learning and Development",
  "Legal Assistant",
  "Machine Learning Engineer",
  "Manager",
  "Marketing",
  "Marketing Analyst",
  "Marketing Operations",
  "Mechanical Engineer",
  "Medical Billing and Coding",
  "Medical Director",
  "Medical Reviewer",
  "Medical writer",
  "NLP Engineer",
  "Network Engineer",
  "Network Operations",
  "Notary",
  "Onboarding Specialist",
  "Operations",
  "Outside Sales",
  "Paralegal",
  "Payroll",
  "People Operations",
  "Performance Marketing",
  "Platform Engineer",
  "Pre-sales Engineer",
  "Pricing Analyst",
  "Procurement",
  "Producer",
  "Product Adoption Specialist",
  "Product Analyst",
  "Product Designer",
  "Product Manager",
  "Product Marketing",
  "Product Operations",
  "Product Specialist",
  "Production Engineer",
  "Program Manager",
  "Project Manager",
  "Proposal Manager",
  "Public Relations",
  "QA Automation Engineer",
  "QA Engineer",
  "Recruitment",
  "Research Analyst",
  "Research Engineer",
  "Research Scientist",
  "Revenue Operations",
  "Risk",
  "Robotics",
  "SAP",
  "SDET",
  "SEO Marketing",
  "Sales",
  "Sales Development Rep",
  "Sales Engineer",
  "Sales Operations Manager",
  "Salesforce Administrator",
  "Salesforce Analyst",
  "Salesforce Consultant",
  "Salesforce Developer",
  "Scrum Master",
  "Security Analyst",
  "Security Engineer",
  "Security Operations",
  "ServiceNow",
  "Smart Contract Engineer",
  "Social Media Manager",
  "Software Engineer",
  "Solutions Engineer",
  "Strategy",
  "Supply Chain",
  "Support Engineer",
  "System Administrator",
  "Systems Engineer",
  "Tax",
  "Technical Account Manager",
  "Technical Customer Success",
  "Technical Product Manager",
  "Technical Program Manager",
  "Technical Project Manager",
  "Technical Recruiter",
  "Technical Writer",
  "Therapist",
  "Threat Intelligence Specialist",
  "Translator",
  "Underwriter",
  "User Researcher",
  "Vice President",
  "Video Editor",
  "Web Designer",
  "Web3",
  "iOS Engineer"
]
```
- **locationFilters** (182 values):
```json
[
  "Africa",
  "Alabama",
  "Alaska",
  "Albania",
  "Algeria",
  "American Samoa",
  "Argentina",
  "Arizona",
  "Arkansas",
  "Armenia",
  "Aruba",
  "Asia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Bermuda",
  "Bosnia and Herzegovina",
  "Brazil",
  "Bulgaria",
  "California",
  "Canada",
  "Cape Verde",
  "Chile",
  "Colombia",
  "Colorado",
  "Connecticut",
  "Costa Rica",
  "Croatia",
  "Curaçao",
  "Cyprus",
  "Czech",
  "Delaware",
  "Denmark",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Estonia",
  "Ethiopia",
  "Europe",
  "Finland",
  "Florida",
  "France",
  "Georgia",
  "Germany",
  "Ghana",
  "Gibraltar",
  "Greece",
  "Greenland",
  "Guam",
  "Guatemala",
  "Guernsey",
  "Hawaii",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "Idaho",
  "Illinois",
  "India",
  "Indiana",
  "Indonesia",
  "Iowa",
  "Ireland",
  "Isle of Man",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jersey",
  "Jordan",
  "Kansas",
  "Kazakhstan",
  "Kentucky",
  "Kenya",
  "Latin America",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Louisiana",
  "Luxembourg",
  "Macedonia",
  "Madagascar",
  "Maine",
  "Malaysia",
  "Maldives",
  "Malta",
  "Maryland",
  "Massachusetts",
  "Mauritius",
  "Mexico",
  "Michigan",
  "Middle East",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Moldova",
  "Monaco",
  "Montana",
  "Montenegro",
  "Morocco",
  "Namibia",
  "Nebraska",
  "Netherlands",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "New Zealand",
  "Nicaragua",
  "Nigeria",
  "North America",
  "North Carolina",
  "North Dakota",
  "Norway",
  "Oceania",
  "Ohio",
  "Oklahoma",
  "Oman",
  "Oregon",
  "Pakistan",
  "Palau",
  "Palestinian Territory",
  "Panama",
  "Paraguay",
  "Pennsylvania",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Qatar",
  "Rhode Island",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Serbia",
  "Seychelles",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Carolina",
  "South Dakota",
  "South Georgia",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Suriname",
  "Swaziland",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tennessee",
  "Texas",
  "Thailand",
  "Trinidad and Tobago",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Worldwide",
  "Wyoming"
]
```
- **seniorityFilters** (5 values):
```json
[
  "entry-level",
  "expert",
  "junior",
  "mid",
  "senior"
]
```
- **employmentTypeFilters** (4 values):
```json
[
  "contract",
  "full-time",
  "internship",
  "part-time"
]
```
- **visaFilter** (2 values):
```json
[
  "h1b",
  "uk-skilled-worker"
]
```
- **companySizeFilters** (8 values):
```json
[
  "1,10",
  "10001,",
  "1001,5000",
  "11,50",
  "201,500",
  "5001,10000",
  "501,1000",
  "51,200"
]
```
- **requiredLanguagesFilters** (29 values):
```json
[
  "ar",
  "cs",
  "da",
  "de",
  "en",
  "es",
  "fi",
  "fr",
  "he",
  "hi",
  "hu",
  "id",
  "is",
  "it",
  "ja",
  "ko",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh"
]
```
- **industriesFilters** (44 values):
```json
[
  "API",
  "AR/VR",
  "Aerospace",
  "Agriculture",
  "Artificial Intelligence",
  "B2B",
  "B2C",
  "Banking",
  "Beauty",
  "Biotechnology",
  "Charity",
  "Compliance",
  "Crypto",
  "Cybersecurity",
  "Education",
  "Energy",
  "Enterprise",
  "Fashion",
  "Finance",
  "Fintech",
  "Gambling",
  "Gaming",
  "Government",
  "HR Tech",
  "Hardware",
  "Healthcare Insurance",
  "Marketplace",
  "Media",
  "Non-profit",
  "Pharmaceuticals",
  "Productivity",
  "Real Estate",
  "Recruitment",
  "Retail",
  "SaaS",
  "Science",
  "Security",
  "Social Impact",
  "Sports",
  "Telecommunications",
  "Transport",
  "Web 3",
  "Wellness",
  "eCommerce"
]
```

_Note: `excludeRequiredLanguagesFilters` uses the same codes as `requiredLanguagesFilters`._

## Response Template
```
**{job.title}** at {job.company.name}
🗓 {timeAgo} · 📍 {location/flag emojis} · 💰 {salaryLabel}{optional chips: ✈️ visa, 🎯 seniority}
{summary line 1}
{summary line 2}
```
- Use RR tone: concise, friendly, light emoji flair.
- If salary missing, say “Salary undisclosed”.
- Append quota reminders when `requestCountToday ≥ 800`.
- Highlight `stats.newCount` and the `newJobOpenings` array whenever you’re running a scheduled check so the user sees what changed.

## Rate Limits & Error Handling
| Status | Meaning | Agent Guidance |
| --- | --- | --- |
| 401 | Missing/invalid API key (includes revoked or never created) | Ask user to paste a valid key, save it via `rr.save_api_key`, then retry `rr.jobs`. |
| 403 | Subscription inactive | Prompt user to renew their Remote Rocketship plan (`/sign-up`) before retrying. |
| 429 | Daily request limit exceeded | Inform user the quota resets daily (1,000 calls). Suggest waiting or rotating the key if abuse is suspected. |
| 5xx | Backend issue | Apologize, retry with exponential backoff, and escalate if the issue persists. |

## Usage Flow
1. **Key provisioning** – ask what key they want to use (or call `rr.generate_key`), then immediately run `rr.save_api_key { "value": "<plaintext>" }` so the WhatsApp chat remembers it.
2. **Fetch jobs** – collect filters, call `rr.jobs { "filters": { ... } }`, render cards, and mention quota usage when `requestCountToday ≥ 800`.
3. **Lifecycle ops** – `rr.save_session_cookie` once, then call `rr.key_status` / `rr.rotate_key` / `rr.revoke_key` as needed (new keys are auto-saved).
4. **Monitoring** – when the user says “check every X”, call `rr.schedule_checks { "cadence": "hourly|6h|12h|daily|off" }`. The tool writes/removes the cron job and returns `{ jobId, systemEvent }`. Confirm the plan (“cool, I’ll check every 6h”).

## Pagination & Result Flow
## Conversational Pagination Tips
1. Keep a lightweight conversation state object (filters, page, itemsPerPage, totalCount).
2. When the user tweaks filters, reset `page` back to 1 and fetch again.
3. If they say “more”, increment `page` and replay the last command with the cached filters.
4. If they say “go back”, decrement `page` (floor at 1).
5. When `pagination.hasNextPage` is false, tell the user you’ve reached the end.
6. Always mention the range shown (e.g., “Showing 21–40 of 134”) so they know how many remain.

Example state payload stored between turns:
```json
{
  "filters": {
    "jobTitleFilters": ["Software Engineer"],
    "locationFilters": ["Worldwide"],
    "itemsPerPage": 20
  },
  "page": 1,
  "totalCount": 134
}
```
Use this blob to reconstruct the next `rr.jobs` call without asking the user to repeat their filters.
Tip: If the user returns after a while (or a cron reminder fires), call `rr.get_last_search` to pull these saved filters before running `rr.jobs` again.

- Every `rr.jobs` response now includes `pagination` with `{ page, itemsPerPage, totalCount, totalPages, hasNextPage, hasPreviousPage }`.
- Default is `page: 1`, `itemsPerPage: 20` (cap 50). Always pass integers; reject/ignore anything else.
- When a user asks for "more" results with the same filters, increment `page` and rerun `rr.jobs`. Reset `page` back to 1 any time filters change.
- Use `pagination.hasNextPage` to decide whether to offer another fetch, and mention `totalCount` so the user knows how many jobs exist.

**Example follow-up call:**
```
rr.jobs {
  "filters": {
    "jobTitleFilters": ["Software Engineer"],
    "locationFilters": ["Worldwide"],
    "page": 2,
    "itemsPerPage": 20
  }
}
```

## Workflow Cheat Sheet
1. **Provision key** (if needed):
   - Ask the user to paste their RR API key and run `rr.save_api_key { "value": "<pasted>" }`.
   - If they want you to rotate/generate keys later, capture the cookie once via `rr.save_session_cookie { "value": "<cookie>" }`.
2. **Fetch jobs:**
   - Call `rr.jobs { "filters": { ... } }` (page/itemsPerPage optional). The tool loads the stored key automatically and returns pagination metadata + the jobs array.
   - Render cards via the template above and mention “Showing X–Y of Z (say ‘more’ for the next page)”.
3. **Rotate / revoke** when requested:
   - Use `rr.key_status`, `rr.generate_key`, `rr.rotate_key`, or `rr.revoke_key` (all require the stored cookie and re-save any new API key automatically).

## Scheduled Checks & Cron
1. After a successful `rr.jobs` call, the tool saves filters/itemsPerPage for this chat automatically. When the user opts into monitoring, run `rr.schedule_checks { "cadence": "hourly|6h|12h|daily|off" }`. It writes the cron job for you and returns `{ jobId, systemEvent }` — confirm the cadence out loud.
2. The cron job enqueues a system event that looks like `RR_CHECK:<jobId>`. When you see a system message starting with `RR_CHECK`, immediately call `rr.get_last_search` to reload the filters and then run `rr.jobs` again.
3. Use the returned `stats.newCount` and `newJobOpenings` arrays to decide whether to notify the user. Only DM when `newCount > 0` and show the top 3–5 new roles (“reply ‘more’ for the full batch”).
4. If the user says “stop monitoring”, call `rr.schedule_checks { "cadence": "off" }`. That removes the cron job and clears the monitoring state.
5. Advanced overrides: if you really need a custom cadence, pass `everyMs` (>= 60000).

### Handling `RR_CHECK` events
- Cron jobs send a system event shaped like `RR_CHECK:<jobId>`. When you see it, reply in the same thread even if the user hasn’t said anything.
- Call `rr.get_last_search`, run `rr.jobs`, and DM only the new roles (`stats.newCount > 0`).
- If `newCount = 0`, acknowledge quietly (“no fresh roles since the last check”).

## Sample Agent Copy
> “🪐 Pulled 20 fresh roles. Reminder: your RR API plan allows 1,000 calls/day and you’ve used 610 so far.”

## QA Checklist
- 401/403/429 paths return the correct guidance message.
- Reject `itemsPerPage > 50` before calling the API.
- Ensure job cards follow the RR template (bold title, emoji metadata, two-line summary).
- Verify `.env` secret storage and key rotation flows manually.