/**
 * Interaktionen vorbereiten — 3-Schritt-Wizard.
 * Steps: 1) Veranstaltung auswählen → 2) Mehrere Interaktionen erfassen (Reihenfolge, Frage, Erläuterung, Vor-/Endprompt) → 3) Prüfen & speichern.
 * Reads: veranstaltungen. Writes: interaktionen (mehrere pro Durchlauf, aktiv = false).
 * Composes: IntentWizardShell, EntitySelectStep, ListEntries, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ListEntries } from '@/components/blocks/ListEntries';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldNumber } from '@/lib/journey';
import { useInteraktionenVorbereitenFlow } from '@/lib/journey/flows/InteraktionenVorbereiten';
import { tx } from '@/i18n';

export default function InteraktionenVorbereitenPage() {
  const [step, setStep] = useState(1);
  const flow = useInteraktionenVorbereitenFlow({
    steps: { veranstaltung: 1, reihenfolge: 2, frage: 2, erlaeuterung: 2, vorprompt: 2, endprompt: 2 },
    items: {
      veranstaltung: r => {
        const beginn = fieldDate(r, 'beginn');
        const when = beginn ? format(parseISO(beginn), 'dd.MM.yyyy HH:mm') : '';
        const subtitle = [when, fieldText(r, 'ort')].filter(Boolean).join(' · ');
        return { id: r.id, title: fieldText(r, 'titel'), subtitle: subtitle || undefined };
      },
    },
  });

  const facts = flow.submit.result
    ? Object.values(flow.submit.result.records)
        .filter(r => fieldText(r, 'frage'))
        .sort((a, b) => (fieldNumber(a, 'reihenfolge') ?? 0) - (fieldNumber(b, 'reihenfolge') ?? 0))
        .map(r => ({
          label: tx`Nr. ${fieldNumber(r, 'reihenfolge') ?? '–'}`,
          value: fieldText(r, 'frage'),
        }))
    : [];

  return (
    <IntentWizardShell
      title={tx('Interaktionen vorbereiten')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Lege für eine Veranstaltung mehrere Interaktionen in fester Reihenfolge an.'),
        needs: [tx('Die Veranstaltung'), tx('Fragen mit Reihenfolge'), tx('Optional Erläuterung, Vorprompt und Endprompt')],
      }}
    >
      <WizardStep label={tx('Veranstaltung')} description={tx('Für welche Veranstaltung bereitest du Interaktionen vor?')}>
        <EntitySelectStep
          {...flow.picks.veranstaltung.select}
          {...flow.pick('veranstaltung')}
          searchPlaceholder={tx('Titel oder Ort suchen …')}
        />
        <StepNav hideBack nextStepLabel={tx('Interaktionen')} />
      </WizardStep>
      <WizardStep
        label={tx('Interaktionen')}
        description={tx('Erfasse jede Interaktion und füge sie hinzu — du kannst beliebig viele anlegen.')}
        needs={['veranstaltung']}
      >
        <ListEntries list={flow.lists.interaktionen}>
          <Bound form={flow.forms.interaktionen} name="reihenfolge" hint={tx('Position in der Abfolge, z. B. 1')} />
          <Bound form={flow.forms.interaktionen} name="frage" />
          <Bound form={flow.forms.interaktionen} name="erlaeuterung" />
          <Bound form={flow.forms.interaktionen} name="vorprompt" />
          <Bound form={flow.forms.interaktionen} name="endprompt" />
        </ListEntries>
        <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Prüfen')} />
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              { key: 'aktiv', label: tx('Aktiv'), value: tx('Nein') },
              {
                key: 'veranstaltung',
                label: tx('Veranstaltung'),
                value: flow.picks.veranstaltung.labelOf(String(flow.forms.interaktionen.get('veranstaltung') ?? '')) ?? '—',
                step: 1,
                keys: ['veranstaltung'],
              },
            ]}
            whatHappensNext={tx('Die Interaktionen werden angelegt, keine ist zunächst aktiv.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          facts={facts.length ? facts : undefined}
          submit={flow.submit}
          title={tx('Interaktionen angelegt')}
          next={[{ label: tx('Zum Dashboard'), href: '#/' }]}
          whatHappensNext={tx('Keine Interaktion ist aktiv — aktiviere sie, wenn sie an der Reihe ist.')}
        />
      )}
    </IntentWizardShell>
  );
}
