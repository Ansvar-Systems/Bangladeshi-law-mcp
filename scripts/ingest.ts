#!/usr/bin/env tsx
/**
 * Real-legislation ingestion for Laws of Bangladesh (bdlaws.minlaw.gov.bd).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchHtml, toAbsoluteUrl } from './lib/fetcher.js';
import {
  buildProvisionRef,
  extractDefinitions,
  normalizeSectionNumber,
  parseActPage,
  parseSectionPage,
  type DocumentStatus,
  type ParsedAct,
  type ParsedProvision,
} from './lib/parser.js';

interface TargetLaw {
  fileSlug: string;
  id: string;
  actId: number;
  shortName: string;
  status: DocumentStatus;
  titleEn?: string;
}

interface CliArgs {
  limit: number | null;
  skipFetch: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

const TARGET_LAWS: TargetLaw[] = [
  {
    fileSlug: 'cyber-protection-ordinance-2025',
    id: 'bd-cyber-protection-ordinance-2025',
    actId: 1538,
    shortName: 'Cyber Protection Ordinance 2025',
    status: 'in_force',
    titleEn: 'Cyber Protection Ordinance, 2025',
  },
  {
    fileSlug: 'cyber-security-act-2023',
    id: 'bd-cyber-security-act-2023',
    actId: 1457,
    shortName: 'Cyber Security Act 2023',
    status: 'repealed',
    titleEn: 'Cyber Security Act, 2023',
  },
  {
    fileSlug: 'digital-security-act-2018',
    id: 'bd-digital-security-act-2018',
    actId: 1261,
    shortName: 'Digital Security Act 2018',
    status: 'repealed',
    titleEn: 'Digital Security Act, 2018',
  },
  {
    fileSlug: 'information-and-communication-technology-act-2006',
    id: 'bd-information-and-communication-technology-act-2006',
    actId: 950,
    shortName: 'ICT Act 2006',
    status: 'amended',
    titleEn: 'Information and Communication Technology Act, 2006',
  },
  {
    fileSlug: 'bangladesh-telecommunication-regulation-act-2001',
    id: 'bd-bangladesh-telecommunication-regulation-act-2001',
    actId: 857,
    shortName: 'BTRA 2001',
    status: 'amended',
    titleEn: 'Bangladesh Telecommunication Regulation Act, 2001',
  },
  {
    fileSlug: 'right-to-information-act-2009',
    id: 'bd-right-to-information-act-2009',
    actId: 1011,
    shortName: 'RTI Act 2009',
    status: 'amended',
    titleEn: 'Right to Information Act, 2009',
  },
  {
    fileSlug: 'bankers-books-evidence-act-2021',
    id: 'bd-bankers-books-evidence-act-2021',
    actId: 1392,
    shortName: 'Bankers\' Books Evidence Act 2021',
    status: 'in_force',
    titleEn: 'Bankers\' Books Evidence Act, 2021',
  },
  {
    fileSlug: 'evidence-act-1872',
    id: 'bd-evidence-act-1872',
    actId: 24,
    shortName: 'Evidence Act 1872',
    status: 'amended',
  },
  {
    fileSlug: 'telegraph-act-1885',
    id: 'bd-telegraph-act-1885',
    actId: 55,
    shortName: 'Telegraph Act 1885',
    status: 'amended',
  },
  {
    fileSlug: 'official-secrets-act-1923',
    id: 'bd-official-secrets-act-1923',
    actId: 132,
    shortName: 'Official Secrets Act 1923',
    status: 'in_force',
  },
];

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      i += 1;
      continue;
    }

    if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

function ensureDirs(): void {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function clearExistingSeeds(): void {
  if (!fs.existsSync(SEED_DIR)) return;

  for (const file of fs.readdirSync(SEED_DIR)) {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(SEED_DIR, file));
    }
  }
}

function looksBangla(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

function shortenDescription(text: string | undefined): string | undefined {
  if (!text) return undefined;

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;

  const chunks = normalized.split(/(?<=[.!?।])\s+/).filter(Boolean);
  const firstTwo = chunks.slice(0, 2).join(' ').trim();
  const result = firstTwo.length > 0 ? firstTwo : normalized;

  if (result.length <= 420) return result;
  return `${result.slice(0, 417)}...`;
}

function buildCachePath(law: TargetLaw, kind: 'act' | 'section', sectionPageId?: string): string {
  if (kind === 'act') {
    return path.join(SOURCE_DIR, law.fileSlug, 'act.html');
  }

  if (!sectionPageId) {
    throw new Error('sectionPageId is required for section cache path');
  }

  return path.join(SOURCE_DIR, law.fileSlug, 'sections', `section-${sectionPageId}.html`);
}

async function readOrFetch(url: string, cachePath: string, skipFetch: boolean): Promise<string> {
  if (skipFetch && fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, 'utf-8');
  }

  const fetched = await fetchHtml(url);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, fetched.body);
  return fetched.body;
}

function uniqueProvisionRef(proposed: string, used: Set<string>): string {
  if (!used.has(proposed)) {
    used.add(proposed);
    return proposed;
  }

  let attempt = 2;
  while (true) {
    const candidate = `${proposed}-${attempt}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    attempt += 1;
  }
}

async function ingestLaw(law: TargetLaw, skipFetch: boolean): Promise<ParsedAct> {
  const actUrl = toAbsoluteUrl(`/act-${law.actId}.html`);
  const actHtml = await readOrFetch(actUrl, buildCachePath(law, 'act'), skipFetch);
  const actMeta = parseActPage(actHtml);

  if (actMeta.sections.length === 0) {
    throw new Error(`No section links discovered for ${law.id} at ${actUrl}`);
  }

  const provisions: ParsedProvision[] = [];
  const provisionRefs = new Set<string>();

  for (let i = 0; i < actMeta.sections.length; i++) {
    const section = actMeta.sections[i];
    const sectionUrl = toAbsoluteUrl(section.href);
    const sectionCache = buildCachePath(law, 'section', section.sectionPageId);

    const sectionHtml = await readOrFetch(sectionUrl, sectionCache, skipFetch);
    const parsedSection = parseSectionPage(sectionHtml);

    const sectionNumber = normalizeSectionNumber(
      parsedSection.sectionFromBody ?? section.section ?? String(i + 1)
    );

    const heading = (parsedSection.heading || section.title || `Section ${sectionNumber}`).trim();
    const content = parsedSection.content.trim();

    if (!content) {
      continue;
    }

    const proposedRef = buildProvisionRef(section.sectionPageId);
    const provisionRef = uniqueProvisionRef(proposedRef, provisionRefs);

    provisions.push({
      provision_ref: provisionRef,
      chapter: parsedSection.chapter,
      section: sectionNumber,
      title: `${sectionNumber}. ${heading}`,
      content,
    });

    if ((i + 1) % 25 === 0 || i + 1 === actMeta.sections.length) {
      console.log(`    ${law.fileSlug}: ${i + 1}/${actMeta.sections.length} sections parsed`);
    }
  }

  const definitions = extractDefinitions(provisions);

  const title = actMeta.title || law.shortName;
  const titleEn = law.titleEn ?? (looksBangla(title) ? undefined : title);

  return {
    id: law.id,
    type: 'statute',
    title,
    title_en: titleEn,
    short_name: law.shortName,
    status: law.status,
    issued_date: actMeta.issuedDate,
    in_force_date: actMeta.issuedDate,
    url: actUrl,
    description: shortenDescription(actMeta.description),
    provisions,
    definitions,
  };
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  ensureDirs();
  clearExistingSeeds();

  const laws = limit ? TARGET_LAWS.slice(0, limit) : TARGET_LAWS;

  console.log('Bangladeshi Law MCP — Real Ingestion (bdlaws.minlaw.gov.bd)');
  console.log('============================================================');
  console.log(`Target laws: ${laws.length}`);
  if (skipFetch) console.log('Mode: --skip-fetch (reuse cached HTML where available)');
  console.log('');

  const summaries: Array<{ file: string; id: string; provisions: number; definitions: number }> = [];
  let totalProvisions = 0;
  let totalDefinitions = 0;

  for (let i = 0; i < laws.length; i++) {
    const law = laws[i];
    const fileName = `${String(i + 1).padStart(2, '0')}-${law.fileSlug}.json`;
    const outputPath = path.join(SEED_DIR, fileName);

    console.log(`[${String(i + 1).padStart(2, '0')}/${laws.length}] Fetching ${law.fileSlug} (act-${law.actId})`);

    const parsed = await ingestLaw(law, skipFetch);

    fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));

    totalProvisions += parsed.provisions.length;
    totalDefinitions += parsed.definitions.length;

    summaries.push({
      file: fileName,
      id: parsed.id,
      provisions: parsed.provisions.length,
      definitions: parsed.definitions.length,
    });

    console.log(`    -> saved ${fileName}: ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);
    console.log('');
  }

  const metaPath = path.join(SEED_DIR, '_ingestion-meta.json');
  const meta = {
    source: 'http://bdlaws.minlaw.gov.bd',
    retrieved_at_utc: new Date().toISOString(),
    laws_ingested: laws.length,
    total_provisions: totalProvisions,
    total_definitions: totalDefinitions,
    files: summaries,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  console.log('Ingestion complete.');
  console.log(`Total provisions: ${totalProvisions}`);
  console.log(`Total definitions: ${totalDefinitions}`);
  console.log(`Seed directory: ${SEED_DIR}`);
}

main().catch(error => {
  console.error('Fatal ingestion error:', error);
  process.exit(1);
});
