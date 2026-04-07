# Bangladeshi Law MCP Server

**The Bangladesh Law Portal alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fbangladeshi-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/bangladeshi-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Bangladeshi-law-mcp?style=social)](https://github.com/Ansvar-Systems/Bangladeshi-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Bangladeshi-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Bangladeshi-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Bangladeshi-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Bangladeshi-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-44%2C069-blue)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)

Query **1,516 Bangladeshi statutes** -- from the ডিজিটাল নিরাপত্তা আইন and দণ্ডবিধি to the তথ্য ও যোগাযোগ প্রযুক্তি আইন, কোম্পানি আইন, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Bangladeshi legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Bangladeshi legal research means navigating bdlaws.minlaw.gov.bd, the Ministry of Law's official portal, across statutes spanning colonial-era laws and modern legislation in both Bengali and English. Whether you're:

- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking Digital Security Act obligations or data protection requirements
- A **legal tech developer** building tools on Bangladeshi law
- A **researcher** tracing legislative provisions across criminal, civil, commercial, and digital law

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Bangladeshi law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-bd/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add bangladeshi-law --transport http https://mcp.ansvar.eu/law-bd/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bangladeshi-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-bd/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "bangladeshi-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-bd/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/bangladeshi-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bangladeshi-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/bangladeshi-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "bangladeshi-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/bangladeshi-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"বাংলাদেশের ডিজিটাল নিরাপত্তা আইনে সাইবার অপরাধ সম্পর্কে কী বলা আছে?"*
- *"দণ্ডবিধিতে প্রতারণার জন্য কী শাস্তির বিধান রয়েছে?"*
- *"তথ্য ও যোগাযোগ প্রযুক্তি আইনে ব্যক্তিগত তথ্য সুরক্ষার বিধান খুঁজুন"*
- *"What does the Digital Security Act say about cybercrime and online fraud?"*
- *"Search for provisions about data protection in Bangladeshi law"*
- *"What are the company registration requirements under the Companies Act 1994?"*
- *"Is the Information and Communication Technology Act still in force?"*
- *"Build a legal stance on intellectual property protection under Bangladeshi law"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 1,516 statutes | Comprehensive Bangladeshi legislation from bdlaws.minlaw.gov.bd |
| **Provisions** | 44,069 sections | Full-text searchable with FTS5 |
| **Legal Definitions** | 0 (free tier) | Table reserved, extraction not enabled in current free build |
| **Database Size** | Optimized SQLite | Portable, pre-built |
| **Daily Updates** | Automated | Freshness checks against Bangladesh Law Portal |

**Verified data only** -- every citation is validated against official sources (bdlaws.minlaw.gov.bd). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from bdlaws.minlaw.gov.bd (Ministry of Law, Justice and Parliamentary Affairs) official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by statute identifier + section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
bdlaws.minlaw.gov.bd --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                           ^                        ^
                    Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search bdlaws.minlaw.gov.bd by Act name | Search by plain Bengali or English: *"ডিজিটাল নিরাপত্তা"* |
| Navigate bilingual Bengali/English statutes manually | Get the exact provision with context |
| Manual cross-referencing between Acts | `build_legal_stance` aggregates across sources |
| "Is this statute still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find international framework alignment -- dig through multiple sites | `get_eu_basis` -- linked international frameworks instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search bdlaws.minlaw.gov.bd --> Navigate pages --> Ctrl+F --> Cross-reference between Acts --> Check international framework alignment --> Repeat

**This MCP:** *"ডিজিটাল নিরাপত্তা আইনে সাইবার অপরাধের জন্য কী দণ্ডের বিধান রয়েছে?"* -- Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 44,069 provisions with BM25 ranking. Supports Bengali and English queries |
| `get_provision` | Retrieve specific provision by statute identifier + section number |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Bangladeshi conventions |
| `list_sources` | List all available statutes with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks that a Bangladeshi statute aligns with |
| `get_bangladeshi_implementations` | Find Bangladeshi laws aligning with international standards or frameworks |
| `search_eu_implementations` | Search international documents with Bangladeshi alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Bangladeshi statutes against international frameworks |

---

## International Law Alignment

Bangladesh is not an EU member state, but Bangladeshi law aligns with several international legal frameworks:

- **Commonwealth legal heritage:** Bangladesh shares common law traditions with the UK, and many foundational statutes (Penal Code, Evidence Act, Contract Act) originate from British-Indian colonial-era legislation, creating alignment with Commonwealth jurisdictions
- **UNCITRAL:** The Arbitration Act 2001 is based on the UNCITRAL Model Law on International Commercial Arbitration
- **WTO/TRIPS:** Bangladesh is a WTO member (with LDC-specific flexibilities); intellectual property legislation aligns with TRIPS obligations
- **FATF standards:** AML/CFT legislation aligns with FATF Recommendations
- **UN conventions:** Bangladesh is a party to UN conventions on civil, criminal, and commercial law cooperation
- **Digital law development:** The Cyber Security Act 2023 (replacing the Digital Security Act 2018) reflects evolving international cybersecurity norms

The international bridge tools allow you to explore these alignment relationships -- checking which Bangladeshi provisions correspond to international requirements.

> **Note:** International cross-references reflect alignment relationships, not transposition. Bangladesh adopts its own legislative approach, and the international tools help identify where Bangladeshi and international frameworks address similar domains.

---

## Data Sources & Freshness

All content is sourced from authoritative Bangladeshi legal databases:

- **[bdlaws.minlaw.gov.bd](https://bdlaws.minlaw.gov.bd/)** -- Bangladesh Law Portal, Ministry of Law, Justice and Parliamentary Affairs

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Ministry of Law, Justice and Parliamentary Affairs, Government of Bangladesh |
| **Retrieval method** | Structured data from bdlaws.minlaw.gov.bd |
| **Languages** | Bengali/Bangla (primary), English (secondary) |
| **License** | Public domain (Bangladesh government official publications) |
| **Coverage** | 1,516 statutes across all legislative domains |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors all data sources:

| Source | Check | Method |
|--------|-------|--------|
| **Statute amendments** | bdlaws.minlaw.gov.bd date comparison | All statutes checked |
| **New statutes** | Official gazette publications | Diffed against database |
| **Repealed statutes** | Status change detection | Flagged automatically |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from bdlaws.minlaw.gov.bd (Ministry of Law, Justice and Parliamentary Affairs, Bangladesh). However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **International cross-references** reflect alignment relationships, not transposition
> - **Bilingual system** -- statutes may exist in Bengali and English; verify the authoritative version against official sources
> - **Colonial-era legislation** -- some foundational statutes date from the British-Indian period; verify current applicability

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for guidance compliant with Bangladesh Bar Council (বাংলাদেশ বার কাউন্সিল) professional responsibility rules.

---

## Documentation

- **[International Integration Guide](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)** -- Detailed cross-reference documentation
- **[Security Policy](SECURITY.md)** -- Vulnerability reporting and scanning details
- **[Disclaimer](DISCLAIMER.md)** -- Legal disclaimers and professional use notices
- **[Privacy](PRIVACY.md)** -- Client confidentiality and data handling

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Bangladeshi-law-mcp
cd Bangladeshi-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest          # Ingest statutes from bdlaws.minlaw.gov.bd
npm run build:db        # Rebuild SQLite database
npm run drift:detect    # Run drift detection against known anchors
npm run check-updates   # Check for source updates
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/bangladeshi-law-mcp](https://github.com/Ansvar-Systems/Bangladeshi-law-mcp) (This Project)
**Query 1,516 Bangladeshi statutes directly from Claude** -- ডিজিটাল নিরাপত্তা আইন, দণ্ডবিধি, তথ্য ও যোগাযোগ প্রযুক্তি আইন, and more. `npx @ansvar/bangladeshi-law-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

**100+ national law MCPs** covering Australia, Canada, India, Japan, Kenya, Nigeria, Pakistan, Singapore, South Korea, Sri Lanka, Thailand, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Supreme Court, High Court Division)
- Bengali-language provision text expansion
- Historical statute versions and amendment tracking
- English translations for Bengali-primary statutes

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (1,516 statutes, 44,069 provisions)
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [x] Daily freshness checks
- [ ] Court case law expansion (Supreme Court)
- [ ] Historical statute versions (amendment tracking)
- [ ] Expanded Bengali-language text ingestion

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{bangladeshi_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Bangladeshi Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Bangladeshi-law-mcp},
  note = {1,516 Bangladeshi statutes with 44,069 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Ministry of Law, Justice and Parliamentary Affairs, Government of Bangladesh (public domain, official government publications)
- **International Metadata:** Public domain

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for Bangladeshi law -- turns out everyone building compliance tools for businesses operating in Bangladesh has the same research frustrations.

So we're open-sourcing it. Navigating 1,516 statutes in two languages shouldn't require 47 browser tabs.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
