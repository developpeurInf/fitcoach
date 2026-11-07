// periodic-report: weekly, monthly, quarterly or yearly report (context §9.2 / §9.3).
// Figures come from coach_period_metrics() (Postgres); the coach adds the analysis.
// POST { type, today? } → 200 { report } for the last complete period (cached per period).
import { z } from 'zod';

import { generateStructured } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/auth.ts';
import { json } from '../_shared/cors.ts';
import { loadCoachContext, resolveToday } from '../_shared/coach/context.ts';
import {
  PERIODIC_TYPES,
  periodicReportSchema,
  reportPeriod,
  TYPE_LABELS,
} from '../_shared/coach/reports.ts';
import { aiHandler, HttpError } from '../_shared/http.ts';

const bodySchema = z.object({ type: z.enum(PERIODIC_TYPES), today: z.string().optional() });

const FOCUS: Record<(typeof PERIODIC_TYPES)[number], string> = {
  weekly:
    'assiduité, volume vs semaine précédente, meilleures performances, exercices en stagnation, ressenti moyen, ajustements pour la semaine suivante. "decision" = null, "jalons" et "objectifs_prochain_cycle" vides.',
  monthly:
    'évolution du poids et des mensurations, progression de force (1RM estimés des mouvements clés), assiduité et volume par groupe musculaire, ce qui fonctionne / ce qui doit changer. "decision" obligatoire (continuer, ajuster ou changer_de_bloc).',
  quarterly:
    'bilan global avant / après, objectifs atteints ou non, retests de performance à prévoir, nouveau cycle. "decision" obligatoire, "jalons" (badges débloqués) et "objectifs_prochain_cycle" remplis.',
  yearly:
    'bilan de l’année : avant / après, objectifs atteints ou non, jalons marquants, objectifs de l’année suivante. "decision" obligatoire, "jalons" et "objectifs_prochain_cycle" remplis.',
};

Deno.serve(
  aiHandler(
    'periodic-report',
    async ({ req, client, user, useQuota }) => {
      const parsed = bodySchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) throw new HttpError(400, 'bad_request', 'Requête invalide.');
      const { type } = parsed.data;
      const { start, end } = reportPeriod(type, resolveToday(parsed.data.today));

      const { data: existing } = await client
        .from('coach_reports')
        .select('*')
        .eq('report_type', type)
        .eq('period_start', start)
        .eq('period_end', end)
        .is('workout_log_id', null)
        .maybeSingle();
      if (existing) return json({ report: existing });

      const { data: metrics, error } = await client.rpc('coach_period_metrics', {
        p_from: start,
        p_to: end,
      });
      if (error) throw error;
      const m = metrics as { seances_realisees: number; mesures: Record<string, unknown> };
      if (!m.seances_realisees && Object.keys(m.mesures ?? {}).length === 0) {
        throw new HttpError(
          400,
          'bad_request',
          'Pas encore assez de données sur cette période pour un bilan.',
        );
      }

      const ctx = await loadCoachContext(client, user.id, type === 'weekly' ? 5 : 10);
      await useQuota();
      const { data: analysis, model } = await generateStructured({
        schema: periodicReportSchema,
        maxTokens: 6000,
        effort: type === 'weekly' ? 'low' : 'medium',
        prompt: `Mode données (JSON). Rédige l'analyse du bilan ${TYPE_LABELS[type]} (§9.2) du ${start} au ${end}.

Profil : ${JSON.stringify(ctx.profile)}

Chiffres de la période, calculés par l'app (ne les recalcule pas et n'en invente pas d'autres) :
${JSON.stringify(metrics)}

Dernières séances (résumé) : ${JSON.stringify(ctx.history)}

Points à couvrir : ${FOCUS[type]}

Consignes : phrases courtes, tutoiement, concret (cite les chiffres fournis). "exercices_en_stagnation" : exercise_id présents dans les données. Si l'assiduité est faible, pas de culpabilisation : propose une séance minimale (§10).`,
      });

      const { data: saved, error: saveError } = await adminClient()
        .from('coach_reports')
        .insert({
          user_id: user.id,
          report_type: type,
          period_start: start,
          period_end: end,
          payload: { type_rapport: TYPE_LABELS[type], ...(metrics as object), ...analysis },
          model,
        })
        .select()
        .single();
      if (saveError) throw saveError;
      return json({ report: saved });
    },
    { lazyQuota: true },
  ),
);
