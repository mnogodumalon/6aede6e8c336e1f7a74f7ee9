import type { Teilnehmende, Veranstaltungen, Feedbacks } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface TeilnehmendeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Teilnehmende;
  /** N:1-Ziel „Veranstaltungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  veranstaltungenList: Veranstaltungen[];
  /** Klick auf die Veranstaltungen-Relation → overlay.push auf dessen Detail. */
  onOpenVeranstaltungen?: (record: Veranstaltungen) => void;
  /** 1:N „Feedbacks" (teilnehmer): VOLLE Liste — der Block filtert auf diesen Record. */
  feedbacksList: Feedbacks[];
  /** Zeilen-Klick → overlay.push auf das Feedbacks-Detail (nie der Edit-Dialog). */
  onOpenFeedbacks: (record: Feedbacks) => void;
  /** Kontextuelles „+": öffnet den Feedbacks-Dialog mit diesem Record vorgesetzt. */
  onAddFeedbacks?: () => void;
}

export function TeilnehmendeDetails({
  record,
  veranstaltungenList,
  onOpenVeranstaltungen,
  feedbacksList,
  onOpenFeedbacks,
  onAddFeedbacks,
}: TeilnehmendeDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const veranstaltungTarget = veranstaltungenList.find(r => r.record_id === extractRecordId(record.fields.veranstaltung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('teilnehmende', 'kuerzel')} value={record.fields.kuerzel} format="text" />
        <RecordField label={fieldLabel('teilnehmende', 'sterne')} value={record.fields.sterne} format="pill" />
        <RecordField label={fieldLabel('teilnehmende', 'bewertungskommentar')} value={record.fields.bewertungskommentar} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('teilnehmende', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('teilnehmende', 'einwilligung')} value={record.fields.einwilligung} format="bool" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('teilnehmende', 'veranstaltung')}
          name={veranstaltungTarget?.fields.titel ?? '—'}
          meta={[veranstaltungTarget?.fields.ort].filter(Boolean).join(' · ') || undefined}
          onClick={veranstaltungTarget && onOpenVeranstaltungen ? () => onOpenVeranstaltungen!(veranstaltungTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('feedbacks')}
        items={feedbacksList.filter(r => extractRecordId(r.fields.teilnehmer) === record.record_id)}
        map={r => ({ name: r.fields.absende_kennung ?? appLabel('feedbacks'), meta: undefined })}
        onOpen={onOpenFeedbacks}
        onAdd={onAddFeedbacks}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TEILNEHMENDE} recordId={record.record_id} readOnly={!perms.canWrite('teilnehmende')} />
    </>
  );
}
