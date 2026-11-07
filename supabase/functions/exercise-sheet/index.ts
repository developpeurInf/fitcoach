// exercise-sheet: technique sheet of a library exercise (context §7), written by the coach the
// first time someone opens it, then stored on the exercise and shared by every user.
// POST { exercise_id } → 200 { exercise } (with instructions_fr, common_mistakes_fr…)
import { z } from 'zod';

import { generateStructured } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/auth.ts';
import { checkSheet, exerciseSheetSchema } from '../_shared/coach/sheet.ts';
import { json } from '../_shared/cors.ts';
import { aiHandler, HttpError } from '../_shared/http.ts';

const bodySchema = z.object({ exercise_id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/) });
const FIELDS =
  'id, name_fr, name_en, category, level, mechanic, force, primary_muscles, secondary_muscles, equipment, instructions_en, instructions_fr, common_mistakes_fr, breathing_tip_fr, easier_variant_id, harder_variant_id, is_reference';
const LEVELS = ['beginner', 'intermediate', 'advanced'];

Deno.serve(
  aiHandler(
    'exercise-sheet',
    async ({ req, client, useQuota }) => {
      const parsed = bodySchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) throw new HttpError(400, 'bad_request', 'Requête invalide.');

      const { data: exercise, error } = await client
        .from('exercises')
        .select(FIELDS)
        .eq('id', parsed.data.exercise_id)
        .maybeSingle();
      if (error) throw error;
      if (!exercise) throw new HttpError(404, 'not_found', 'Exercice introuvable.');
      if (exercise.instructions_fr.length > 0) return json({ exercise });

      // Variant candidates: same kind of exercise and muscles, reference exercises first.
      const { data: library, error: libError } = await client
        .from('exercises')
        .select('id, name_fr, level, equipment, is_reference')
        .eq('category', exercise.category)
        .overlaps('primary_muscles', exercise.primary_muscles)
        .neq('id', exercise.id)
        .order('is_reference', { ascending: false })
        .limit(40);
      if (libError) throw libError;
      const candidateIds = new Set(library.map((e) => e.id as string));

      await useQuota();
      const { data: sheet, model } = await generateStructured({
        schema: exerciseSheetSchema,
        check: (s) => checkSheet(s, { exerciseId: exercise.id, candidateIds }),
        maxTokens: 2000,
        effort: 'low',
        prompt: `Mode données (JSON). Rédige la fiche technique de cet exercice (§7 « Fiche technique »), en français, tutoiement, phrases courtes.

Exercice : ${JSON.stringify({
          id: exercise.id,
          nom_actuel: exercise.name_fr,
          nom_anglais: exercise.name_en,
          niveau: exercise.level,
          mecanique: exercise.mechanic,
          muscles_principaux: exercise.primary_muscles,
          muscles_secondaires: exercise.secondary_muscles,
          materiel: exercise.equipment,
          instructions_source_en: exercise.instructions_en,
        })}

Variantes possibles (id | nom | niveau | matériel) :
${library.map((e) => `- ${e.id} | ${e.name_fr} | ${e.level} | ${e.equipment.join(', ')}`).join('\n')}

Consignes :
- "nom_fr" : le nom français usuel du mouvement${exercise.is_reference ? ` (garde « ${exercise.name_fr} »)` : ''}.
- "etapes" : 3 à 5 étapes d'exécution, fidèles aux instructions sources.
- "erreurs" : 2 à 3 erreurs courantes ; "respiration" : un conseil respiratoire.
- "variante_facile_id" / "variante_difficile_id" : un id de la liste ci-dessus (niveau ${LEVELS.join(' < ')}), ou null si aucune ne convient.`,
      });

      const { data: saved, error: saveError } = await adminClient()
        .from('exercises')
        .update({
          ...(exercise.is_reference ? {} : { name_fr: sheet.nom_fr }),
          instructions_fr: sheet.etapes,
          common_mistakes_fr: sheet.erreurs,
          breathing_tip_fr: sheet.respiration,
          easier_variant_id: sheet.variante_facile_id,
          harder_variant_id: sheet.variante_difficile_id,
        })
        .eq('id', exercise.id)
        .select(FIELDS)
        .single();
      if (saveError) throw saveError;
      console.log(`[exercise-sheet] ${exercise.id} (${model})`);
      return json({ exercise: saved });
    },
    { lazyQuota: true },
  ),
);
