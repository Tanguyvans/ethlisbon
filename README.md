# World ID Selfie Check Lab

Prototype local pour tester le credential **Selfie Check (Beta)** avec IDKit 4.

## Prérequis

- Node.js 20.9 ou plus récent
- une application World configurée dans le Developer Portal
- l’accès partenaire à Selfie Check et au Sandbox
- le Sandbox World ID installé sur un téléphone pour tester le parcours complet

Selfie Check est actuellement exposé via `selfieCheckLegacy` et retourne une
preuve Face World ID 3.0. Le backend vérifie cette preuve via l’API v4.

## Configuration

```bash
cp .env.example .env.local
```

Renseigner ensuite :

- `NEXT_PUBLIC_WORLD_APP_ID`
- `WORLD_RP_ID`
- `WORLD_RP_SIGNING_KEY`
- `WORLD_ACTION`, qui doit correspondre à l’action créée dans le portail
- `NEXT_PUBLIC_WORLD_ENVIRONMENT=staging` avec le simulateur web
- `NEXT_PUBLIC_WORLD_ENVIRONMENT=sandbox` avec le build mobile World ID Sandbox

Ne jamais placer `WORLD_RP_SIGNING_KEY` dans une variable `NEXT_PUBLIC_*`.

En développement, le terminal affiche le contexte RP, le payload IDKit complet
et la réponse complète de l’API World. Définir `WORLD_DEBUG_LOGS=false` pour
désactiver ces logs. La clé privée n’est jamais affichée et les logs sont
toujours désactivés en production.

## Lancer le test

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:3000`, cliquer sur **Tester mon selfie**, puis scanner
le QR code avec le téléphone autorisé pour le Sandbox.

## Flux implémenté

1. Le navigateur demande une signature éphémère à `/api/rp-signature`.
2. Le serveur signe l’action avec `WORLD_RP_SIGNING_KEY`.
3. IDKit ouvre le QR/deep link avec le preset `selfieCheckLegacy`.
4. Le résultat est envoyé à `/api/verify-proof`.
5. Le serveur transmet le payload sans transformation à
   `POST https://developer.world.org/api/v4/verify/{rp_id}`.
6. Au premier succès, le serveur enregistre uniquement une empreinte SHA-256 du
   nullifier dans `.data/selfie-baseline.json`.
7. Aux passages suivants, il compare les empreintes pour afficher « même
   personne confirmée » ou « identité différente ».

Le bouton **Réinitialiser** efface cette personne de référence locale. Ce
stockage fichier convient au prototype local ; en production, utiliser une base
de données et associer l’empreinte à un compte applicatif précis.
