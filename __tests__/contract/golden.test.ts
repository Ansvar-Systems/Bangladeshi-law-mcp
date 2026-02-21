/**
 * Golden contract tests for Bangladeshi Law MCP.
 * Validates core tool functionality against real portal-ingested data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/database.db');

let db: InstanceType<typeof Database>;

beforeAll(() => {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = DELETE');
});

describe('Database integrity', () => {
  it('should have 10 legal documents', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_documents').get() as { cnt: number };
    expect(row.cnt).toBe(10);
  });

  it('should have at least 680 provisions', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(680);
  });

  it('should have FTS index', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'সাইবার'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});

describe('Provision retrieval', () => {
  it('should retrieve section 1 from ICT Act 2006', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'bd-information-and-communication-technology-act-2006' AND section = '1'"
    ).get() as { content: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(40);
  });
});

describe('Search', () => {
  it('should find results via FTS search', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'telecommunication OR টেলিযোগাযোগ'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
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

describe('All 10 laws are present', () => {
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

describe('list_sources', () => {
  it('should have db_metadata table populated', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM db_metadata').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});
