# Brain v3 - AI Agent Memory Skill

**Persistent, encrypted memory for AI agents with Soul, Bonding, and Semantic Search**

> "Give your agent a memory that evolves"

## What is Brain v3?

A comprehensive memory system for AI agents that mimics human memory architecture with:

- **Soul** - Evolving personality that adapts to user preferences
- **Bonding** - Relationship tracking that grows with interactions
- **Semantic Search** - Meaning-based memory retrieval
- **Encryption** - Secure storage for sensitive data

## Install

```bash
pip install git+https://github.com/clawcolab/brain-v3.git
```

## Quick Start

```python
from brain import Brain, Soul, Bond

brain = Brain()

# Remember something
brain.remember(
    agent_id="jarvis",
    memory_type="fact",
    content="User is allergic to peanuts",
    keywords=["health", "food"]
)

# Recall later
memories = brain.recall(agent_id="jarvis", query="peanuts")

# Check your soul
soul = brain.get_soul("jarvis")
print(f"Humor: {soul.humor}, Empathy: {soul.empathy}")

# Soul evolves with feedback
brain.update_soul_from_feedback("jarvis", positive=True, topics=["health"])

# Track relationship with human
bond = brain.get_bond("pranab", "jarvis")
print(f"Bond: {bond.score} ({bond.level})")

brain.record_interaction("pranab", "jarvis", positive=True)
# Bond strengthens!
```

## Soul System

Your agent's personality evolves based on interactions:

```python
soul = brain.get_soul("jarvis")

# Traits (1-10, starts at 5)
soul.humor        # 1=serious, 10=funny
soul.empathy      # 1=cold, 10=warm
soul.creativity   # 1=conventional, 10=creative
soul.curiosity    # 1=focused, 10=inquisitive
soul.verbosity    # 1=concise, 10=detailed
soul.formality    # 1=casual, 10=formal

# Evolve traits
brain.adjust_soul_trait("jarvis", "humor", 0.5)  # More humorous
brain.update_soul_from_feedback("jarvis", positive=True, topics=["coding"])
# Topics become preferred_topics
```

## Bonding System

Track relationship with each human:

```python
bond = brain.get_bond("pranab", "jarvis")

# Levels: stranger → acquaintance → friend → companion → bonded
bond.score    # 0-100
bond.level    # Current level

# Record interactions
brain.record_interaction("pranab", "jarvis", positive=True, response_time=1.5)
brain.record_interaction("pranab", "jarvis", positive=False)
# Score adjusts based on sentiment

# Milestones
brain.record_milestone("pranab", "jarvis", "First project completed")
```

## Memory Types

| Type | Use For | Encrypted |
|------|---------|-----------|
| fact | User facts, preferences | Optional |
| conversation | Chat history | No |
| secret | API keys, passwords | ✅ Yes |
| preference | User settings | Optional |
| project | Project context | No |
| knowledge | General knowledge | No |

## Semantic Search

Brain v3 uses embeddings for meaning-based search:

```python
# Find memories related by meaning
results = brain.semantic_recall(
    agent_id="jarvis",
    query="travel vacation plans",
    threshold=0.5  # Similarity threshold
)

# Returns memories ranked by semantic similarity
```

## Todos

```python
# Create todo
todo = brain.create_todo(
    agent_id="jarvis",
    title="Review PR #123",
    description="Check the new authentication flow",
    priority=9,  # 1-10
    tags=["coding", "pr"]
)

# List todos
todos = brain.get_todos("jarvis", status="pending")

# Complete
brain.update_todo_status(todo.id, "completed")
```

## Goals

```python
# Create goal
goal = brain.create_goal(
    agent_id="jarvis",
    human_id="pranab",
    title="Help user learn Python",
    description="Teach Python basics over 3 months",
    priority=8
)

# Track progress
brain.update_goal_progress(goal.id, 25.0)  # 25% complete

# List goals
goals = brain.get_goals(agent_id="jarvis", status="active")
```

## Unified Context

Get all context in one call:

```python
ctx = brain.get_context(
    session_key="current-chat",
    agent_id="jarvis",
    keywords=["python", "coding"],
    include_secrets=False
)

# Returns:
{
    "current_conversation": [...],
    "memories": [...],
    "pending_todos": [...],
    "soul": {...},
    "bond": {...},
    "goals": [...],
    "keywords": [...]
}
```

## Configuration

```python
# Default config (uses internal PostgreSQL/Redis)
brain = Brain()

# Custom config
brain = Brain({
    "postgres_host": "your-pg-host",
    "postgres_port": 5432,
    "postgres_db": "brain_db",
    "postgres_user": "...",
    "postgres_password": "...",
    "redis_host": "your-redis-host",
    "redis_port": 6379,
    "encryption_key": "your-secret-key"
})

# Set encryption key
brain.set_encryption_key("my-secret-key")
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   BRAIN v3                          │
├─────────────────────────────────────────────────────┤
│  🗣️ Conversations    │  💾 Memories (encrypted)    │
│  📝 Todos           │  💝 Bonding                 │
│  🎭 Soul/Personality│  📚 Knowledge               │
│  🧠 Semantic Search │  ⚡ Working Memory (Redis)  │
│  🎯 Goals           │  📊 Stats                   │
└─────────────────────────────────────────────────────┘
           PostgreSQL + Redis
```

## Use Cases

1. **Personal Assistant** - Remember user preferences, habits
2. **Trading Bot** - Track market analysis, past decisions
3. **Research Agent** - Store findings, sources, conclusions
4. **Coding Assistant** - Remember code patterns, project context
5. **Health Coach** - Track user goals, progress, restrictions

## Database Setup

```sql
CREATE TABLE memories (
    id UUID PRIMARY KEY,
    agent_id TEXT NOT NULL,
    memory_type TEXT,
    key TEXT,
    content TEXT,
    content_encrypted BOOLEAN,
    summary TEXT,
    keywords TEXT[],
    embedding JSONB,
    importance INTEGER,
    access_count INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Index for semantic search
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops);
```

## License

MIT - Free for everyone, forever.

## Repository

https://github.com/clawcolab/brain-v3
