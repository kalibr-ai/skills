# OpenClaw

OpenClaw provides skills and instructions for integrating with the **FlowFi** backend API. Use it when you need to call FlowFi workflows, smart accounts, or auth endpoints (e.g. from an agent or external client).

## How it works

- The **user** generates a JWT (e.g. via the FlowFi app or auth flow) and sends it to OpenClaw.
- OpenClaw uses that token in the `Authorization: Bearer <token>` header for all FlowFi API requests.

## Capabilities

- **Smart accounts** — List and get smart accounts; use an account `id` as `smartAccountId` when creating workflows.
- **Workflows** — Generate a workflow from a prompt, get edit suggestions, edit by prompt, deploy, and undeploy.
- **Auth** — Long-lived bearer tokens and revoke (sign-in is done by the user outside OpenClaw).

## API reference

Full REST API details, request/response shapes, and example prompts are in **[SKILL.md](SKILL.md)**.

Quick reference:

| Action            | Method | Endpoint                        |
|-------------------|--------|----------------------------------|
| List smart accounts | GET  | `/smart-accounts`               |
| Generate workflow | POST   | `/ai/generate-workflow`         |
| Get suggestions   | GET    | `/ai/workflow/:id/suggestions`   |
| Edit by prompt    | POST   | `/ai/workflow/:id/prompt`        |
| Deploy            | POST   | `/workflows/:id/deploy`          |
| Undeploy          | POST   | `/workflows/:id/undeploy`        |

Base URL is your FlowFi backend (e.g. `https://api.flowfi.com`).
