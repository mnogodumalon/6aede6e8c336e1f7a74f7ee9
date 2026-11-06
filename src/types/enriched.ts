import type { Feedbacks, Interaktionen, Teilnehmende } from './app';

export type EnrichedInteraktionen = Interaktionen & {
  veranstaltungName: string;
};

export type EnrichedTeilnehmende = Teilnehmende & {
  veranstaltungName: string;
};

export type EnrichedFeedbacks = Feedbacks & {
  interaktionName: string;
  teilnehmerName: string;
};
