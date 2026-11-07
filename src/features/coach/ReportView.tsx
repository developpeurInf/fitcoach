import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Notice, Text } from '@/components/ui';
import { StatTile } from '@/features/progress/Cards';
import { formatDayLong } from '@/lib/dates';
import { displayWeight, formatBodyWeight, formatWeight } from '@/lib/units';
import { useSettings } from '@/stores/settings';
import type { CoachReport } from '@/types/models';

import type { Adaptation, PeriodicReport, SessionReport } from '@coach/reports';

type Metrics = {
  assiduite?: { prevues: number; realisees: number; taux_pct: number | null };
  seances_realisees?: number;
  volume_total_kg?: number;
  variation_volume_pct?: number | null;
  ressenti_moyen?: number | null;
  energie_moyenne?: number | null;
  mouvements_cles?: {
    exercise_id: string;
    nom: string;
    rm1_debut_kg: number;
    rm1_max_kg: number;
  }[];
  mesures?: {
    debut?: { poids_kg?: number; tour_taille_cm?: number };
    fin?: { poids_kg?: number; tour_taille_cm?: number };
  };
};

export function reportTitle(r: CoachReport, t: ReturnType<typeof useTranslation>['t']) {
  const week = (r.payload as { semaine?: number }).semaine;
  return t(`coach.reports.titles.${r.report_type}`, { week });
}

export function reportPeriodLabel(r: CoachReport, t: ReturnType<typeof useTranslation>['t']) {
  return r.period_start === r.period_end
    ? formatDayLong(r.period_start)
    : t('coach.reports.period', {
        start: formatDayLong(r.period_start),
        end: formatDayLong(r.period_end),
      });
}

/** Renders any report: after a session, periodic (with database figures) or a week adjustment. */
export function ReportView({ report }: { report: CoachReport }) {
  if (report.report_type === 'session') return <SessionBody p={report.payload as SessionReport} />;
  if (report.report_type === 'adaptation')
    return <AdaptationBody p={report.payload as AdaptationPayload} />;
  return <PeriodicBody p={report.payload as PeriodicReport & Metrics} />;
}

function List({ title, items }: { title: string; items: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <View className="gap-2">
      <Text variant="heading">{title}</Text>
      {items.map((x, i) => (
        <Text key={i}>• {x}</Text>
      ))}
    </View>
  );
}

export function SessionBody({ p }: { p: SessionReport }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  return (
    <View className="gap-4">
      <Text>{p.bilan}</Text>
      <List title={t('coach.reports.strengths')} items={p.points_forts} />
      <View className="gap-1">
        <Text variant="heading">{t('coach.session.improve')}</Text>
        <Text>{p.point_a_ameliorer}</Text>
      </View>
      {p.charges_prochaine_seance.length ? (
        <View className="gap-2">
          <Text variant="heading">{t('coach.reports.nextLoads')}</Text>
          {p.charges_prochaine_seance.map((c) => (
            <View
              key={c.exercise_id}
              className="gap-0.5 rounded-2xl bg-ink-100 p-3 dark:bg-ink-800"
            >
              <Text className="font-bold">
                {c.nom}
                {c.charge_kg != null ? ` · ${formatWeight(c.charge_kg, unit, i18n.language)}` : ''}
                {c.repetitions ? ` · ${c.repetitions} reps` : ''}
              </Text>
              <Text variant="caption">{c.conseil}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Notice tone="info">{p.message_coach}</Notice>
    </View>
  );
}

function PeriodicBody({ p }: { p: PeriodicReport & Metrics }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const n = (v: number) => Math.round(v).toLocaleString(i18n.language);
  const a = p.assiduite;
  const body = p.mesures;
  const weight =
    body?.debut?.poids_kg != null && body?.fin?.poids_kg != null
      ? `${formatBodyWeight(body.debut.poids_kg, unit, i18n.language).replace(/ \S+$/, '')} → ${formatBodyWeight(body.fin.poids_kg, unit, i18n.language)}`
      : null;
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        <StatTile
          label={t('coach.reports.attendance')}
          value={a?.taux_pct != null ? `${a.taux_pct} %` : '–'}
          hint={a ? `${a.realisees} / ${a.prevues}` : null}
        />
        <StatTile
          label={t('coach.reports.volume')}
          value={`${n(displayWeight(p.volume_total_kg ?? 0, unit))} ${unit}`}
          hint={
            p.variation_volume_pct != null
              ? `${p.variation_volume_pct > 0 ? '+' : ''}${p.variation_volume_pct.toLocaleString(i18n.language)} % ${t('coach.reports.volumeChange')}`
              : null
          }
        />
        {p.ressenti_moyen != null ? (
          <StatTile label={t('coach.reports.feeling')} value={`${p.ressenti_moyen} / 5`} />
        ) : null}
        {weight ? <StatTile label={t('coach.reports.bodyChange')} value={weight} /> : null}
      </View>
      {p.decision ? (
        <Notice tone="info" title={t('coach.reports.decision')}>
          {t(`coach.reports.decisions.${p.decision}`)}
        </Notice>
      ) : null}
      {p.mouvements_cles?.length ? (
        <View className="gap-2">
          <Text variant="heading">{t('coach.reports.keyLifts')}</Text>
          {p.mouvements_cles.map((l) => (
            <Text key={l.exercise_id}>
              • {l.nom} : {formatWeight(l.rm1_debut_kg, unit, i18n.language)} →{' '}
              {formatWeight(l.rm1_max_kg, unit, i18n.language)}
            </Text>
          ))}
        </View>
      ) : null}
      <List title={t('coach.reports.strengths')} items={p.points_forts} />
      <List title={t('coach.reports.improve')} items={p.points_a_ameliorer} />
      <List title={t('coach.reports.nextAdjustments')} items={p.ajustements_periode_suivante} />
      <List title={t('coach.reports.milestones')} items={p.jalons} />
      <List title={t('coach.reports.nextGoals')} items={p.objectifs_prochain_cycle} />
      <Notice tone="info">{p.message_coach}</Notice>
    </View>
  );
}

type AdaptationPayload = Omit<Adaptation, 'ajustements'> & {
  semaine: number;
  ajustements: (Adaptation['ajustements'][number] & { nom?: string; nom_avant?: string })[];
};

export function AdaptationBody({ p }: { p: AdaptationPayload }) {
  const { t, i18n } = useTranslation();
  const unit = useSettings((s) => s.unit);
  return (
    <View className="gap-4">
      <Notice tone="info" title={t(`coach.reports.weekDecision.${p.decision_semaine}`)}>
        {p.message_coach}
      </Notice>
      {p.alertes.length ? (
        <Notice tone="warning" title={t('coach.reports.alerts')}>
          {p.alertes.join('\n')}
        </Notice>
      ) : null}
      <View className="gap-2">
        <Text variant="heading">{t('coach.reports.changes')}</Text>
        {p.ajustements.length === 0 ? <Text variant="caption">{t('coach.adapt.none')}</Text> : null}
        {p.ajustements.map((a) => (
          <View
            key={a.workout_exercise_id}
            className="gap-0.5 rounded-2xl bg-ink-100 p-3 dark:bg-ink-800"
          >
            {a.nom ? <Text className="font-bold">{a.nom}</Text> : null}
            <Text className={a.nom ? undefined : 'font-bold'}>
              {a.series} × {a.duree_sec ? `${a.duree_sec} s` : a.repetitions}
              {a.charge_suggeree_kg != null
                ? ` · ${formatWeight(a.charge_suggeree_kg, unit, i18n.language)}`
                : ''}
            </Text>
            {a.nom_avant ? (
              <Text variant="caption">{t('coach.reports.from', { name: a.nom_avant })}</Text>
            ) : null}
            <Text variant="caption">{a.raison}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
