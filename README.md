# FitCoach

Application de coaching fitness (iOS, Android, web) avec un coach IA (Claude).
Un seul code Expo / React Native ; backend Supabase ; appels IA uniquement côté serveur.

> Statut : **phase 2** (base de données). Auth, IA et écrans réels arrivent dans les phases suivantes.

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
| `personal_records`                            | records détectés                                                                      |
| `coach_reports`                               | bilans IA (séance, semaine, mois, trimestre, année, adaptation)                       |
| `chat_messages`                               | historique du chat                                                                    |
| `exercises`                                   | bibliothèque partagée, en lecture seule pour les utilisateurs                         |
| `ai_usage`, `ai_limits`                       | quotas d'appels IA par utilisateur et par fonction                                    |

Sécurité : RLS activée partout, chaque utilisateur ne voit que ses lignes. Les rapports IA et les
réponses du coach sont écrits par les Edge Functions (rôle service) pour ne pas pouvoir être falsifiés.
Les quotas IA se règlent dans la table `ai_limits` ; chaque fonction appelle `consume_ai_quota()`.

```bash
npm run db:reset          # recrée la base locale : migrations + seed
npm run db:test           # tests pgTAP (isolation RLS, quotas, colonnes calculées)
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
