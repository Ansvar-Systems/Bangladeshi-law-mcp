/**
 * Response metadata utilities for Bangladeshi Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
  _citation?: import('./citation.js').CitationMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Bangladesh Legal Framework (bdlaws.minlaw.gov.bd) — Bangladesh Bar Council / Ministry of Law, Justice and Parliamentary Affairs',
    jurisdiction: 'BD',
    disclaimer:
      'This data is sourced from the Bangladesh Legal Framework under public domain. ' +
      'The authoritative versions are maintained by the Ministry of Law, Justice and Parliamentary Affairs of Bangladesh. ' +
      'Always verify with the official portal (bdlaws.minlaw.gov.bd).',
    freshness,
  };
}
