/**
 * Parser utilities for Laws of Bangladesh HTML pages.
 */

export type DocumentStatus = 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en?: string;
  short_name?: string;
  status: DocumentStatus;
  issued_date?: string;
  in_force_date?: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

export interface SectionIndexEntry {
  href: string;
  sectionPageId: string;
  rawLabel: string;
  section: string;
  title: string;
}

export interface ActPageMetadata {
  title: string;
  description?: string;
  issuedDate?: string;
  sections: SectionIndexEntry[];
}

export interface SectionPageData {
  heading: string;
  content: string;
  chapter?: string;
  sectionFromBody?: string;
}

const BANGLA_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const MONTH_MAP: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  'জানুয়ারি': 1,
  'জানুয়ারি': 1,
  'ফেব্রুয়ারি': 2,
  'ফেব্রুয়ারি': 2,
  'মার্চ': 3,
  'এপ্রিল': 4,
  'মে': 5,
  'জুন': 6,
  'জুলাই': 7,
  'আগস্ট': 8,
  'সেপ্টেম্বর': 9,
  'অক্টোবর': 10,
  'অক্টোবর': 10,
  'নভেম্বর': 11,
  'ডিসেম্বর': 12,
};

export function toAsciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, ch => BANGLA_DIGIT_MAP[ch] ?? ch);
}

function decodeHtmlEntities(value: string): string {
  const named = value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '-')
    .replace(/&ndash;/gi, '-')
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&zwnj;/gi, '')
    .replace(/&zwj;/gi, '')
    .replace(/&hellip;/gi, '...');

  const hexDecoded = named.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
    const code = Number.parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });

  return hexDecoded.replace(/&#(\d+);/g, (_, dec: string) => {
    const code = Number.parseInt(dec, 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanInlineText(value: string): string {
  const withoutTags = stripTags(value);
  const decoded = decodeHtmlEntities(withoutTags);
  return normalizeWhitespace(decoded.replace(/[♣♠♦†‡¤]/g, ''));
}

function extractTitleTag(html: string): string {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? cleanInlineText(match[1]) : '';
}

function extractMetaDescription(html: string): string | undefined {
  const match = html.match(/<meta\s+name="Description"\s+content="([\s\S]*?)"\s*\/?\s*>/i);
  if (!match) return undefined;
  const cleaned = cleanInlineText(match[1]);
  return cleaned.length > 0 ? cleaned : undefined;
}

function parseFlexibleDate(rawDate: string): string | undefined {
  const normalizedDigits = toAsciiDigits(rawDate);
  const cleaned = normalizedDigits
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const match = cleaned.match(/(\d{1,2})\s+([A-Za-z\u0980-\u09FF]+),?\s*(\d{4})/);
  if (!match) return undefined;

  const day = Number.parseInt(match[1], 10);
  const monthToken = match[2].toLowerCase();
  const year = Number.parseInt(match[3], 10);
  const month = MONTH_MAP[monthToken] ?? MONTH_MAP[match[2]];

  if (!month || day <= 0 || day > 31 || year < 1700 || year > 2100) {
    return undefined;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractPublishedDateIso(html: string): string | undefined {
  const publishBlock = html.match(/class="[^"]*publish-date[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (!publishBlock) return undefined;

  const bracketed = publishBlock[1].match(/\[\s*([^\]]+?)\s*\]/);
  if (!bracketed) return undefined;

  return parseFlexibleDate(cleanInlineText(bracketed[1]));
}

function parseSectionLabel(label: string, fallbackIndex: number): { section: string; title: string } {
  const cleaned = normalizeWhitespace(label);
  const match = cleaned.match(/^([^\s.।)]+)\s*[.।)]\s*(.+)$/u);

  if (match) {
    return {
      section: normalizeSectionNumber(match[1]),
      title: normalizeWhitespace(match[2]),
    };
  }

  return {
    section: String(fallbackIndex + 1),
    title: cleaned,
  };
}

function extractDivInnerByClass(html: string, classNeedle: string): string | undefined {
  const lower = html.toLowerCase();
  const classIndex = lower.indexOf(classNeedle.toLowerCase());
  if (classIndex < 0) return undefined;

  const openStart = lower.lastIndexOf('<div', classIndex);
  if (openStart < 0) return undefined;

  const openEnd = lower.indexOf('>', classIndex);
  if (openEnd < 0) return undefined;

  const divTagRegex = /<\/?div\b[^>]*>/gi;
  divTagRegex.lastIndex = openEnd + 1;
  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = divTagRegex.exec(html)) !== null) {
    if (match[0].startsWith('</')) {
      depth -= 1;
    } else {
      depth += 1;
    }

    if (depth === 0) {
      return html.slice(openEnd + 1, match.index);
    }
  }

  return undefined;
}

function extractHierarchyLabel(html: string, className: string): string | undefined {
  const pattern = new RegExp(`<p class="${className}"[^>]*>([\\s\\S]*?)<\\/p>`, 'i');
  const match = html.match(pattern);
  if (!match) return undefined;
  const text = cleanInlineText(match[1]);
  return text.length > 0 ? text : undefined;
}

function extractChapterLabel(sectionHtml: string): string | undefined {
  const partNo = extractHierarchyLabel(sectionHtml, 'act-part-no');
  const partName = extractHierarchyLabel(sectionHtml, 'act-part-name');
  const chapterNo = extractHierarchyLabel(sectionHtml, 'act-chapter-no');
  const chapterName = extractHierarchyLabel(sectionHtml, 'act-chapter-name');

  const parts: string[] = [];
  if (partNo || partName) {
    parts.push([partNo, partName].filter(Boolean).join(': '));
  }
  if (chapterNo || chapterName) {
    parts.push([chapterNo, chapterName].filter(Boolean).join(': '));
  }

  if (parts.length === 0) return undefined;
  return parts.join(' / ');
}

function htmlFragmentToText(fragment: string): string {
  let text = fragment;

  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '');
  text = text.replace(/<div[^>]*class="clbr"[^>]*>[\s\S]*?<\/div>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '- ');
  text = text.replace(/<[^>]+>/g, ' ');

  text = decodeHtmlEntities(text);
  text = text.replace(/[♣♠♦†‡¤]/g, '');
  text = text.replace(/\r/g, '');

  const lines = text
    .split('\n')
    .map(line => normalizeWhitespace(line))
    .filter(line => line.length > 0);

  return lines.join('\n').trim();
}

export function normalizeSectionNumber(section: string): string {
  return normalizeWhitespace(toAsciiDigits(section));
}

export function parseActPage(html: string): ActPageMetadata {
  const normalizedHtml = html.replace(/^\uFEFF/, '');

  const title = extractTitleTag(normalizedHtml);
  const description = extractMetaDescription(normalizedHtml);
  const issuedDate = extractPublishedDateIso(normalizedHtml);

  const sectionRegex = /<p class="act-section-name[^\"]*">[\s\S]*?<a href="([^\"]*\/section-(\d+)\.html[^\"]*)">([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const sections: SectionIndexEntry[] = [];

  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(normalizedHtml)) !== null) {
    const rawHref = match[1].split('?')[0].trim();
    const href = rawHref.startsWith('/') ? rawHref : `/${rawHref}`;
    if (seen.has(href)) continue;
    seen.add(href);

    const sectionPageId = match[2];
    const rawLabel = cleanInlineText(match[3]);
    const parsedLabel = parseSectionLabel(rawLabel, sections.length);

    sections.push({
      href,
      sectionPageId,
      rawLabel,
      section: parsedLabel.section,
      title: parsedLabel.title,
    });
  }

  return {
    title,
    description,
    issuedDate,
    sections,
  };
}

export function parseSectionPage(html: string): SectionPageData {
  const normalizedHtml = html.replace(/^\uFEFF/, '');

  const headingHtml = extractDivInnerByClass(normalizedHtml, 'col-sm-3 txt-head') ?? '';
  const contentHtml = extractDivInnerByClass(normalizedHtml, 'col-sm-9 txt-details') ?? '';

  const heading = cleanInlineText(headingHtml);
  const content = htmlFragmentToText(contentHtml);
  const chapter = extractChapterLabel(normalizedHtml);

  const sectionFromBodyMatch = content.match(/^([^\s.।)]+)\s*[.।)]/u);
  const sectionFromBody = sectionFromBodyMatch
    ? normalizeSectionNumber(sectionFromBodyMatch[1])
    : undefined;

  return {
    heading,
    content,
    chapter,
    sectionFromBody,
  };
}

export function buildProvisionRef(sectionPageId: string): string {
  return `sec${sectionPageId}`;
}

function isDefinitionCandidate(provision: ParsedProvision): boolean {
  if (normalizeSectionNumber(provision.section) === '2') {
    return true;
  }
  const title = provision.title.toLowerCase();
  return title.includes('definition') || title.includes('সংজ্ঞা');
}

export function extractDefinitions(provisions: ParsedProvision[]): ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];
  const seen = new Set<string>();

  for (const provision of provisions) {
    if (!isDefinitionCandidate(provision)) continue;

    const chunks = provision.content
      .split(/\n|;/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);

    for (const chunk of chunks) {
      let term: string | undefined;
      let definition: string | undefined;

      const quoted = chunk.match(/["“”']\s*([^"“”']{2,120})\s*["“”']\s*(?:means|shall mean|অর্থ|বলিতে|বুঝাইবে|বুঝায়)\s*(.+)/i);
      if (quoted) {
        term = normalizeWhitespace(quoted[1]);
        definition = normalizeWhitespace(quoted[2]);
      } else {
        const englishUnquoted = chunk.match(/^([A-Za-z][A-Za-z0-9\-\s()\/]{2,100})\s+(?:means|shall mean)\s+(.+)$/i);
        if (englishUnquoted) {
          term = normalizeWhitespace(englishUnquoted[1]);
          definition = normalizeWhitespace(englishUnquoted[2]);
        }
      }

      if (!term || !definition) continue;
      if (term.length < 2 || definition.length < 5) continue;

      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      definitions.push({
        term,
        definition,
        source_provision: provision.provision_ref,
      });
    }
  }

  return definitions;
}
