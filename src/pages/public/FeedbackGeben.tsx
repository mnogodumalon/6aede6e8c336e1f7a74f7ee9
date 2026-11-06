import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, prepareChallenge, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm, useJourneySubmit, useLiveList, useVisitorKey, fieldText, fieldRef, freshRef,
  readJourneyExtra, writeJourneyExtra, rememberOwnRecord, type PlanStep,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { Bound } from '@/components/blocks/Bound';
import { FieldErrorSummary } from '@/components/blocks/FieldErrorSummary';
import { LoadProblem } from '@/components/blocks/LoadProblem';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Button } from '@/components/ui/button';
import { tx } from '@/i18n';

const SLUG = 'feedback-geben';

function newKennung(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function FeedbackGeben() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(e => {
        if (e instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return <FeedbackInner cfg={cfg} page={page} />;
}

function FeedbackInner({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [params] = useSearchParams();
  const linkedId = params.get('veranstaltung');
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const visitorKey = useVisitorKey();

  const events = useLiveList(port, 'veranstaltungen', { intervalMs: 0, enabled: !!linkedId });
  const live = useLiveList(port, 'interaktionen', { intervalMs: 20000, enabled: !!linkedId });

  const eventRecord = events.records.find(r => r.id === linkedId) ?? null;
  const shown = useMemo(
    () => live.records.find(r => fieldRef(r, 'veranstaltung') === linkedId) ?? null,
    [live.records, linkedId],
  );

  const tnKey = `teilnehmer-${linkedId ?? ''}`;
  const [knownTn, setKnownTn] = useState<string | null>(() => readJourneyExtra<string>(tnKey, 'id'));
  const [kennung, setKennung] = useState<string>(newKennung);

  const form = useStepForm('feedbacks', {
    fields: ['feedbacktext'],
    required: { feedbacktext: true },
    autoComplete: true,
  });

  const shownId = shown?.id ?? '';
  const plan: PlanStep[] = [
    ...(knownTn ? [] : [{
      key: 'teilnehmer',
      entity: 'teilnehmende' as const,
      values: { veranstaltung: linkedId ?? '', kuerzel: visitorKey },
    }]),
    {
      key: 'feedback',
      entity: 'feedbacks' as const,
      form,
      primary: true,
      ...(knownTn ? {} : { needs: ['teilnehmer'], link: { teilnehmer: 'teilnehmer' } }),
      values: { interaktion: shownId, absende_kennung: kennung, ...(knownTn ? { teilnehmer: knownTn } : {}) },
    },
  ];

  const submit = useJourneySubmit(port, plan, {
    draftKey: `feedback-${linkedId ?? ''}`,
    check: async () => {
      if (!shownId) return tx('Inzwischen ist keine Frage mehr offen.');
      const ref = await freshRef(port, 'interaktionen', shownId, 'veranstaltung');
      return ref !== null && ref === linkedId ? null : tx('Inzwischen ist eine andere Frage dran.');
    },
    onSuccess: result => {
      const tn = result.records['teilnehmer'];
      if (tn) {
        writeJourneyExtra(tnKey, 'id', tn.id);
        rememberOwnRecord('teilnehmende', tn.id);
      }
    },
  });

  if (!linkedId) {
    return (
      <PublicShell title={page.title}>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link ist unvollständig. Scanne bitte den QR-Code der Veranstaltung.')}
        </p>
      </PublicShell>
    );
  }
  if ((!live.loaded && live.error) || (!events.loaded && events.error)) {
    return (
      <PublicShell title={page.title}>
        <LoadProblem onRetry={() => { void live.reload(); void events.reload(); }} />
      </PublicShell>
    );
  }
  if (!live.loaded || !events.loaded) return <PublicShell loading />;
  if (!eventRecord) {
    return (
      <PublicShell title={page.title}>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link passt zu keiner Veranstaltung. Scanne bitte den QR-Code noch einmal.')}
        </p>
      </PublicShell>
    );
  }

  const restart = () => {
    setKnownTn(readJourneyExtra<string>(tnKey, 'id'));
    setKennung(newKennung());
    submit.reset();
    form.reset();
  };

  const onSend = async () => {
    if (!form.validate()) return;
    await submit.run();
  };

  return (
    <PublicShell title={fieldText(eventRecord, 'titel')} description={tx('Gib hier dein Feedback zur aktuellen Frage ab.')}>
      {submit.result ? (
        <SuccessStep
          result={submit.result}
          title={tx('Danke für dein Feedback!')}
          actions={{ copy: false, print: false }}
          next={[{ label: tx('Noch ein Feedback geben'), onClick: restart }]}
        >
          <p className="text-sm">
            {tx('Dein Kürzel:')} <strong className="font-mono text-base tracking-widest">{visitorKey}</strong>
          </p>
          <Link
            className="text-sm font-medium text-primary underline"
            to={`/public/bewertung-abgeben?veranstaltung=${linkedId}`}
          >
            {tx('Zur Bewertung der Veranstaltung')}
          </Link>
        </SuccessStep>
      ) : !shown ? (
        <p className="text-sm text-muted-foreground">
          {tx('Gerade ist keine Frage geöffnet. Diese Seite aktualisiert sich von selbst.')}
        </p>
      ) : (
        <form
          className="space-y-5"
          onSubmit={e => { e.preventDefault(); void onSend(); }}
          onFocus={() => prepareChallenge(cfg, page, 'POST', `/apps/${page.endpoints?.find(ep => ep.entity === 'feedbacks')?.app_id ?? ''}/records`)}
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold whitespace-pre-line">{fieldText(shown, 'frage')}</h2>
            {fieldText(shown, 'erlaeuterung') && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{fieldText(shown, 'erlaeuterung')}</p>
            )}
          </div>
          <Bound form={form} name="feedbacktext" rows={5} />
          <FieldErrorSummary forms={[form]} />
          {submit.offline && (
            <p className="text-sm text-muted-foreground">{tx('Keine Verbindung — deine Eingaben sind gesichert.')}</p>
          )}
          {submit.error && !submit.offline && (
            <p className="text-sm text-destructive">{submit.error.message}</p>
          )}
          <Button type="submit" className="w-full" disabled={submit.submitting}>
            {submit.submitting ? tx('Wird gesendet …') : tx('Absenden')}
          </Button>
        </form>
      )}
    </PublicShell>
  );
}
