---
name: linear-todos
description: Manage todos and reminders using Linear as the backend. Create tasks with natural language dates ("tomorrow", "next Monday"), priorities, and smart scheduling. Includes daily review and CLI tools for complete todo workflow.
author: K
tags: [todos, linear, tasks, reminders, productivity]
---

# Linear Todos

A powerful todo management system built on Linear with smart date parsing, priorities, and a complete CLI workflow.

## Quick Start

```bash
# Setup (run once)
uv run python main.py setup

# Create todos
uv run python main.py create "Call mom" --when day
uv run python main.py create "Pay taxes" --date 2025-04-15
uv run python main.py create "Review PR" --priority high --when week

# Natural language dates
uv run python main.py create "Meeting prep" --date "tomorrow"
uv run python main.py create "Weekly report" --date "next Monday"
uv run python main.py create "Dentist" --date "in 3 days"

# Manage todos
uv run python main.py list
uv run python main.py done ABC-123
uv run python main.py snooze ABC-123 "next week"

# Daily review
uv run python main.py review
```

## Setup

### 1. Get API Key

Get your API key from [linear.app/settings/api](https://linear.app/settings/api)

### 2. Run Setup

```bash
uv run python main.py setup
```

This interactive wizard will:
- Verify your API key
- List your Linear teams
- Let you select your todo team
- Configure initial and done states
- Save settings to `~/.config/linear-todos/config.json`

### 3. Manual Configuration (optional)

Instead of running setup, you can use environment variables:

```bash
export LINEAR_API_KEY="lin_api_..."
export LINEAR_TEAM_ID="your-team-id"
export LINEAR_STATE_ID="your-todo-state-id"
export LINEAR_DONE_STATE_ID="your-done-state-id"
```

Or create `~/.config/linear-todos/config.json`:

```json
{
  "apiKey": "lin_api_...",
  "teamId": "team-uuid",
  "stateId": "todo-state-uuid",
  "doneStateId": "done-state-uuid"
}
```

## Commands

### create

Create a new todo with optional timing, priority, and description.

```bash
uv run python main.py create "Title" [options]

Options:
  --when day|week|month     Relative due date
  --date DATE               Specific due date (supports natural language)
  --priority LEVEL          urgent, high, normal, low, none
  --desc "Description"      Add description
```

**Natural Date Examples:**

```bash
uv run python main.py create "Task" --date "tomorrow"
uv run python main.py create "Task" --date "Friday"
uv run python main.py create "Task" --date "next Monday"
uv run python main.py create "Task" --date "in 3 days"
uv run python main.py create "Task" --date "in 2 weeks"
uv run python main.py create "Task" --date "2025-04-15"
```

**Complete Examples:**

```bash
# Due by end of today
uv run python main.py create "Call mom" --when day

# Due in 7 days
uv run python main.py create "Submit report" --when week

# Specific date with high priority
uv run python main.py create "Launch feature" --date 2025-03-15 --priority high

# Natural language date with description
uv run python main.py create "Team meeting prep" --date "next Monday" --desc "Prepare slides"

# Urgent priority, due tomorrow
uv run python main.py create "Fix production bug" --priority urgent --date tomorrow
```

### list

List all your todos.

```bash
uv run python main.py list [options]

Options:
  --all       Include completed todos
  --json      Output as JSON
```

### done

Mark a todo as completed.

```bash
uv run python main.py done ISSUE_ID

# Examples
uv run python main.py done TODO-123
uv run python main.py done ABC-456
```

### snooze

Reschedule a todo to a later date.

```bash
uv run python main.py snooze ISSUE_ID [when]

# Examples
uv run python main.py snooze TODO-123 "tomorrow"
uv run python main.py snooze TODO-123 "next Friday"
uv run python main.py snooze TODO-123 "in 1 week"
```

### review

Daily review command that organizes todos by urgency.

```bash
uv run python main.py review
```

Output sections:
- 🚨 **OVERDUE** - Past due date
- 📅 **Due Today** - Due today
- ⚡ **High Priority** - Urgent/high priority items
- 📊 **This Week** - Due within 7 days
- 📅 **This Month** - Due within 28 days
- 📝 **No Due Date** - Items without dates

### setup

Interactive setup wizard to configure your Linear integration.

```bash
uv run python main.py setup
```

This will guide you through:
- Verifying your API key
- Selecting your Linear team
- Configuring initial and done states
- Saving settings to `~/.config/linear-todos/config.json`

## For Agents

When the user asks for reminders or todos:

### 1. Parse Natural Language Dates

Convert user input to specific dates:

```bash
# "remind me Friday to call mom"
uv run python main.py create "Call mom" --date "2025-02-21"

# "remind me to pay taxes by April 15"
uv run python main.py create "Pay taxes" --date "2025-04-15"

# "remind me next week about the meeting"
uv run python main.py create "Meeting" --date "next Monday"
```

### 2. Determine Priority

Ask if not specified:
- **Urgent** (🔥) - Critical, do immediately
- **High** (⚡) - Important, do soon
- **Normal** (📌) - Standard priority (default)
- **Low** (💤) - Can wait

### 3. Daily Briefing

When asked "what do I have to do today", run:

```bash
uv run python main.py review
```

Present the output **exactly as formatted** - don't reformat or summarize.

### 4. Complete Todos

When user says they completed something, mark it done:

```bash
uv run python main.py done ISSUE-123
```

## Date Parsing Reference

| Input | Result |
|-------|--------|
| `today` | Today |
| `tomorrow` | Next day |
| `Friday` | Next occurrence of Friday |
| `next Monday` | Monday of next week |
| `this Friday` | Friday of current week (or next if passed) |
| `in 3 days` | 3 days from now |
| `in 2 weeks` | 14 days from now |
| `2025-04-15` | Specific date |

## Priority Levels

| Level | Number | Icon | Use For |
|-------|--------|------|---------|
| Urgent | 1 | 🔥 | Critical, blocking issues |
| High | 2 | ⚡ | Important, time-sensitive |
| Normal | 3 | 📌 | Standard tasks (default) |
| Low | 4 | 💤 | Nice-to-have, can wait |
| None | 0 | 📋 | No priority set |

## Configuration Precedence

Settings are loaded in this order (later overrides earlier):

1. Default values (none)
2. Config file: `~/.config/linear-todos/config.json`
3. Environment variables: `LINEAR_*`
4. Command-line flags: `--team`, `--state`

## Files

| File | Purpose |
|------|---------|
| `main.py` | Main entry point for the CLI |
| `src/linear_todos/cli.py` | CLI implementation with all commands |
| `src/linear_todos/api.py` | Linear API client |
| `src/linear_todos/config.py` | Configuration management |
| `src/linear_todos/dates.py` | Date parsing utilities |
| `src/linear_todos/setup_wizard.py` | Interactive setup wizard |
