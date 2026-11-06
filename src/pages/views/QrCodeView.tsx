/**
 * src/pages/views/QrCodeView.tsx — Vollbild-QR-Code der aktiven Interaktion (Route #/ansicht/qr-code, ohne Chrome).
 * LIVE: pollt alle 5 s; zeigt genau die Interaktion mit aktiv=true, die die Übersicht gesetzt hat.
 */
import { useLiveRecords } from '@/hooks/useLiveRecords';
import { tx, appLabel } from '@/i18n';
import { extractRecordId } from '@/services/livingAppsService';
import { PublicPageQr } from '@/components/widgets/PublicPageQr';
import { countOf } from '@/config/plan';

export default function QrCodeView() {
  const interaktionen = useLiveRecords('interaktionen', { intervalMs: 5000, query: { filter: "r.v_aktiv == True and r.v_aktiv == True" } });
  const feedbacks = useLiveRecords('feedbacks', { intervalMs: 5000 });
  const active = interaktionen.records[0] ?? null;
  const eventId = active ? extractRecordId(active.fields.veranstaltung) : null;
  const count = active ? feedbacks.records.filter(f => extractRecordId(f.fields.interaktion) === active.record_id).length : 0;
  const live = !interaktionen.stale && !interaktionen.error;

  return (
    <main className="flex min-h-dvh flex-col items-center gap-[2vh] bg-background p-6 text-center text-foreground sm:p-10">
      <div className="flex w-full items-center justify-between gap-4" style={{ fontSize: 'clamp(1.25rem, 2.2vh, 2.25rem)' }}>
        <span className="flex items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {live ? tx('Live') : tx('Pause')}
        </span>
        {active && <span className="text-muted-foreground">{countOf('feedbacks', count, appLabel('feedbacks'))}</span>}
      </div>

      {active ? (
        <>
          <h1 className="max-w-[90vw] font-semibold" style={{ fontSize: 'clamp(2rem, 4.5vh, 4.5rem)' }}>{active.fields.frage}</h1>
          {active.fields.erlaeuterung && (
            <p className="max-w-[90vw] whitespace-pre-line text-muted-foreground" style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>{active.fields.erlaeuterung}</p>
          )}
          <div className="flex flex-1 items-center justify-center">
            <PublicPageQr
              entity="veranstaltungen"
              recordId={eventId}
              page="feedback-geben"
              size="40vh"
              linkClassName="text-[clamp(1.25rem,2.2vh,2.25rem)] text-muted-foreground"
              title={tx('QR-Code zum Feedback-Formular')}
            />
          </div>
        </>
      ) : (
        <p className="my-auto text-muted-foreground" style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>
          {interaktionen.loading ? '' : tx('Gerade ist keine Interaktion aktiv')}
        </p>
      )}

      {interaktionen.error && interaktionen.records.length === 0 && (
        <p role="alert" data-live-error className="text-destructive" style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>
          {interaktionen.unauthorized ? tx('Bitte melde dich an, um diese Ansicht zu sehen.') : tx('Die Daten konnten nicht geladen werden.')}
        </p>
      )}
    </main>
  );
}
