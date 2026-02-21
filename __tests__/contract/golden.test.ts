/**
 * Golden contract tests for Bangladeshi Law MCP.
 * Validates DB integrity for full official-portal ingestion.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/database.db');
const META_PATH = path.resolve(__dirname, '../../data/seed/_ingestion-meta.json');
const OFFICIAL_PROVISION_FIXTURE_PATH = path.resolve(__dirname, '../../fixtures/official-provision-checks.json');

interface IngestionMeta {
  discovered_acts: number;
  failed_acts: number;
  total_provisions: number;
}

interface OfficialProvisionCheck {
  act_id: number;
  document_id: string;
  section: string;
  source_url: string;
  content: string;
}

let db: InstanceType<typeof Database>;
let meta: IngestionMeta;
const officialChecks = JSON.parse(
  fs.readFileSync(OFFICIAL_PROVISION_FIXTURE_PATH, 'utf-8'),
).provisions as OfficialProvisionCheck[];

beforeAll(() => {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = DELETE');

  meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as IngestionMeta;
});

describe('Database integrity', () => {
  it('should have one document per ingested act', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_documents').get() as { cnt: number };
    expect(row.cnt).toBe(meta.discovered_acts - meta.failed_acts);
  });

  it('should have provision count matching ingestion metadata', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(row.cnt).toBe(meta.total_provisions);
  });

  it('should have FTS index populated', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'সাইবার'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});

describe('All key laws are present', () => {
  const expectedDocs = [
    'bd-cyber-protection-ordinance-2025',
    'bd-cyber-security-act-2023',
    'bd-digital-security-act-2018',
    'bd-information-and-communication-technology-act-2006',
    'bd-bangladesh-telecommunication-regulation-act-2001',
    'bd-right-to-information-act-2009',
    'bd-bankers-books-evidence-act-2021',
    'bd-evidence-act-1872',
    'bd-telegraph-act-1885',
    'bd-official-secrets-act-1923',
  ];

  for (const docId of expectedDocs) {
    it(`should contain document: ${docId}`, () => {
      const row = db.prepare('SELECT id FROM legal_documents WHERE id = ?').get(docId) as { id: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.id).toBe(docId);
    });
  }
});

describe('Provision retrieval and search', () => {
  it('should retrieve section 1 from ICT Act 2006', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'bd-information-and-communication-technology-act-2006' AND section = '1'"
    ).get() as { content: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(40);
  });

  it('should find results via FTS search', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'telecommunication OR টেলিযোগাযোগ'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});

describe('Official source character-match checks', () => {
  for (const check of officialChecks) {
    it(`should match official source text exactly for ${check.document_id} section ${check.section}`, () => {
      const dbRow = db.prepare(
        'SELECT content FROM legal_provisions WHERE document_id = ? AND section = ?',
      ).get(check.document_id, check.section) as { content: string } | undefined;

      expect(dbRow).toBeDefined();
      expect(dbRow!.content).toBe(check.content);
    });
  }
});

describe('Negative tests', () => {
  it('should return no results for fictional document', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'fictional-law-2099'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('should return no results for invalid section', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'bd-information-and-communication-technology-act-2006' AND section = '999ZZZ-INVALID'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});

describe('list_sources', () => {
  it('should have db_metadata table populated', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM db_metadata').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});
