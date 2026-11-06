/**
 * src/pages/views/ZusammenfassungView.tsx — Vollbild-Zusammenfassung einer Interaktion (#/ansicht/zusammenfassung?record=ID, ohne Chrome).
 * Setzt den Text beim Öffnen zusammen, wenn er leer ist: Vorprompt, jedes Feedback mit Kürzel, Endprompt.
 */
import { useLiveRecords } from '@/hooks/useLiveRecords';
import { tx } from '@/i18n';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { ViewTextEditor } from '@/components/blocks/ViewTextEditor';

export default function ZusammenfassungView() {
  const pinned = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record') ?? '').replace(/["\\]/g, '');
  const interaktionen = useLiveRecords('interaktionen', { intervalMs: 0 });
  const feedbacks = useLiveRecords('feedbacks', { intervalMs: 0 });
  const teilnehmende = useLiveRecords('teilnehmende', { intervalMs: 0 });
  const interaktionenEdit = interaktionen.records.find(r => r.record_id === pinned) ?? interaktionen.records[0] ?? null;
  const loaded = ![interaktionen, feedbacks, teilnehmende].some(x => x.loading);

  const compose = (): string | null => {
    if (!interaktionenEdit || !loaded) return null;
    const kuerzel = new Map(teilnehmende.records.map(t => [t.record_id, t.fields.kuerzel ?? '?']));
    const lines = feedbacks.records
      .filter(f => extractRecordId(f.fields.interaktion) === interaktionenEdit.record_id)
      .sort((a, b) => a.createdat.localeCompare(b.createdat))
      .map(f => `${kuerzel.get(extractRecordId(f.fields.teilnehmer) ?? '') ?? f.fields.absende_kennung ?? '?'}: ${(f.fields.feedbacktext ?? '').trim()}`);
    return [interaktionenEdit.fields.vorprompt ?? '', ...lines, interaktionenEdit.fields.endprompt ?? '']
      .filter(p => p.trim() !== '')
      .join('\n\n');
  };

  return (
    <main className="min-h-dvh bg-background p-6 text-foreground sm:p-10">
      {interaktionenEdit ? (
        <div className="flex flex-col gap-4">
          <h1 className="font-semibold" style={{ fontSize: 'clamp(2rem, 4.5vh, 4.5rem)' }}>{interaktionenEdit.fields.frage}</h1>
          {interaktionenEdit.fields.erlaeuterung && (
            <p className="whitespace-pre-line text-muted-foreground" style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>{interaktionenEdit.fields.erlaeuterung}</p>
          )}
          <ViewTextEditor
            field="zusammenfassung"
            recordId={interaktionenEdit.record_id}
            value={String(interaktionenEdit.fields.zusammenfassung ?? '')}
            save={async text => {
              await LivingAppsService.updateInteraktionenEntry(interaktionenEdit.record_id, { zusammenfassung: text });
              interaktionen.apply(interaktionenEdit.record_id, { zusammenfassung: text });
            }}
            compose={compose}
            blocked={[interaktionen, feedbacks, teilnehmende].some(x => x.error) ? tx('Die Daten konnten nicht geladen werden — es wird nichts zusammengeführt oder gespeichert.') : null}
          />
        </div>
      ) : (
        !interaktionen.loading && !interaktionen.error && (
          <p className="text-muted-foreground" style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>{tx('Diese Interaktion wurde nicht gefunden.')}</p>
        )
      )}
      {[interaktionen, feedbacks, teilnehmende].map((x, i) => x.error && x.records.length === 0 && (
        <p key={i} role="alert" data-live-error className="mt-4 text-destructive" style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>
          {x.unauthorized ? tx('Bitte melde dich an, um diese Ansicht zu sehen.') : tx('Die Daten konnten nicht geladen werden.')}
        </p>
      ))}
    </main>
  );
}
