# Linear Todos

A complete todo management system built on Linear with smart date parsing, priorities, and CLI tools.

## Quick Start

```bash
cd skills/linear-todos
uv sync                    # Install dependencies
uv run python main.py setup  # Configure Linear integration
uv run python main.py create "My first todo" --when day
```

## Features

- 📝 Natural language dates ("tomorrow", "next Monday", "in 3 days")
- ⚡ Priority levels (urgent, high, normal, low)
- 📅 Smart scheduling (day, week, month)
- ✅ Mark todos as done
- 💤 Snooze todos to later dates
- 📊 Daily review with organized output
- ☕ Morning digest with fun greetings

## Installation

### Using uv (recommended)

```bash
cd skills/linear-todos
uv sync
uv run python main.py --help
```

### Using pip

```bash
cd skills/linear-todos
pip install -e .
linear-todo --help
```

### Copy to OpenClaw skills

```bash
cp -r skills/linear-todos ~/.openclaw/skills/
```

## Commands

| Command | Purpose |
|---------|---------|
| `create` | Create new todos |
| `list` | List all todos |
| `done` | Mark todos as completed |
| `snooze` | Reschedule todos |
| `review` | Full daily review |
| `digest` | Morning digest (today only) |
| `setup` | Interactive configuration |

**See [SKILL.md](SKILL.md) for complete documentation.**

## Testing

```bash
uv run pytest tests/ -v
```

106 tests. All pass.

## License

MIT
