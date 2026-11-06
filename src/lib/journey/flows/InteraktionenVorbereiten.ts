/**
 * useInteraktionenVorbereitenFlow — the plumbing of the flow « Interaktionen vorbereiten », generated from the plan.
 *
 * Writes `interaktionen` SEVERAL times — one record per entry of `flow.lists.interaktionen`; the form is the editor of one entry: asks `veranstaltung`, `reihenfolge`, `frage`, `erlaeuterung`, `vorprompt`, `endprompt`; sets `aktiv` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 3)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   Lists (several records of one entity per run): `flow.lists.<key>` holds the
 *   entries — `add()` validates the editor form and takes its values as one more
 *   record, `remove(id)`, `edit(id)` (back into the editor), `entries`, `count`.
 *   Render the editor's fields INSIDE <ListEntries list={flow.lists.<key>}> (the
 *   block adds „Hinzufügen“ and the entry list); „Weiter“ on that step takes a
 *   filled editor as one more entry and needs at least one entry.
 *
 *   const flow = useInteraktionenVorbereitenFlow({
 *     steps: { veranstaltung: 1, reihenfolge: 2, frage: 2, erlaeuterung: 2, vorprompt: 2, endprompt: 2 },
 *     items: { veranstaltung: r => ({ id: r.id, title: fieldText(r, 'titel') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <EntitySelectStep {...flow.picks.veranstaltung.select} {...flow.pick('veranstaltung')} />
 *     <ListEntries list={flow.lists.interaktionen}><Bound form={flow.forms.interaktionen} name="reihenfolge" /><Bound form={flow.forms.interaktionen} name="frage" /><Bound form={flow.forms.interaktionen} name="erlaeuterung" /><Bound form={flow.forms.interaktionen} name="vorprompt" /><Bound form={flow.forms.interaktionen} name="endprompt" /></ListEntries>
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useEffect, useRef, useState } from 'react';
import { readJourneyExtra, writeJourneyExtra } from '@/lib/journey/draft';
import { nounOne } from '@/config/plan';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';

export type InteraktionenVorbereitenFieldKey = 'endprompt' | 'erlaeuterung' | 'frage' | 'reihenfolge' | 'veranstaltung' | 'vorprompt';

export interface InteraktionenVorbereitenForms {
  interaktionen: StepForm<'interaktionen'>;
}

// Alias so the option generics stay readable.
type Key = InteraktionenVorbereitenFieldKey;

export interface InteraktionenVorbereitenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    veranstaltung?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
  /** A page-side narrowing per pick, on top of the plan's filter (J-3): the
   *  questions of the picked event, the open ones — `r => fieldRef(r, 'veranstaltung') === eventId`. */
  where?: {
    veranstaltung?: (record: JourneyRecord) => boolean;
  };
}

/** One entry of a list the flow creates several records from (`flow.lists.<key>`). */
export interface ListEntry { id: string; values: FormValues; labels: Record<string, string>; rows: SummaryItem[] }

const DEFAULT_STEPS: Record<string, number> = {"endprompt": 2, "erlaeuterung": 2, "frage": 2, "reihenfolge": 2, "veranstaltung": 1, "vorprompt": 2};
export const INTERAKTIONENVORBEREITEN_REVIEW_STEP = 3;

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
// local calendar day — the ISO-string of a Date is UTC and flips the date in the evening (J-7)
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useInteraktionenVorbereitenFlow(options: InteraktionenVorbereitenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const interaktionen = useStepForm('interaktionen', {
    fields: ["veranstaltung", "reihenfolge", "frage", "erlaeuterung", "vorprompt", "endprompt"],
    steps: only(steps, ["veranstaltung", "reihenfolge", "frage", "erlaeuterung", "vorprompt", "endprompt"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["veranstaltung", "reihenfolge", "frage", "erlaeuterung", "vorprompt", "endprompt"]),
    messages: only(options.messages as Record<string, string> | undefined, ["veranstaltung", "reihenfolge", "frage", "erlaeuterung", "vorprompt", "endprompt"]),
  });
  const [interaktionenEntries, setInteraktionenEntries] = useState<ListEntry[]>(() => readJourneyExtra<ListEntry[]>('interaktionen-vorbereiten', 'list:interaktionen') ?? []);
  useEffect(() => { writeJourneyExtra('interaktionen-vorbereiten', 'list:interaktionen', interaktionenEntries.length ? interaktionenEntries : null); }, [interaktionenEntries]);
  const forms: InteraktionenVorbereitenForms = { interaktionen };
  // the editor of a list is not a record of its own: the review and the success
  // page read the entries (PlanStep.review), never the half-filled editor
  const formList: StepForm[] = [];
  const allForms: StepForm[] = [interaktionen];
  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    veranstaltung: useRecordSearch(servicePort, 'veranstaltungen', withPickPolicy('veranstaltung', {
      searchFields: ["titel", "ort"] as never,
      where: options.where?.veranstaltung,
      toItem: options.items?.veranstaltung as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:interaktionen-vorbereiten:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:interaktionen-vorbereiten:write:${entity}.${field}`,
  });
  const picks = {
    veranstaltung: { ...searches.veranstaltung, select: { ...searches.veranstaltung.select, create: true as boolean, hint: hintFor('veranstaltung', 'veranstaltungen', null as PickWhere | null) } },
  };

  // Lists — several records of one entity in one run („ein paar Termine“): the
  // editor form takes one entry at a time, `add()` validates it and puts it on
  // the list, the plan creates one record per entry (02.11.2026: the wish said
  // several, the flow made exactly one and nobody reported the difference)
  const lists = {
    interaktionen: {
      entries: interaktionenEntries,
      count: interaktionenEntries.length,
      label: nounOne('interaktionen', entityLabel('interaktionen')),
      /** Validates the editor and takes its values as one more `interaktionen`; false when a required field is empty. */
      add: (): boolean => {
        if (!interaktionen.validate()) return false;
        const rows = interaktionen.summary().filter(r => r.value !== '—');
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        setInteraktionenEntries(list => [...list, { id, values: interaktionen.payload(), labels: { ...interaktionen.labels }, rows }]);
        interaktionen.reset();
        return true;
      },
      remove: (id: string) => setInteraktionenEntries(list => list.filter(e => e.id !== id)),
      /** Takes an entry back into the editor to change it. */
      edit: (id: string) => {
        const e = interaktionenEntries.find(x => x.id === id);
        if (!e) return;
        setInteraktionenEntries(list => list.filter(x => x.id !== id));
        interaktionen.reset(e.values, e.labels);
      },
    },
  };
  const plan: PlanStep[] = [
    ...interaktionenEntries.map((entry, i) => ({
      key: `interaktionen:${entry.id}`, entity: 'interaktionen', label: `${nounOne('interaktionen', entityLabel('interaktionen'))} ${i + 1}`,
      values: (): FormValues => ({
        ...entry.values,
        aktiv: policyFixedValue('interaktionen', 'aktiv') ?? false,
      }),
      // the review lists every entry („1. Termin: …“); „Ändern“ leads back to the list's step
      review: () => entry.rows.map(r => ({ ...r, key: `interaktionen:${entry.id}:${r.key}`, label: `${i + 1}. ${r.label}`, step: steps[r.key] })),
    } as PlanStep)),
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'interaktionen-vorbereiten' });

  // A typed field the plan prefills from the picked record (`user:from_pick`),
  // still the person's to change: filled once, only while empty (PV-12)
  const prefillFrom = (pickKey: string, rec: JourneyRecord) => {
    void pickKey; void rec;
  };

  // Opened with `?<field>=<value>` for a field this flow asks — a dashboard
  // link that pre-picks the event, a form that hands the question on (J-2):
  // a typed field takes the value while it is empty (a draft wins), a pick
  // loads the record, takes it into the pick and selects it WITH its name.
  // `initial` with a bare record id gets its name the same way.
  const [linkedParams] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? ''));
  useEffect(() => {
    let on = true;
    const coerce = (form: StepForm, key: string, raw: string): unknown => {
      const kind = form.rules[key]?.kind;
      if (kind === 'number') { const n = Number(raw); return Number.isFinite(n) ? n : raw; }
      if (kind === 'bool') return raw === 'true' || raw === '1' || raw === 'ja';
      return raw;
    };
    {
      const cur = forms.interaktionen.get('veranstaltung');
      const fromLink = linkedParams.get('veranstaltung');
      const unnamed = typeof cur === 'string' && cur !== '' && !forms.interaktionen.labels[cur] ? cur : null;
      const id = fromLink && isEmptyValue(cur) ? fromLink : unnamed;
      if (id) void servicePort.get('veranstaltungen', id).then(rec => {
        if (!on || !rec) return;
        picks.veranstaltung.adopt(rec);
        const name = picks.veranstaltung.labelOf(rec.id) ?? rec.id;
        (forms.interaktionen.set as (k: string, v: unknown, l?: string) => void)('veranstaltung', rec.id, name);
        prefillFrom('veranstaltung', rec);
      }).catch(() => undefined);
    }
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, []);

  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: InteraktionenVorbereitenFieldKey) => {
    const owner = allForms.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined; recordOf?(id: string): JourneyRecord | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => {
        (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id));
        const rec = search?.recordOf?.(id);
        if (rec) prefillFrom(field, rec);
      },
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: InteraktionenVorbereitenFieldKey) => {
    const owner = allForms.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    // the list's step: a filled editor is taken as one more entry; at least one entry is needed
    && (steps['veranstaltung'] !== n || (hasValues(interaktionen) ? lists.interaktionen.add() : interaktionenEntries.length > 0 || interaktionen.validate()));
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); interaktionen.reset(); setInteraktionenEntries([]); };

  return {
    slug: 'interaktionen-vorbereiten' as const,
    draftKey: 'interaktionen-vorbereiten' as const,    entity: 'interaktionen' as const,
    form: interaktionen,
    forms, formList, picks, submit, steps, lists,    reviewStep: INTERAKTIONENVORBEREITEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type InteraktionenVorbereitenFlow = ReturnType<typeof useInteraktionenVorbereitenFlow>;
