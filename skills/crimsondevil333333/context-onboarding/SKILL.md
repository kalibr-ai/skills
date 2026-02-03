---
name: context-onboarding
description: Provide new contributors and agents with a concise tour of the workspace identity files (SOUL.md, USER.md, AGENTS.md, TOOLS.md) plus onboarding tips. Use when a newcomer needs context or when you want to double-check how this workspace is configured.
---

# Context Onboarding

## When to use this skill

- You're guiding someone new through Clawdy/Clawd and want a quick summary of the personality, operating rules, and per-skill notes.
- You need to remind yourself of the tone preferences or tooling constraints without reading every document top to bottom.

## What it does

- `scripts/context_onboarding.py` reads the key documents (`SOUL.md`, `USER.md`, `AGENTS.md`, `TOOLS.md` by default) and prints the first few lines of each so you can skim character, rules, and tooling notes.
- The CLI supports `--files` to include additional documents, `--lines` to control how many lines are shown per file, and `--brief` to emit only the opening sentence of each section.
- Use `references/context-guidelines.md` when you need more guidance about what newcomers should read next or how to keep the vibe consistent.

## References

- `references/context-guidelines.md` documents onboarding topics, role expectations, cadence notes, and reminders for how this group runs.

## Resources

- **GitHub:** https://github.com/CrimsonDevil333333/context-onboarding
- **ClawHub:** https://www.clawhub.ai/skills/context-onboarding
