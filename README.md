# FitCoach

Application de coaching fitness (iOS, Android, web) avec un coach IA (Claude).
Un seul code Expo / React Native ; backend Supabase ; appels IA uniquement côté serveur.

> Statut : **phase 1** (initialisation). Base de données, auth, IA et écrans réels arrivent dans les phases suivantes.

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
  migrations/                 # migrations SQL (phase 2)
  functions/_shared/          # client Anthropic, CORS, auth, prompt du coach
scripts/sync-coach-context.mjs
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
- **Supabase** : `npx supabase link`, `npx supabase db push`, `npx supabase functions deploy`,
  `npx supabase secrets set --env-file supabase/functions/.env`.

Le détail sera complété en phase 8.
