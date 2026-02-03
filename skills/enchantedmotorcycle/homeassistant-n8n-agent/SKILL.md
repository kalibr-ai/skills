---
name: homeassistant-n8n-agent
description: Bridge OpenClaw with your n8n instance for Home Assistant automation.
homepage: https://n8n.io/
metadata: {"clawdis":{"emoji":"🤖","requires":{"bins":["mcporter"]}}}
---

# Home‑Assistant – n8n Agent Skill
This skill bridges OpenClaw with your n8n instance for Home Assistant automation.

# How it works
It uses the built‑in mcporter skill to call the `n8n_dispatch` service with 2 arguments, `requestType`, and `text`.

# Steps
Determine whether the user's prompt is an IoT inquiry.
1. Is the inquiry about a current device state or multiple states?  If so, `requestType` is `state`
2. Is the inquiry asking for a device state to be changed?  If so, `requestType` is `action`
3. Is the inquiry asking about IoT data from the past?  If so, `requestType` is `historical`.

## Quick Reference

### Action
```bash
mcporter call n8n_dispatch.call_n8n_agent requestType:action  text:"Turn on the hallway lights"
mcporter call n8n_dispatch.call_n8n_agent requestType:action  text:"Change the downstairs thermostat to 72"
```

### Historical
```bash
mcporter call n8n_dispatch.call_n8n_agent requestType:historical text:"when was the front door last opened?"
```

### State
```bash
mcporter call n8n_dispatch.call_n8n_agent requestType:state  text:"is the office light on?"
```