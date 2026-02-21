#!/usr/bin/env tsx
/**
 * Real-legislation ingestion for Laws of Bangladesh (bdlaws.minlaw.gov.bd).
 *
 * Modes:
 * - default: curated 10-law corpus
 * - --full-corpus: ingest all acts discoverable from alphabetical index
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
  parseFullActDetailsPage,
  parseSectionPage,
  toAsciiDigits,
  type DocumentStatus,
  type ParsedAct,
  type ParsedProvision,
} from './lib/parser.js';

interface TargetLaw {
  actId: number;
  id: string;
  fileSlug: string;
  shortName: string;
  titleEn?: string;
  status?: DocumentStatus;
}

interface IngestSummary {
  file: string;
  id: string;
  act_id: number;
  provisions: number;
  definitions: number;
  status: string;
}

interface IngestFailure {
  act_id: number;
  id: string;
  reason: string;
}

interface CliArgs {
  fullCorpus: boolean;
  limit: number | null;
  startLaw: number;
  skipFetch: boolean;
  resume: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

const ACT_ALIAS: Record<number, Omit<TargetLaw, 'actId'>> = {
  1538: {
    id: 'bd-cyber-protection-ordinance-2025',
    fileSlug: 'cyber-protection-ordinance-2025',
    shortName: 'Cyber Protection Ordinance 2025',
    titleEn: 'Cyber Protection Ordinance, 2025',
  },
  1457: {
    id: 'bd-cyber-security-act-2023',
    fileSlug: 'cyber-security-act-2023',
    shortName: 'Cyber Security Act 2023',
    titleEn: 'Cyber Security Act, 2023',
  },
  1261: {
    id: 'bd-digital-security-act-2018',
    fileSlug: 'digital-security-act-2018',
    shortName: 'Digital Security Act 2018',
    titleEn: 'Digital Security Act, 2018',
  },
  950: {
    id: 'bd-information-and-communication-technology-act-2006',
    fileSlug: 'information-and-communication-technology-act-2006',
    shortName: 'ICT Act 2006',
    titleEn: 'Information and Communication Technology Act, 2006',
  },
  857: {
    id: 'bd-bangladesh-telecommunication-regulation-act-2001',
    fileSlug: 'bangladesh-telecommunication-regulation-act-2001',
    shortName: 'BTRA 2001',
    titleEn: 'Bangladesh Telecommunication Regulation Act, 2001',
  },
  1011: {
    id: 'bd-right-to-information-act-2009',
    fileSlug: 'right-to-information-act-2009',
    shortName: 'RTI Act 2009',
    titleEn: 'Right to Information Act, 2009',
  },
  1392: {
    id: 'bd-bankers-books-evidence-act-2021',
    fileSlug: 'bankers-books-evidence-act-2021',
    shortName: 'Bankers\' Books Evidence Act 2021',
    titleEn: 'Bankers\' Books Evidence Act, 2021',
  },
  24: {
    id: 'bd-evidence-act-1872',
    fileSlug: 'evidence-act-1872',
    shortName: 'Evidence Act 1872',
  },
  55: {
    id: 'bd-telegraph-act-1885',
    fileSlug: 'telegraph-act-1885',
    shortName: 'Telegraph Act 1885',
  },
  132: {
    id: 'bd-official-secrets-act-1923',
    fileSlug: 'official-secrets-act-1923',
    shortName: 'Official Secrets Act 1923',
  },
};

const CURATED_ACT_IDS = [1538, 1457, 1261, 950, 857, 1011, 1392, 24, 55, 132];

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let fullCorpus = false;
  let limit: number | null = null;
  let startLaw = 1;
  let skipFetch = false;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--full-corpus') {
      fullCorpus = true;
      continue;
    }

    if (arg === '--skip-fetch') {
      skipFetch = true;
      continue;
    }

    if (arg === '--resume') {
      resume = true;
      continue;
    }

    if (arg === '--limit' && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      i += 1;
      continue;
    }

    if (arg === '--start-law' && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        startLaw = parsed;
      }
      i += 1;
      continue;
    }
  }

  return { fullCorpus, limit, startLaw, skipFetch, resume };
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
  if (/^(null|undefined)$/i.test(normalized)) return undefined;

  const chunks = normalized.split(/(?<=[.!?।])\s+/).filter(Boolean);
  const firstTwo = chunks.slice(0, 2).join(' ').trim();
  const result = firstTwo.length > 0 ? firstTwo : normalized;

  if (result.length <= 420) return result;
  return `${result.slice(0, 417)}...`;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function buildTargetLaw(actId: number): TargetLaw {
  const alias = ACT_ALIAS[actId];
  if (alias) {
    return {
      actId,
      ...alias,
    };
  }

  return {
    actId,
    id: `bd-act-${actId}`,
    fileSlug: `act-${actId}`,
    shortName: `Act ${actId}`,
  };
}

function indexCachePath(): string {
  return path.join(SOURCE_DIR, 'indices', 'alphabetical-index-en.html');
}

function actCachePath(actId: number, kind: 'details' | 'act'): string {
  return path.join(SOURCE_DIR, 'acts', `act-${actId}.${kind}.html`);
}

function sectionCachePath(actId: number, sectionPageId: string): string {
  return path.join(SOURCE_DIR, 'acts', `act-${actId}.sections`, `section-${sectionPageId}.html`);
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

function normalizeRefToken(input: string): string {
  const ascii = toAsciiDigits(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii;
}

function inferStatusFromTitleFallback(title: string): DocumentStatus {
  if (/(amendment|সংশোধন)/i.test(title)) return 'amended';
  return 'in_force';
}

async function discoverAllActIds(skipFetch: boolean): Promise<number[]> {
  const url = toAbsoluteUrl('/laws-of-bangladesh-alphabetical-index.html?lang=en');
  const html = await readOrFetch(url, indexCachePath(), skipFetch);

  const ids = new Set<number>();
  const regex = /\/act-(\d+)\.html/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const id = Number.parseInt(match[1], 10);
    if (Number.isFinite(id) && id > 0) {
      ids.add(id);
    }
  }

  return Array.from(ids).sort((a, b) => a - b);
}

function normalizeProvisions(provisions: ParsedProvision[]): ParsedProvision[] {
  return provisions.filter(prov => prov.content.trim().length > 0);
}

async function ingestFromActDetails(law: TargetLaw, skipFetch: boolean): Promise<ParsedAct | null> {
  const detailsUrl = toAbsoluteUrl(`/act-details-${law.actId}.html`);
  const detailsHtml = await readOrFetch(detailsUrl, actCachePath(law.actId, 'details'), skipFetch);

  const parsed = parseFullActDetailsPage(detailsHtml);
  if (parsed.sections.length === 0) {
    return null;
  }

  const usedRefs = new Set<string>();
  const provisions: ParsedProvision[] = parsed.sections.map((section, index) => {
    const normalizedSection = normalizeSectionNumber(section.section || String(index + 1));
    const refToken = normalizeRefToken(normalizedSection) || String(index + 1);
    const provisionRef = uniqueProvisionRef(`sec${refToken}`, usedRefs);
    const heading = section.heading || `Section ${normalizedSection}`;

    return {
      provision_ref: provisionRef,
      chapter: section.chapter,
      section: normalizedSection,
      title: `${normalizedSection}. ${heading}`,
      content: section.content.trim(),
    };
  });

  const normalizedProvisions = normalizeProvisions(provisions);
  if (normalizedProvisions.length === 0) {
    return null;
  }

  const definitions = extractDefinitions(normalizedProvisions);
  const title = parsed.title || law.shortName;
  const titleEn = law.titleEn ?? (looksBangla(title) ? undefined : title);
  const status = law.status ?? parsed.status ?? inferStatusFromTitleFallback(title);
  const officialActUrl = toAbsoluteUrl(`/act-${law.actId}.html`);

  return {
    id: law.id,
    type: 'statute',
    title,
    title_en: titleEn,
    short_name: law.shortName,
    status,
    issued_date: parsed.issuedDate,
    in_force_date: parsed.issuedDate,
    url: officialActUrl,
    description: shortenDescription(parsed.description),
    provisions: normalizedProvisions,
    definitions,
  };
}

async function ingestFromSectionPages(law: TargetLaw, skipFetch: boolean): Promise<ParsedAct> {
  const actUrl = toAbsoluteUrl(`/act-${law.actId}.html`);
  const actHtml = await readOrFetch(actUrl, actCachePath(law.actId, 'act'), skipFetch);
  const actMeta = parseActPage(actHtml);

  if (actMeta.sections.length === 0) {
    throw new Error(`No section links discovered in fallback mode`);
  }

  const provisions: ParsedProvision[] = [];
  const usedRefs = new Set<string>();

  for (let i = 0; i < actMeta.sections.length; i++) {
    const section = actMeta.sections[i];
    const sectionUrl = toAbsoluteUrl(section.href);
    const sectionHtml = await readOrFetch(
      sectionUrl,
      sectionCachePath(law.actId, section.sectionPageId),
      skipFetch,
    );

    const parsedSection = parseSectionPage(sectionHtml);
    const sectionNumber = normalizeSectionNumber(
      parsedSection.sectionFromBody ?? section.section ?? String(i + 1),
    );
    const heading = parsedSection.heading || section.title || `Section ${sectionNumber}`;
    const content = parsedSection.content.trim();
    if (!content) continue;

    const provisionRef = uniqueProvisionRef(buildProvisionRef(section.sectionPageId), usedRefs);
    provisions.push({
      provision_ref: provisionRef,
      chapter: parsedSection.chapter,
      section: sectionNumber,
      title: `${sectionNumber}. ${heading}`,
      content,
    });
  }

  const normalizedProvisions = normalizeProvisions(provisions);
  const definitions = extractDefinitions(normalizedProvisions);
  const title = actMeta.title || law.shortName;
  const titleEn = law.titleEn ?? (looksBangla(title) ? undefined : title);

  return {
    id: law.id,
    type: 'statute',
    title,
    title_en: titleEn,
    short_name: law.shortName,
    status: law.status ?? inferStatusFromTitleFallback(title),
    issued_date: actMeta.issuedDate,
    in_force_date: actMeta.issuedDate,
    url: actUrl,
    description: shortenDescription(actMeta.description),
    provisions: normalizedProvisions,
    definitions,
  };
}

async function ingestLaw(law: TargetLaw, skipFetch: boolean): Promise<ParsedAct> {
  const viaDetails = await ingestFromActDetails(law, skipFetch);
  if (viaDetails) return viaDetails;
  return ingestFromSectionPages(law, skipFetch);
}

function seedFileName(index: number, law: TargetLaw): string {
  const serial = String(index + 1).padStart(4, '0');
  const slug = law.fileSlug || `act-${law.actId}`;
  return `${serial}-${slug}.json`;
}

async function main(): Promise<void> {
  const { fullCorpus, limit, startLaw, skipFetch, resume } = parseArgs();

  ensureDirs();
  if (!resume) {
    clearExistingSeeds();
  }

  const actIds = fullCorpus
    ? await discoverAllActIds(skipFetch)
    : CURATED_ACT_IDS;

  const slicedActIds = actIds
    .slice(Math.max(0, startLaw - 1), limit ? Math.max(0, startLaw - 1) + limit : undefined);

  const laws = slicedActIds.map(buildTargetLaw);

  console.log('Bangladeshi Law MCP — Real Ingestion (bdlaws.minlaw.gov.bd)');
  console.log('============================================================');
  console.log(`Mode: ${fullCorpus ? 'full-corpus' : 'curated-10'}`);
  console.log(`Discovered acts: ${actIds.length}`);
  console.log(`Processing acts: ${laws.length} (start-law=${startLaw}${limit ? `, limit=${limit}` : ''})`);
  if (skipFetch) console.log('Fetch mode: --skip-fetch');
  if (resume) console.log('Seed mode: --resume (existing output files are skipped)');
  console.log('');

  const summaries: IngestSummary[] = [];
  const failures: IngestFailure[] = [];

  let totalProvisions = 0;
  let totalDefinitions = 0;
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < laws.length; i++) {
    const law = laws[i];
    const fileName = seedFileName(i + Math.max(0, startLaw - 1), law);
    const outputPath = path.join(SEED_DIR, fileName);

    if (resume && fs.existsSync(outputPath)) {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as ParsedAct;
      const provCount = existing.provisions?.length ?? 0;
      const defCount = existing.definitions?.length ?? 0;
      totalProvisions += provCount;
      totalDefinitions += defCount;
      summaries.push({
        file: fileName,
        id: existing.id,
        act_id: law.actId,
        provisions: provCount,
        definitions: defCount,
        status: 'cached',
      });
      skipped += 1;
      processed += 1;
      continue;
    }

    console.log(`[${String(i + 1).padStart(4, '0')}/${String(laws.length).padStart(4, '0')}] act-${law.actId}`);

    try {
      const parsed = await ingestLaw(law, skipFetch);

      if (!parsed.short_name) {
        parsed.short_name = toSlug(parsed.title).slice(0, 64) || `act-${law.actId}`;
      }

      fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));

      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;
      summaries.push({
        file: fileName,
        id: parsed.id,
        act_id: law.actId,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: parsed.status,
      });

      console.log(`    -> saved ${fileName}: ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({ act_id: law.actId, id: law.id, reason });
      console.log(`    -> failed act-${law.actId}: ${reason}`);
    }

    processed += 1;
  }

  const metaPath = path.join(SEED_DIR, '_ingestion-meta.json');
  const meta = {
    source: 'http://bdlaws.minlaw.gov.bd',
    mode: fullCorpus ? 'full-corpus' : 'curated-10',
    retrieved_at_utc: new Date().toISOString(),
    discovered_acts: actIds.length,
    processed_acts: processed,
    skipped_cached: skipped,
    failed_acts: failures.length,
    total_provisions: totalProvisions,
    total_definitions: totalDefinitions,
    failures,
    files: summaries,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  console.log('');
  console.log('Ingestion complete.');
  console.log(`Processed acts: ${processed}`);
  console.log(`Cached skips: ${skipped}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`Total provisions: ${totalProvisions}`);
  console.log(`Total definitions: ${totalDefinitions}`);
  console.log(`Seed directory: ${SEED_DIR}`);

  if (failures.length > 0) {
    console.log('Failed acts were recorded in data/seed/_ingestion-meta.json');
  }
}

main().catch(error => {
  console.error('Fatal ingestion error:', error);
  process.exit(1);
});
