---
name: flowfi
description: REST API instructions for FlowFi workflow operations—authorization, smart accounts, generate-workflow, get suggestions, edit by prompt, deploy, undeploy, and draft workflows. Use when integrating with the backend API or when the user asks about workflow or auth endpoints.
---

# Workflow REST API

Instructions for FlowFi REST endpoints. Base URL is the backend API root (e.g. `https://api.example.com`). Workflow and smart-account endpoints require **JWT** (see Authorization).

# Capabilities

Examples of what you can do with the API:

- **List smart accounts** — `GET /smart-accounts` to get the user’s smart accounts, then use an `id` as `smartAccountId` when generating workflows.
- **Generate a workflow from a prompt** — `POST /ai/generate-workflow` with `{ "prompt": "Alert me when ETH > 3000", "smartAccountId": "..." }` to create a new draft workflow.
- **Get edit suggestions** — `GET /ai/workflow/:id/suggestions` to receive a few short AI suggestions (e.g. “Add a delay”, “Add a notification”).
- **Edit a workflow by prompt** — `POST /ai/workflow/:id/prompt` with `{ "prompt": "Add a 5 second delay before the notification" }` to change an existing draft workflow.
- **Deploy a workflow** — `POST /workflows/:id/deploy` to make a draft workflow active and runnable.
- **Undeploy a workflow** — `POST /workflows/:id/undeploy` to stop it and set it back to draft so it can be edited.

# Example prompts

**Generate workflow** (`POST /ai/generate-workflow` body `prompt`):

- "When ETH price goes above 3500, send me a Telegram message"
- "Every day at 9am, check Uniswap for WETH/USDC and post the price to Discord"
- "If gas is below 20 gwei, run a swap on Uniswap and notify me on Telegram"

**Edit workflow** (`POST /ai/workflow/:id/prompt` body `prompt`):

- "Add a 10 second delay after the price check"
- "Change the threshold to 4000"
- "Add an email notification when the workflow runs"

---

## Authorization

The user generates a JWT (e.g. via the app) and sends it to OpenClaw. Use that token for all API calls below.

**Long-lived API token (bearer):** **POST** `/auth/bearer-token`  
Requires existing JWT in `Authorization: Bearer <token>`.

| Field              | Type   | Required | Description        |
|--------------------|--------|----------|--------------------|
| `expiresInSeconds` | number | yes      | 60–31536000 (1 yr) |

Response: new JWT to use as `Authorization: Bearer <token>` for API clients.

**Revoke all bearer tokens:** **POST** `/auth/bearer-token/revoke` (with JWT). Session sign-in tokens are not affected.

**Using the token:** For all protected routes, send header:  
`Authorization: Bearer <your-jwt>`.

---

## Getting smart accounts

**List smart accounts:** **GET** `/smart-accounts`  
Requires JWT. Returns smart accounts for the authenticated user. Supports pagination: `page`, `limit`, `sortBy`, `sortOrder`, `search` (query params).

**Get one smart account:** **GET** `/smart-accounts/:id`  
Requires JWT. User must own the smart account.

**Get workflow count for a smart account:** **GET** `/smart-accounts/:id/workflows/count`  
Response: `{ "count": number }`.

Use a smart account `id` from these endpoints as `smartAccountId` when calling `POST /ai/generate-workflow` or creating workflows.

---

## Generate workflow

**POST** `/ai/generate-workflow`

Creates a new workflow from a natural-language prompt using AI. The workflow is created in the database with status **draft**.

**Request body (JSON):**

| Field           | Type   | Required | Description                          |
|----------------|--------|----------|--------------------------------------|
| `prompt`       | string | yes      | User description of the workflow     |
| `smartAccountId` | string | yes    | Smart account ID to attach           |

**Example:**

```json
{
  "prompt": "When ETH price drops below 2000, send a Telegram notification",
  "smartAccountId": "0x..."
}
```

**Response:** `200` — workflow object with `id`, `name`, `nodes`, `connections`.

---

## Get workflow suggestions

**GET** `/ai/workflow/:id/suggestions`

Returns AI-generated edit suggestions for a workflow (e.g. four short actionable edit ideas). Used by “Edit workflow with AI” UI.

**Path:** `id` = workflow ID (owner must match authenticated user).

**Response:** `200` — `{ "suggestions": string[] }` (e.g. 4 suggestion strings).

---

## Edit workflow by prompt

**POST** `/ai/workflow/:id/prompt`

Edits an existing workflow using a natural-language prompt. Updates name, nodes, connections, and variables. Workflow must be **draft** (undeploy first if deployed).

**Path:** `id` = workflow ID.

**Request body (JSON):**

| Field   | Type   | Required | Description                    |
|--------|--------|----------|--------------------------------|
| `prompt` | string | yes     | Edit instruction (e.g. “Add a 5s delay”) |

**Response:** `200` — `{ "message": string, "workflow": Workflow }`.

---

## Deploy workflow

**POST** `/workflows/:id/deploy`

Deploys a workflow so it can run (schedule/triggers). Workflow must be **draft** or **ended**; must have a smart account assigned.

**Path:** `id` = workflow ID.

**Response:** `200` — updated workflow (e.g. `status: 'active'`).

**Errors:** `400` if already deployed or missing smart account.

---

## Undeploy workflow

**POST** `/workflows/:id/undeploy`

Stops a deployed workflow and sets status back to **draft**. Required before editing a deployed workflow.

**Path:** `id` = workflow ID.

**Response:** `200` — updated workflow (`status: 'draft'`).

**Errors:** `400` if workflow is not deployed (e.g. already draft or archived).

---

## Draft workflows

- **Creating a draft:** `POST /ai/generate-workflow` and `POST /workflows` both create workflows with status **draft**.
- **Listing drafts:** `GET /workflows?status=draft` (optional query).
- **Editing:** Only draft (or ended) workflows can be edited. Use `POST /ai/workflow/:id/prompt` or `PATCH /workflows/:id` for draft workflows.
- **Deploy:** When ready, call `POST /workflows/:id/deploy` to move from draft to active.

---

## Summary

| Action                | Method | Endpoint                              |
|-----------------------|--------|----------------------------------------|
| Bearer token          | POST   | `/auth/bearer-token`                   |
| List smart accounts   | GET    | `/smart-accounts`                      |
| Get smart account     | GET    | `/smart-accounts/:id`                  |
| Workflow count        | GET    | `/smart-accounts/:id/workflows/count`  |
| Generate workflow     | POST   | `/ai/generate-workflow`                |
| Get suggestions       | GET    | `/ai/workflow/:id/suggestions`         |
| Edit by prompt        | POST   | `/ai/workflow/:id/prompt`              |
| Deploy                | POST   | `/workflows/:id/deploy`                |
| Undeploy              | POST   | `/workflows/:id/undeploy`              |

Protected routes require `Authorization: Bearer <jwt>`. User is inferred from JWT; workflow and smart-account ownership is enforced by `smartAccountAddress` / `userId`.
