import type { Feedbacks, Interaktionen, Teilnehmende } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { usePermissions } from '@/lib/permissions';

export interface FeedbacksDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Feedbacks;
  /** N:1-Ziel „Interaktionen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  interaktionenList: Interaktionen[];
  /** Klick auf die Interaktionen-Relation → overlay.push auf dessen Detail. */
  onOpenInteraktionen?: (record: Interaktionen) => void;
  /** N:1-Ziel „Teilnehmende": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  teilnehmendeList: Teilnehmende[];
  /** Klick auf die Teilnehmende-Relation → overlay.push auf dessen Detail. */
  onOpenTeilnehmende?: (record: Teilnehmende) => void;
}

export function FeedbacksDetails({
  record,
  interaktionenList,
  onOpenInteraktionen,
  teilnehmendeList,
  onOpenTeilnehmende,
}: FeedbacksDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const interaktionTarget = interaktionenList.find(r => r.record_id === extractRecordId(record.fields.interaktion));
  const teilnehmerTarget = teilnehmendeList.find(r => r.record_id === extractRecordId(record.fields.teilnehmer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('feedbacks', 'feedbacktext')} value={record.fields.feedbacktext} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('feedbacks', 'absende_kennung')} value={record.fields.absende_kennung} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('feedbacks', 'interaktion')}
          name={interaktionTarget?.fields.frage ?? '—'}
          meta={undefined}
          onClick={interaktionTarget && onOpenInteraktionen ? () => onOpenInteraktionen!(interaktionTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('feedbacks', 'teilnehmer')}
          name={teilnehmerTarget?.fields.bewertungskommentar ?? '—'}
          meta={[teilnehmerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={teilnehmerTarget && onOpenTeilnehmende ? () => onOpenTeilnehmende!(teilnehmerTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.FEEDBACKS} recordId={record.record_id} readOnly={!perms.canWrite('feedbacks')} />
    </>
  );
}
