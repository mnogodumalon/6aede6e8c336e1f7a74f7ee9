// Analyse: Hub-and-Spoke (Veranstaltung → Interaktionen → Feedbacks). Kein Widget passt auf eine
// geordnete Schritt-Liste mit „genau eine aktiv" — Kanban (Status-Spalten) abgelehnt, weil die Reihenfolge
// (reihenfolge) und nicht ein Status die Achse ist. Hero: keiner (nichts Dringendes), die Interaktions-Liste ist
// das Primärelement. Layout: variant="wide" + StatStrip, mobil zuerst die Kopfzeile, dann die Karten.
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { IconPlus, IconQrcode, IconFileText, IconRobot, IconMessage, IconCircleCheck, IconPlayerPlay } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import type { Interaktionen } from '@/types/app';
import { lookupKey } from '@/lib/formatters';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { useClock, gruss, undoToast } from '@/lib/polish';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { countOf } from '@/config/plan';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { veranstaltungen, interaktionen, teilnehmende, feedbacks, setInteraktionen, fetchAll } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'interaktionen') return undefined;
      const r = interaktionen.find(i => i.record_id === top.record.record_id);
      if (!r || r.fields.aktiv) return undefined;
      return { label: tx('Aktivieren'), onClick: () => { void activate(r); } };
    },
  });
  const clock = useClock();
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [kiOpen, setKiOpen] = useState<string | null>(null);
  const [kiDraft, setKiDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const events = useMemo(
    () => [...veranstaltungen].sort((a, b) => (b.fields.beginn ?? '').localeCompare(a.fields.beginn ?? '')),
    [veranstaltungen],
  );
  const activeOf = (vid: string) => interaktionen.find(i => i.fields.aktiv && extractRecordId(i.fields.veranstaltung) === vid);
  const currentId = selected && events.some(e => e.record_id === selected)
    ? selected
    : (events.find(e => activeOf(e.record_id)) ?? events[0])?.record_id ?? null;
  const current = events.find(e => e.record_id === currentId) ?? null;

  const feedbackCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of feedbacks) {
      const id = extractRecordId(f.fields.interaktion);
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [feedbacks]);

  const steps = useMemo(
    () => interaktionen
      .filter(i => extractRecordId(i.fields.veranstaltung) === currentId)
      .sort((a, b) => (a.fields.reihenfolge ?? 999) - (b.fields.reihenfolge ?? 999) || a.createdat.localeCompare(b.createdat)),
    [interaktionen, currentId],
  );
  const shown = onlyEmpty ? steps.filter(s => !feedbackCount.get(s.record_id)) : steps;
  const emptySteps = steps.filter(s => !feedbackCount.get(s.record_id)).length;
  const activeStep = steps.find(s => s.fields.aktiv);

  const stars = teilnehmende
    .filter(t => extractRecordId(t.fields.veranstaltung) === currentId)
    .map(t => Number((lookupKey(t.fields.sterne) ?? '').replace('stern_', '')))
    .filter(n => n > 0);
  const avg = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null;

  // ONE write path: Aktivieren — optimistic, genau eine aktiv je Veranstaltung, Undo
  async function activate(r: Interaktionen): Promise<string | undefined> {
    const vid = extractRecordId(r.fields.veranstaltung);
    if (!vid) return tx('Diese Interaktion gehört zu keiner Veranstaltung.');
    const before = interaktionen.filter(i => extractRecordId(i.fields.veranstaltung) === vid)
      .map(i => ({ id: i.record_id, aktiv: !!i.fields.aktiv }));
    const apply = (state: { id: string; aktiv: boolean }[]) =>
      setInteraktionen(prev => prev.map(i => {
        const s = state.find(x => x.id === i.record_id);
        return s ? { ...i, fields: { ...i.fields, aktiv: s.aktiv } } : i;
      }));
    apply(before.map(b => ({ id: b.id, aktiv: b.id === r.record_id })));
    setMessage(null);
    try {
      await Promise.all(before
        .filter(b => (b.id === r.record_id) !== b.aktiv)
        .sort((a, b) => Number(a.id === r.record_id) - Number(b.id === r.record_id)) // erst ausschalten
        .map(b => LivingAppsService.updateInteraktionenEntry(b.id, { aktiv: b.id === r.record_id })));
    } catch {
      apply(before);
      void fetchAll();
      const m = tx('Aktivieren hat nicht geklappt — bitte noch einmal versuchen.');
      setMessage(m);
      return m;
    }
    undoToast(tx`„${r.fields.frage ?? ''}" ist jetzt aktiv`, () => {
      apply(before);
      void Promise.all(before.map(b => LivingAppsService.updateInteraktionenEntry(b.id, { aktiv: b.aktiv }))).catch(() => fetchAll());
    });
    return undefined;
  }

  async function saveKi(r: Interaktionen) {
    const prev = r.fields.ki_antwort ?? '';
    const next = kiDraft;
    setInteraktionen(list => list.map(i => i.record_id === r.record_id ? { ...i, fields: { ...i.fields, ki_antwort: next } } : i));
    setKiOpen(null);
    try {
      await LivingAppsService.updateInteraktionenEntry(r.record_id, { ki_antwort: next });
      undoToast(tx('KI-Antwort gespeichert'), () => {
        setInteraktionen(list => list.map(i => i.record_id === r.record_id ? { ...i, fields: { ...i.fields, ki_antwort: prev } } : i));
        void LivingAppsService.updateInteraktionenEntry(r.record_id, { ki_antwort: prev }).catch(() => fetchAll());
      });
    } catch {
      void fetchAll();
      setMessage(tx('Die KI-Antwort konnte nicht gespeichert werden.'));
    }
  }

  const title = (r: Interaktionen) => r.fields.frage?.trim() || tx('Ohne Frage');
  const firstLine = (s: string) => (s.length > 140 ? `${s.slice(0, 140)}…` : s);

  const contextLine = activeStep && current
    ? tx`Bei „${current.fields.titel ?? ''}" läuft gerade „${firstLine(title(activeStep))}" — ${countOf('feedbacks', feedbackCount.get(activeStep.record_id) ?? 0, appLabel('feedbacks'))} bisher.`
    : current
      ? tx`Bei „${current.fields.titel ?? ''}" ist noch keine Interaktion aktiv — wähle unten die erste aus.`
      : tx('Lege deine erste Veranstaltung an, dann bereitest du die Interaktionen vor.');

  const nextOrder = steps.reduce((m, s) => Math.max(m, s.fields.reihenfolge ?? 0), 0) + 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        {crud.veranstaltungen.canWrite && (
          <Button onClick={() => crud.veranstaltungen.openCreate({})} className="w-full sm:w-auto">
            <IconPlus size={16} className="shrink-0" />{tx('Neue Veranstaltung')}
          </Button>
        )}
      </header>

      {events.length > 0 && (
        <DashboardGrid
          variant="wide"
          kpis={
            <StatStrip>
              <StatStripItem
                title={tx('Ohne Feedback')}
                value={emptySteps}
                tone={emptySteps > 0 ? 'primary' : 'default'}
                icon={<IconMessage size={18} className="text-muted-foreground" />}
                onClick={() => setOnlyEmpty(v => !v)}
                active={onlyEmpty}
              />
              <StatStripItem
                title={tx('Feedbacks gesamt')}
                value={steps.reduce((n, s) => n + (feedbackCount.get(s.record_id) ?? 0), 0)}
                icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
              />
              <StatStripItem
                title={tx('Bewertung Ø')}
                value={avg === null ? tx('noch keine') : `${avg.toFixed(1).replace('.', ',')} ★`}
              />
            </StatStrip>
          }
          primary={
            <div className="space-y-4">
              {events.length > 1 && (
                <div className="flex flex-wrap gap-2" role="tablist">
                  {events.map(e => (
                    <Button
                      key={e.record_id}
                      size="sm"
                      role="tab"
                      variant={e.record_id === currentId ? 'default' : 'outline'}
                      onClick={() => { setSelected(e.record_id); setOnlyEmpty(false); }}
                      className="max-w-full"
                    >
                      <span className="truncate">{e.fields.titel ?? tx('Ohne Titel')}</span>
                      {e.fields.beginn && (
                        <span className="ml-1 opacity-70">{format(new Date(e.fields.beginn), 'd. MMM', { locale: dateFnsLocale() })}</span>
                      )}
                    </Button>
                  ))}
                </div>
              )}

              {current && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" className="min-w-0 text-left" onClick={() => crud.veranstaltungen.openDetail(current)}>
                    <h2 className="truncate text-lg font-semibold hover:underline">{current.fields.titel ?? tx('Ohne Titel')}</h2>
                    <p className="truncate text-sm text-muted-foreground">
                      {[current.fields.beginn && format(new Date(current.fields.beginn), 'EEE d. MMM, HH:mm', { locale: dateFnsLocale() }), current.fields.ort].filter(Boolean).join(' · ')}
                    </p>
                  </button>
                  {crud.interaktionen.canWrite && (
                    <Button variant="outline" size="sm" onClick={() => crud.interaktionen.openCreate({ veranstaltung: current.record_id, reihenfolge: nextOrder, aktiv: false })}>
                      <IconPlus size={16} className="shrink-0" />{tx('Interaktion')}
                    </Button>
                  )}
                </div>
              )}

              {message && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{message}</p>}

              {shown.length === 0 ? (
                <div className="rounded-[27px] bg-card p-8 text-center shadow-sm">
                  <p className="text-sm text-muted-foreground">
                    {onlyEmpty ? tx('Alle Interaktionen haben schon Feedback.') : tx('Hier sind noch keine Interaktionen — lege die erste an.')}
                  </p>
                  {!onlyEmpty && crud.interaktionen.canWrite && current && (
                    <Button className="mt-4" onClick={() => crud.interaktionen.openCreate({ veranstaltung: current.record_id, reihenfolge: nextOrder, aktiv: false })}>
                      <IconPlus size={16} className="shrink-0" />{tx('Erste Interaktion anlegen')}
                    </Button>
                  )}
                </div>
              ) : (
                <ol className="space-y-3">
                  {shown.map(s => {
                    const n = feedbackCount.get(s.record_id) ?? 0;
                    const on = !!s.fields.aktiv;
                    return (
                      <li key={s.record_id} className={`overflow-hidden rounded-[27px] bg-card p-4 shadow-sm sm:p-5 ${on ? 'ring-2 ring-primary' : ''}`}>
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                            {s.fields.reihenfolge ?? '–'}
                          </span>
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => crud.interaktionen.openDetail(s)}>
                            <p className="line-clamp-2 font-medium">{title(s)}</p>
                            <p className="mt-1 text-sm">
                              {on
                                ? <span className="font-medium text-primary">{tx('Aktiv')}</span>
                                : <span className="text-muted-foreground">{tx('Wartet')}</span>}
                              <span className="text-muted-foreground"> · {countOf('feedbacks', n, appLabel('feedbacks'))}</span>
                              {s.fields.zusammenfassung ? <span className="text-muted-foreground"> · {tx('zusammengefasst')}</span> : null}
                            </p>
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {crud.interaktionen.canWrite && (
                            <Button asChild size="sm" variant={on ? 'outline' : 'default'} className="grow sm:grow-0">
                              <a
                                href="#/ansicht/qr-code"
                                target="_blank"
                                rel="noopener"
                                onClick={() => { if (!on) void activate(s); }}
                              >
                                {on ? <IconQrcode size={16} className="shrink-0" /> : <IconPlayerPlay size={16} className="shrink-0" />}
                                {on ? tx('QR-Code zeigen') : tx('Aktivieren & QR-Code')}
                              </a>
                            </Button>
                          )}
                          <Button asChild size="sm" variant="outline" className="grow sm:grow-0">
                            <a href={`#/ansicht/zusammenfassung?record=${s.record_id}`} target="_blank" rel="noopener">
                              <IconFileText size={16} className="shrink-0" />{tx('Zusammenfassen')}
                            </a>
                          </Button>
                          {crud.interaktionen.canWrite && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="grow sm:grow-0"
                              onClick={() => { setKiOpen(kiOpen === s.record_id ? null : s.record_id); setKiDraft(s.fields.ki_antwort ?? ''); }}
                            >
                              <IconRobot size={16} className="shrink-0" />
                              {s.fields.ki_antwort ? tx('KI-Antwort ✓') : tx('KI-Antwort einfügen')}
                            </Button>
                          )}
                        </div>
                        {kiOpen === s.record_id && (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={kiDraft}
                              onChange={e => setKiDraft(e.target.value)}
                              rows={6}
                              placeholder={tx('Antwort der KI hier einfügen')}
                              className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => { void saveKi(s); }}>{tx('Speichern')}</Button>
                              <Button size="sm" variant="ghost" onClick={() => setKiOpen(null)}>{tx('Abbrechen')}</Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          }
        />
      )}

      {events.length === 0 && (
        <div className="rounded-[27px] bg-card p-8 text-center shadow-sm">
          <IconQrcode size={48} className="mx-auto text-muted-foreground" />
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            {tx('Starte mit deiner ersten Veranstaltung. Danach legst du die Interaktionen an, die deine Teilnehmenden per QR-Code beantworten.')}
          </p>
          {crud.veranstaltungen.canWrite && (
            <Button className="mt-4" onClick={() => crud.veranstaltungen.openCreate({})}>
              <IconPlus size={16} className="shrink-0" />{tx('Erste Veranstaltung anlegen')}
            </Button>
          )}
        </div>
      )}
      {crud.surfaces}
    </div>
  );
}
