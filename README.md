# FitCoach

Application de coaching fitness (iOS, Android, web) avec un coach IA (Claude).
Un seul code Expo / React Native ; backend Supabase ; appels IA uniquement côté serveur.

> Statut : **phase 8** terminée : application complète (bibliothèque, séances, progrès, coach IA, rappels, RGPD), prête à déployer.

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
  components/                 # ui/ (Button, Text, Screen, Sheet, Segmented…), charts/
  features/                   # logique par domaine (session, progress, coach, exercises, reminders, account…)
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
  functions/                  # 9 Edge Functions (IA, suppression de compte)
  functions/_shared/          # client Anthropic, CORS, auth, quotas, contrats Zod du coach
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

## Coach IA (bilans, adaptation, chat)

Quatre Edge Functions, toutes avec la clé Anthropic côté serveur, JSON validé par Zod (un nouvel essai,
puis une erreur claire) et un quota par utilisateur (consommé seulement quand l'IA est vraiment appelée) :

| Fonction           | Quand                                                         | Ce qu'elle fait                                                                                      |
| ------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `session-feedback` | écran de fin de séance                                        | bilan court, points forts, charges conseillées pour la prochaine fois (exercices faits uniquement)   |
| `periodic-report`  | onglet Coach › Bilans (semaine, mois, trimestre, année)       | chiffres calculés par Postgres (`coach_period_metrics`), le coach commente sans inventer de chiffres |
| `adapt-week`       | automatiquement sur Aujourd'hui, 2 jours avant une semaine 2+ | ajuste charges, volume et exercices de la semaine (§3.6) ; une seule fois par semaine                |
| `chat`             | onglet Coach et bouton « Coach » pendant la séance            | réponse en streaming (SSE) ; réponses de 1 à 2 phrases pendant une séance                            |

- **Historique résumé** : `coach_history(n)` envoie une ligne par exercice et par séance (séries,
  reps « 8/8/7 », charge max, 1RM estimé, RPE moyen, prévu), jamais chaque série.
- **Mémoire du chat** : les 20 derniers messages sont envoyés tels quels ; au-delà de 40 messages non
  résumés, les plus anciens sont résumés dans `chat_memory` (écrite par le serveur seulement).
- **Rapports** : tous dans `coach_reports` (types `session`, `weekly`, `monthly`, `quarterly`,
  `yearly`, `adaptation`), en lecture seule pour l'utilisateur.

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

## Bibliothèque d'exercices

Onglet **Exercices** : 878 exercices (free-exercise-db, licence Unlicense), ceux de la bibliothèque du
coach (noms français) en premier. Recherche par mot en français ou en anglais (« pecs haltères »,
« squat barre », « bench press »), filtres muscle et matériel, chargement par pages de 30.

La **fiche technique** (§7 : étapes, erreurs courantes, respiration, variantes plus facile et plus
difficile) est écrite par le coach la première fois qu'un utilisateur ouvre l'exercice
(Edge Function `exercise-sheet`), puis enregistrée sur l'exercice et partagée par tous. Les variantes
sont choisies parmi les exercices de la bibliothèque. Aucun média n'est inventé : photos et GIF
viennent de la base, la vidéo n'apparaît que si un identifiant YouTube réel est connu.

## Paramètres, rappels et données

- **Profil** : prénom, objectif, séances par semaine, durée, matériel. Le coach en tient compte dès le
  prochain ajustement de semaine.
- **Affichage** : thème sombre / clair / système, kg ou lb, taille du texte (×1, ×1,15, ×1,3).
- **Rappels** (application mobile) : notification locale à l'heure choisie chaque jour de séance des
  deux semaines à venir, recalculée quand le programme change. La fin du repos sonne aussi quand
  l'app est en arrière-plan. Toucher le rappel ouvre la séance.
- **Export** (RGPD, droit d'accès et portabilité) : un fichier JSON avec profil, programmes, séances,
  séries, records, mesures, bilans, messages et mémoire du chat (les photos sont listées par chemin).
- **Suppression du compte** (droit à l'effacement) : Edge Function `delete-account`, après avoir tapé
  « SUPPRIMER ». Les photos sont effacées du Storage, puis le compte ; toutes les tables suivent en cascade.

## Intégration continue

`.github/workflows/ci.yml` lance à chaque pull request :

- `npm run lint`, `npm run typecheck`, `npm test` et le build web ;
- `deno check` de chaque Edge Function ;
- les migrations et les tests pgTAP (`supabase db start` puis `supabase test db`).

## Déploiement

### 1. Supabase (base, Auth, Storage, Edge Functions)

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push --include-seed              # schéma, RLS, bucket photos, bibliothèque d'exercices
npx supabase secrets set --env-file supabase/functions/.env   # ANTHROPIC_API_KEY, CLAUDE_MODEL
npx supabase functions deploy                    # les 9 Edge Functions
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies automatiquement aux
Edge Functions par Supabase : ne les mets pas dans les secrets.

Dans le tableau de bord Supabase :

- **Authentication → URL Configuration** : `Site URL` = l'URL du site web, et dans les redirections
  l'URL du site, `fitcoach://**` (app mobile).
- **Authentication → Providers** : Google (voir plus haut) ; garde la confirmation d'email activée.
- **Authentication → Emails** : configure un SMTP pour la production (le SMTP intégré est limité).

### 2. Web (Vercel ou Netlify)

Le site est une application monopage statique (`dist/`).

- **Vercel** : importe le dépôt ; `vercel.json` donne la commande de build, le dossier `dist` et la
  réécriture de toutes les routes vers `index.html`.
- **Netlify** : importe le dépôt ; `netlify.toml` fait la même chose.

Dans les deux cas, ajoute les variables d'environnement du projet :
`EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé publique, jamais la clé service
role ni la clé Anthropic). Ajoute ensuite l'URL du site dans les redirections Supabase.

### 3. Mobile (EAS)

```bash
npm install -g eas-cli
eas login
eas init                                         # lie le projet Expo (ajoute projectId dans app.json)
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <clé publique> --visibility plaintext
eas build --profile preview --platform all       # build interne à installer sur ton téléphone
eas build --profile production --platform all    # builds pour les stores
eas submit --platform ios                        # App Store Connect (compte Apple Developer)
eas submit --platform android                    # Google Play (compte développeur)
```

Les profils `development`, `preview` et `production` de `eas.json` lisent les variables de
l'environnement EAS du même nom. Les identifiants `com.fitcoach.app` (iOS et Android) sont à
remplacer par les tiens avant la première publication.

### Avant la mise en ligne

- Remplace la clé Anthropic de test par une clé de production et surveille la consommation
  (`ai_usage` en base, limites par fonction dans `ai_limits`).
- Fais relire le texte de consentement santé / RGPD et ajoute une politique de confidentialité
  (exigée par l'App Store et Google Play).
- Vérifie la licence des médias si tu ajoutes d'autres sources que free-exercise-db.
