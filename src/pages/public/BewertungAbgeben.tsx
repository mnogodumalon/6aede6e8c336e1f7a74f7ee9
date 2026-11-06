import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicShell } from '@/components/PublicShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useLiveList,
  useStepForm,
  useJourneySubmit,
  useVisitorKey,
  fieldText,
  labelOf,
} from '@/lib/journey';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { LoadProblem } from '@/components/blocks/LoadProblem';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { FieldErrorSummary } from '@/components/blocks/FieldErrorSummary';
import { tx } from '@/i18n';

const SLUG = 'bewertung-abgeben';

export default function BewertungAbgeben() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return <BewertungInner cfg={cfg} page={page} />;
}

function BewertungInner({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [params] = useSearchParams();
  const veranstaltungId = params.get('veranstaltung');
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const kuerzel = useVisitorKey();
  const live = useLiveList(port, 'veranstaltungen', { intervalMs: 0, enabled: !!veranstaltungId });
  const [step, setStep] = useState(1);

  const form = useStepForm('teilnehmende', {
    fields: ['sterne', 'bewertungskommentar', 'email', 'einwilligung'],
    required: { sterne: true, bewertungskommentar: false, email: false, einwilligung: false },
    steps: { sterne: 1, bewertungskommentar: 1, email: 2, einwilligung: 2 },
    autoComplete: true,
  });
  const submit = useJourneySubmit(
    port,
    [
      {
        key: 'teilnehmende',
        entity: 'teilnehmende',
        form,
        primary: true,
        values: { veranstaltung: veranstaltungId ?? '', kuerzel: kuerzel },
      },
    ],
    { draftKey: `bewertung-${veranstaltungId ?? 'ohne'}` },
  );

  const record = live.records.find(r => r.id === veranstaltungId);

  if (!veranstaltungId) {
    return (
      <PublicShell title={page.title}>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link ist unvollständig. Scanne bitte den QR-Code der Veranstaltung noch einmal.')}
        </p>
      </PublicShell>
    );
  }
  if (!live.loaded && live.error) {
    return (
      <PublicShell title={page.title}>
        <LoadProblem onRetry={live.reload} />
      </PublicShell>
    );
  }
  if (!live.loaded) {
    return <PublicShell loading />;
  }
  if (!record) {
    return (
      <PublicShell title={page.title}>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link passt zu keiner Veranstaltung. Scanne bitte den QR-Code noch einmal.')}
        </p>
      </PublicShell>
    );
  }

  const send = async (withEmail: boolean) => {
    if (!form.validate(withEmail ? ['sterne', 'email', 'einwilligung'] : ['sterne'])) return;
    if (!withEmail) {
      form.set('email', '');
      form.set('einwilligung', false);
    } else if (form.get('email') && form.get('einwilligung') !== true) {
      form.validate(['einwilligung']);
      return;
    }
    await submit.run();
  };

  const steps = [{ label: tx('Bewertung') }, { label: tx('Auswertung per E-Mail') }];
  const hasEmail = !!String(form.get('email') ?? '').trim();

  return (
    <PublicShell
      title={page.title}
      description={fieldText(record, 'titel')}
    >
      <IntentWizardShell
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[form]}
        draftKey={`bewertung-${veranstaltungId}`}
      >
        {step === 1 && !submit.result && (
          <>
            <Bound form={form} name="sterne" />
            <Bound form={form} name="bewertungskommentar" rows={4} />
            <StepNav
              hideBack
              onNext={() => form.validate(['sterne'])}
              nextStepLabel={tx('Auswertung per E-Mail')}
            >
              <Button type="button" variant="ghost" onClick={() => send(false)} disabled={submit.submitting}>
                {tx('Ohne E-Mail senden')}
              </Button>
            </StepNav>
          </>
        )}
        {step === 2 && !submit.result && (
          <>
            <p className="text-sm text-muted-foreground">
              {tx('Freiwillig: Wir schicken dir deine persönliche Auswertung per E-Mail.')}
            </p>
            <Bound form={form} name="email" />
            <Field form={form} name="einwilligung" hideLabel>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox {...form.checkbox('einwilligung')} />
                <span>{labelOf('teilnehmende', 'einwilligung')}</span>
              </label>
            </Field>
            <FieldErrorSummary forms={[form]} />
            {submit.error && (
              <p className="text-sm text-destructive">
                {tx('Das Senden hat nicht geklappt. Bitte versuche es noch einmal.')}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => send(true)} disabled={submit.submitting || !hasEmail}>
                {tx('Mit E-Mail senden')}
              </Button>
              <Button type="button" variant="outline" onClick={() => send(false)} disabled={submit.submitting}>
                {tx('Nein, danke')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                {tx('Zurück')}
              </Button>
            </div>
          </>
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            title={tx('Danke für deine Bewertung!')}
            whatHappensNext={tx`Dein Kürzel: ${kuerzel}`}
            actions={{ copy: false, print: false }}
          >
            <Button asChild variant="outline">
              <Link to={`/public/feedback-geben?veranstaltung=${veranstaltungId}`}>
                {tx('Zum Feedback geben')}
              </Link>
            </Button>
          </SuccessStep>
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
