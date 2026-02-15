---
name: local-system-info
description: Return system metrics (CPU, RAM, disk, processes) using psutil.
metadata:
  {
    "openclaw":
      {
        "emoji": "🖥️",
        "requires": { "bins": ["python3"], "pip": ["psutil"] },
        "install":
          [
            {
              "id": "psutil",
              "kind": "pip",
              "package": "psutil",
              "label": "Install psutil",
            },
          ],
      },
  }
---

# Local System Info Skill

Monitor local system resources including CPU, memory, disk usage, and running processes.

## Tool API

### system_info
Retrieve system metrics.

- **Parameters:**
  - `action` (string, required): One of `summary`, `cpu`, `memory`, `disk`, `processes`.
  - `limit` (integer, optional): Number of processes to list (default: 20). Only used with `action=processes`.

**Usage:**

```bash
uv run --with psutil skills/local-system-info/sysinfo.py summary
uv run --with psutil skills/local-system-info/sysinfo.py processes --limit 10
```
