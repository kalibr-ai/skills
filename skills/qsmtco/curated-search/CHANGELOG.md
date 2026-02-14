# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.org/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.3] - 2026-02-14

### Security
- Fixed accidental inclusion of internal audit documents in published package
- Updated `.clawhubignore` to exclude `*AUDIT*.md`, `*CRITICAL*.md`, `SYS_*`, `YACY_*`, and related internal notes
- No functional changes to the skill itself

## [Unreleased]

### Added
- Robots.txt cache with 24-hour TTL to balance freshness and performance
- Comprehensive URL normalization: trailing slash removal, tracking param stripping, SSRF prevention
- Per-host rate limiting integrated with robots.txt crawl-delay
- Full content extraction pipeline: site-specific selectors (MDN, Python, Wikipedia, GitHub, StackPrinter, man pages), boilerplate removal, code preservation, quality validation, excerpt generation
- State persistence with truncation (queue capped at 10k, seen at 50k)
- Extensive test suite: 128 passing tests including unit and integration coverage
- Validation improvement: `search.default_limit` must not exceed `search.max_limit`
- Search tool `--version` command no longer crashes (MiniSearch version detection fixed)
- Empty query validation correctly returns `missing_query` error
- Integration test path resolution corrected for proper script discovery

### Changed
- Downgraded `node-fetch` from v3 to v2.6.7 for CommonJS/Jest compatibility (may revisit with native fetch)
- Search tool now loads index directly from JSON (no HTTP server)
- Crawler uses per-host rate limiting instead of global delay

### Fixed
- Config validation test data setup (trim whitespace, proper replacement patterns)
- Integration test `runSearchTool` project root path calculation
- `stats.skipped_domain` counter initialization safety in crawler
- SSRF prevention via private IP range blocking
- URL canonicalization eliminates duplicates from trailing slashes, fragments, tracking parameters

## [1.0.0] - 2025-02-12

### Added
- First public release of Curated Search
- Domain-restricted crawling with curated whitelist
- Full-text search over MiniSearch index
- OpenClaw native integration
- Configurable crawl parameters (depth, delay, timeout)
- Content extraction with site-specific selectors
- Robots.txt compliance and rate limiting
- State checkpointing and resume
- Health monitoring and graceful shutdown
- Jest test suite with coverage targets
- Comprehensive documentation (README, SKILL, deployment)

---

**Note:** This changelog starts with the initial release (1.0.0). Future updates will list changes under `[Unreleased]` and move versions downward.