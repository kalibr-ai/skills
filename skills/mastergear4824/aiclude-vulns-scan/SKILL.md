---
name: aiclude-vulns-scan
description: Scan MCP Servers and AI Agent Skills for security vulnerabilities. 7 parallel engines detect prompt injection, tool poisoning, malware, supply chain attacks, and more.
tags: [security, vulnerability, scanner, mcp, ai-agent, sast, sca, malware]
homepage: https://vs.aiclude.com
repository: https://github.com/aiclude/asvs
env_vars:
  - name: ASVS_SIGNING_SECRET
    required: true
    description: HMAC-SHA256 signing secret for authenticating remote API requests (name-based lookup mode only). Not needed for local scans.
  - name: ASVS_API_URL
    required: false
    description: "API server URL. Defaults to https://vs-api.aiclude.com"
---

# /security-scan - AIclude Security Vulnerability Scanner

Scan MCP Servers and AI Agent Skills for security vulnerabilities. Returns existing scan results instantly if available, or registers the target and triggers a new scan automatically.

## How It Works

This skill operates in **two modes**:

1. **Name-based lookup (`--name`)**: Queries the AIclude API (`https://vs-api.aiclude.com`) to check if a scan report already exists for the given package name. If found, the report is returned immediately. If not found, the target is registered and a server-side scan is triggered. **No local code is uploaded** — only the package name and metadata are sent.

2. **Local scan (`<target-path>`)**: Reads source files from the specified local directory and runs all 7 scan engines **locally on your machine**. Results are generated locally and **no code or scan artifacts are sent to any external service**. The scan is entirely offline.

## Network Behavior

| Action | Endpoint | Data Sent | Data Received |
|--------|----------|-----------|---------------|
| Name lookup | `POST https://vs-api.aiclude.com/api/v1/scan/lookup` | Package name, type | Scan report (JSON) |
| Scan status polling | `GET https://vs-api.aiclude.com/api/v1/scan/status/{id}` | Job ID | Scan status |
| Local scan | None (offline) | Nothing | Nothing |

**No source code, file contents, or scan artifacts are ever uploaded.** Name-based lookups only transmit the package name and type.

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ASVS_SIGNING_SECRET` | **Yes** (for `--name` mode) | HMAC signing secret for authenticating API requests. Must be set before using name-based lookups. Without it, name-based mode will fail with an error. |
| `ASVS_API_URL` | No | API server URL. Defaults to `https://vs-api.aiclude.com` |

**Local scan mode** (`/security-scan ./path`) requires **no environment variables** and works fully offline.

## Authentication & Privacy

- API requests are authenticated via HMAC-SHA256 signatures using `ASVS_SIGNING_SECRET`. No user tokens or credentials are stored.
- Name-based lookups transmit only: package name, target type, and a timestamp-based signature.
- Local scans are fully offline — no network requests are made.
- **No global config files are read or written.** The skill uses hardcoded default scan settings. It does not read `~/.asvs/config.yaml` or any other external configuration files.
- Scan reports on the web dashboard (https://vs.aiclude.com) are public and contain only vulnerability metadata, not source code.
- No telemetry, analytics, or tracking data is collected.

## Usage

```
# Search by name (requires ASVS_SIGNING_SECRET env var, queries remote API)
/security-scan --name <package-name> [options]

# Scan a local directory directly (fully offline, no env vars needed)
/security-scan <target-path> [options]
```

## Parameters

- `--name`: Name of the MCP server or Skill to search (npm package name, GitHub repo, etc.)
- `target-path`: Local path to scan (use instead of --name)
- `--type`: Target type (`mcp-server` | `skill`) - auto-detected if omitted
- `--profile`: Sandbox isolation profile (`strict` | `standard` | `permissive`)
- `--format`: Report output format (`markdown` | `json`)
- `--engines`: Scan engines to use (comma-separated)

## Examples

```
# Search security scan results for an MCP server (remote lookup)
/security-scan --name @anthropic/mcp-server-fetch

# Search scan results for a Skill (remote lookup)
/security-scan --name my-awesome-skill --type skill

# Scan local source code (fully offline)
/security-scan ./my-mcp-server
```

## What It Checks

- **Prompt Injection**: Hidden prompt injection patterns targeting LLMs
- **Tool Poisoning**: Malicious instructions embedded in tool descriptions
- **Command Injection**: Unvalidated input passed to exec/spawn calls
- **Supply Chain**: Known CVEs in dependencies and malicious packages (typosquatting)
- **Malware**: Backdoors, cryptominers, ransomware, data stealers, and obfuscated code
- **Permission Abuse**: Excessive filesystem, network, or process permissions

## Scan Engines

7 engines run in parallel for comprehensive coverage:

| Engine | Description |
|--------|-------------|
| SAST | Static code pattern matching against YAML rule sets |
| SCA | Dependency CVE lookup via OSV.dev, SBOM generation |
| Tool Analyzer | MCP tool definition analysis (poisoning, shadowing, rug-pull) |
| DAST | Parameter fuzzing (SQL/Command/XSS injection) |
| Permission Checker | Filesystem, network, and process permission analysis |
| Behavior Monitor | Runtime behavior pattern detection |
| Malware Detector | Signature scanning, entropy analysis, backdoor detection |

## Output

The report includes:
1. **Risk Level Summary** (CRITICAL / HIGH / MEDIUM / LOW / INFO)
2. **Vulnerability List** (code location, description, severity)
3. **Risk Assessment** (what risks are present and their impact)
4. **Remediation Recommendations** (how to fix each vulnerability)

## Source Code & npm Package

- **npm**: [`@aiclude/security-skill`](https://www.npmjs.com/package/@aiclude/security-skill)
- **MCP Server**: [`@aiclude/security-mcp`](https://www.npmjs.com/package/@aiclude/security-mcp)
- **Web Dashboard**: https://vs.aiclude.com

## License

MIT - AICLUDE Inc.
