import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Veranstaltungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    beginn?: string; // Format: YYYY-MM-DD oder ISO String
    ort?: string;
    beschreibung?: string;
  };
}

export interface Interaktionen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    reihenfolge?: number;
    frage?: string;
    erlaeuterung?: string;
    vorprompt?: string;
    endprompt?: string;
    aktiv?: boolean;
    zusammenfassung?: string;
    ki_antwort?: string;
    veranstaltung?: RecordUrl; // applookup -> URL zu 'Veranstaltungen' Record
  };
}

export interface Teilnehmende {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    veranstaltung?: RecordUrl; // applookup -> URL zu 'Veranstaltungen' Record
    kuerzel?: string;
    sterne?: LookupValue;
    bewertungskommentar?: string;
    email?: string;
    einwilligung?: boolean;
  };
}

export interface Feedbacks {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    interaktion?: RecordUrl; // applookup -> URL zu 'Interaktionen' Record
    teilnehmer?: RecordUrl; // applookup -> URL zu 'Teilnehmende' Record
    feedbacktext?: string;
    absende_kennung?: string;
  };
}

export const APP_IDS = {
  VERANSTALTUNGEN: '6aede6cfdb9e58dea21c980e',
  INTERAKTIONEN: '6aede6d3830cd726c735f8a7',
  TEILNEHMENDE: '6aede6d4b4352aa6fd82b8f9',
  FEEDBACKS: '6aede6d4764a8bd6915f389d',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'teilnehmende': {
    sterne: [{ key: "stern_1", get label() { return lookupLabel('teilnehmende', 'sterne', "stern_1") ?? "1 Stern"; } }, { key: "stern_2", get label() { return lookupLabel('teilnehmende', 'sterne', "stern_2") ?? "2 Sterne"; } }, { key: "stern_3", get label() { return lookupLabel('teilnehmende', 'sterne', "stern_3") ?? "3 Sterne"; } }, { key: "stern_4", get label() { return lookupLabel('teilnehmende', 'sterne', "stern_4") ?? "4 Sterne"; } }, { key: "stern_5", get label() { return lookupLabel('teilnehmende', 'sterne', "stern_5") ?? "5 Sterne"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'veranstaltungen': {
    'titel': 'string/text',
    'beginn': 'date/datetimeminute',
    'ort': 'string/text',
    'beschreibung': 'string/textarea',
  },
  'interaktionen': {
    'reihenfolge': 'number',
    'frage': 'string/textarea',
    'erlaeuterung': 'string/textarea',
    'vorprompt': 'string/textarea',
    'endprompt': 'string/textarea',
    'aktiv': 'bool',
    'zusammenfassung': 'string/textarea',
    'ki_antwort': 'string/textarea',
    'veranstaltung': 'applookup/select',
  },
  'teilnehmende': {
    'veranstaltung': 'applookup/select',
    'kuerzel': 'string/text',
    'sterne': 'lookup/radio',
    'bewertungskommentar': 'string/textarea',
    'email': 'string/email',
    'einwilligung': 'bool',
  },
  'feedbacks': {
    'interaktion': 'applookup/select',
    'teilnehmer': 'applookup/select',
    'feedbacktext': 'string/textarea',
    'absende_kennung': 'string/text',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateVeranstaltungen = StripLookup<Veranstaltungen['fields']>;
export type CreateInteraktionen = StripLookup<Interaktionen['fields']>;
export type CreateTeilnehmende = StripLookup<Teilnehmende['fields']>;
export type CreateFeedbacks = StripLookup<Feedbacks['fields']>;