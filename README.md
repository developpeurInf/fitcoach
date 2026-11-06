# FitCoach

Application de coaching fitness (iOS, Android, web) avec un coach IA (Claude).
Un seul code Expo / React Native ; backend Supabase ; appels IA uniquement côté serveur.

> Statut : **phase 6** (suivi de progression). Les bilans IA, l'adaptation hebdomadaire et le chat arrivent en phase 7.

## Stack

| Couche     | Choix                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| App        | Expo SDK 58, React Native, TypeScript strict, Expo Router (routes dans `src/app/`) |
| UI         | NativeWind v4 (Tailwind 3), mode sombre par défaut, `@expo/vector-icons`           |
| État       | Zustand (préférences locales) + TanStack Query (données serveur)                   |
| Validation | Zod                                                                                |
| i18n       | i18next + react-i18next (français par défaut, anglais prêt)                        |
| Backend    | Supabase : Auth, Postgres + RLS, Storage, Edge Functions (Deno)                    |
| IA         | API Anthropic appelée depuis les Edge Functions, modèle via `CLAUDE_MODEL`         |
| Tests      | Jest (`jest-expo`)                                                                 |

## Structure

```
coach-fitness-contexte.md     # prompt système du coach (source unique)
src/
  app/                        # écrans Expo Router
    _layout.tsx               # providers (Query, thème, i18n, gestures)
    (tabs)/                   # Aujourd'hui, Programme, Exercices, Progrès, Coach
  components/ui/              # Button, Text, Screen, EmptyState
  features/                   # logique par domaine (workout, progress, coach…) — phases 3+
  i18n/                       # config + traductions fr/en
  lib/                        # supabase, env (Zod), query-client, unités
  stores/                     # stores Zustand (préférences)
  theme/                      # tokens de couleur partagés avec Tailwind
  types/                      # types générés Supabase
supabase/
  config.toml                 # config locale (auth Google, redirections)
  migrations/                 # schéma, RLS, bucket photos, quotas IA
  seed.sql                    # bibliothèque d'exercices (générée)
  tests/database/             # tests pgTAP (RLS, quotas, 1RM)
  functions/_shared/          # client Anthropic, CORS, auth, prompt du coach
scripts/
  sync-coach-context.mjs      # copie le prompt du coach pour les Edge Functions
  seed-exercises.mjs          # génère supabase/seed.sql depuis free-exercise-db
```

## Installation

Prérequis : Node 20+, Docker (pour Supabase en local).

```bash
npm install
cp .env.example .env
cp supabase/functions/.env.example supabase/functions/.env   # ajoute ta clé ANTHROPIC_API_KEY
npx supabase start            # affiche l'URL et la clé anon à mettre dans .env
```

## Variables d'environnement

| Variable                                              | Où                                                  | Rôle                                       |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| `EXPO_PUBLIC_SUPABASE_URL`                            | `.env`                                              | URL du projet Supabase                     |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`                       | `.env`                                              | clé publique (anon / publishable)          |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | `.env`                                              | OAuth Google en local                      |
| `ANTHROPIC_API_KEY`                                   | `supabase/functions/.env` ou `supabase secrets set` | **secret serveur**, jamais dans l'app      |
| `CLAUDE_MODEL`                                        | idem                                                | modèle Claude (défaut `claude-sonnet-5-5`) |

Tout ce qui commence par `EXPO_PUBLIC_` est inclus dans l'app : n'y mets jamais de secret.

## Lancement

```bash
npm run web        # navigateur
npm run ios        # simulateur iOS (macOS)
npm run android    # émulateur ou appareil Android
npm run supabase:functions   # Edge Functions en local
```

Certaines librairies (notifications, secure store) demandent un _development build_ plutôt qu'Expo Go :
`npx eas-cli@latest build --profile development`.

## Base de données

| Table                                         | Contenu                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `profiles`                                    | profil d'onboarding, préférences, consentements (créé à l'inscription)                |
| `programs` → `workouts` → `workout_exercises` | ce que le coach a planifié (un seul programme actif)                                  |
| `workout_logs` → `set_logs`                   | ce que l'utilisateur a réellement fait ; tonnage et 1RM (Epley) calculés par Postgres |
| `body_measurements`                           | poids, mensurations, photo (bucket privé `progress-photos/<user_id>/…`)               |
| `personal_records`                            | records détectés à la fin de chaque séance (`detect_personal_records`)                |
| `coach_reports`                               | bilans IA (séance, semaine, mois, trimestre, année, adaptation)                       |
| `chat_messages`                               | historique du chat                                                                    |
| `exercises`                                   | bibliothèque partagée, en lecture seule pour les utilisateurs                         |
| `ai_usage`, `ai_limits`                       | quotas d'appels IA par utilisateur et par fonction                                    |

Sécurité : RLS activée partout, chaque utilisateur ne voit que ses lignes. Les rapports IA et les
réponses du coach sont écrits par les Edge Functions (rôle service) pour ne pas pouvoir être falsifiés.
Les quotas IA se règlent dans la table `ai_limits` ; chaque fonction appelle `consume_ai_quota()`.

```bash
npm run db:reset          # recrée la base locale : migrations + seed
npm run db:test           # tests pgTAP (RLS, quotas, colonnes calculées, séances, records, progression)
npm run db:types          # régénère src/types/database.ts
npm run seed:exercises    # régénère supabase/seed.sql depuis free-exercise-db
```

### Bibliothèque d'exercices

`seed.sql` contient 878 exercices de [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(domaine public), avec leurs images. Les 53 `exercise_id` de référence du coach (fichier de contexte §11)
sont mappés sur ces entrées et ont un nom français. `burpee` et `shoulder-dislocates` n'existent pas
dans la source : ils sont créés sans image et l'app utilisera la recherche YouTube. Les autres exercices
gardent leur nom anglais tant qu'ils ne sont pas traduits. Aucune URL n'est inventée : les images
pointent vers le dépôt source, les vidéos passent par `video_search_query` ou `youtube_video_id`.

## Authentification et onboarding

- Email + mot de passe, mot de passe oublié, et Google (OAuth PKCE : redirection sur le web, navigateur intégré sur mobile).
- Navigation protégée (`src/app/_layout.tsx`) : déconnecté → `(auth)`, connecté sans profil → `onboarding`, sinon → onglets.
- Onboarding en 8 étapes, validé par Zod (`src/features/onboarding/schema.ts`). L'avertissement santé et le
  consentement RGPD sont obligatoires et horodatés dans `profiles`. Mineurs et situations à risque
  (grossesse, cardiaque, hypertension, diabète, opération récente) affichent une recommandation d'avis médical.
- Le brouillon d'onboarding est sauvegardé sur l'appareil : fermer l'app ne fait pas perdre les réponses.

### Configurer Google

1. Google Cloud Console → Identifiants → ID client OAuth (type « Application Web »).
2. URI de redirection autorisée : `https://<projet>.supabase.co/auth/v1/callback` (local : `http://127.0.0.1:54321/auth/v1/callback`).
3. Supabase → Authentication → Providers → Google : colle l'ID client et le secret (local : variables
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` du `.env`).
4. Supabase → Authentication → URL Configuration : ajoute l'URL du site web et `fitcoach://**` aux redirections.

## Génération du programme (IA)

1. Fin de l'onboarding → l'écran Aujourd'hui appelle l'Edge Function `generate-program`.
2. La fonction vérifie la session et le quota (`consume_ai_quota`), charge le profil et l'envoie au
   coach (prompt système = `coach-fitness-contexte.md`, mis en cache).
3. Claude répond en **sortie structurée** (schéma JSON imposé par l'API) : semaines de périodisation
   (adaptation, progression, décharge, test) et une séance type par jour d'entraînement.
4. Le JSON est revalidé avec Zod (`supabase/functions/_shared/coach/program-schema.ts`, partagé avec l'app)
   et contrôlé : `exercise_id` existants dans la bibliothèque, nombre de séances, semaine de décharge…
   En cas d'échec, **un seul réessai** en renvoyant les erreurs au modèle, puis une erreur claire.
5. `program-builder.ts` déplie les semaines × séances types en séances datées (charges × intensité,
   séries × volume, arrondi à 1,25 kg), enregistrées en une transaction par `create_program()`.

Le modèle vient de `CLAUDE_MODEL` (défaut `claude-sonnet-5-5`). Pour les modèles qui le permettent,
le _fallback_ serveur est activé : si un filtre de sécurité refuse à tort une demande, l'API la
relance sur un autre modèle au lieu d'échouer.

## Séance en cours

- **Démarrer** (détail de la séance) : la séance est construite à partir du plan et de la dernière
  performance sur chaque exercice, puis gardée **sur le téléphone** (store Zustand persistant). La
  saisie marche hors connexion et survit à la fermeture de l'app ; « Reprendre » apparaît sur Aujourd'hui.
- **Saisie** : la série suivante est pré-remplie (série juste faite → même série la dernière fois →
  plan) ; reps, charge (pas de 2,5 kg / 5 lb) et RPE facultatif, validés en un geste.
- **Repos** : minuteur lancé à chaque série validée, avec la fin stockée en heure absolue (juste même
  après un passage en arrière-plan) ; vibration, retour haptique et bip à 0. L'écran reste allumé.
  La notification quand l'app est en arrière-plan arrive avec les notifications (phase 8).
- **Remplacer** : l'Edge Function `swap-exercise` propose au coach jusqu'à 40 variantes de la
  bibliothèque (même catégorie, mêmes muscles, matériel de l'utilisateur) ; la réponse est validée
  (Zod + exercice dans la liste) et remplace l'exercice de cette séance (`replaced_from` garde l'original).
- **Douleur** : zone, intensité, note, enregistrées avec la séance. À partir de 7/10, l'app applique
  la règle du coach : arrêter l'exercice, consulter si besoin, et propose de le remplacer.
- **Fin** : ressenti (1–5), énergie (1–5), commentaire, résumé (durée, séries, reps, tonnage).
  `finish_workout()` enregistre tout en une transaction, marque la séance faite et renvoie les
  records battus (charge max, 1RM estimé, reps max au poids du corps), affichés puis marqués célébrés.

## Suivi de progression

- **Filtres** Jour / Semaine / Mois / Trimestre / Année : chaque graphique montre les 14 derniers
  jours, 12 semaines, 12 mois, 8 trimestres ou 5 ans ; les chiffres clés portent sur la période en cours.
- **Données** : Postgres agrège par jour (vues `daily_training` et `exercise_daily_best`,
  `security_invoker` donc soumises à la RLS) ; l'app regroupe les jours par période
  (`src/features/progress/logic.ts`, testé). Les séries ne téléchargent jamais toutes les séries.
- **Graphiques** : tonnage, assiduité (séances faites / prévues à date), 1RM estimé (Epley, meilleure
  série de la période) par exercice, poids corporel et mensurations. Un toucher affiche la valeur,
  les lecteurs d'écran lisent un résumé. Composant SVG maison (`react-native-svg`, déjà présent) :
  Victory Native demande Skia (lourd et fragile sur le web) et react-native-svg-charts n'est plus maintenu.
- **Série en cours** : séances prévues faites d'affilée (une séance prévue aujourd'hui pas encore
  faite ne la casse pas).
- **Mesures** : poids, tours (taille, poitrine, hanches, bras, cuisse), masse grasse, notes et photo.
  Les photos vont dans le bucket privé `progress-photos/<user_id>/…` et s'affichent par URL signée.
  Le dernier poids mesuré met à jour le profil (déclencheur), utilisé par le coach.

### Tester les Edge Functions en local

```bash
npx supabase functions serve --env-file supabase/functions/.env
```

## Prompt du coach

`coach-fitness-contexte.md` est la source unique. Les Edge Functions ne voient que `supabase/functions/`,
donc après chaque modification :

```bash
npm run sync:coach   # régénère supabase/functions/_shared/coach-context.ts
```

## Qualité

```bash
npm run typecheck
npm run lint
npm test
```

## Déploiement

- **Mobile** : EAS (`eas.json` : profils development / preview / production).
- **Web** : `npx expo export --platform web` puis déploiement du dossier `dist/` sur Vercel ou Netlify (SPA).
- **Supabase** : `npx supabase link`, `npx supabase db push --include-seed`, `npx supabase functions deploy`,
  `npx supabase secrets set --env-file supabase/functions/.env`.

Le détail sera complété en phase 8.
