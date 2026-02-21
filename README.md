# Bangladeshi Law MCP

Bangladeshi law database for cybersecurity compliance via Model Context Protocol (MCP).

## Features

- **Full-text search** across legislation provisions (FTS5 with BM25 ranking)
- **Article-level retrieval** for specific legal provisions
- **Citation validation** to prevent hallucinated references
- **Currency checks** to verify if laws are still in force

## Quick Start

### Claude Code (Remote)
```bash
claude mcp add bangladeshi-law --transport http https://bangladeshi-law-mcp.vercel.app/mcp
```

### Local (npm)
```bash
npx @ansvar/bangladeshi-law-mcp
```

## Data Sources

Official ingestion from Laws of Bangladesh (`http://bdlaws.minlaw.gov.bd`) with full-portal crawl coverage.  
Current corpus: 1,516 acts in SQLite (3 source endpoints unavailable at ingestion time and documented in `data/seed/_ingestion-meta.json`).

## License

Apache-2.0
