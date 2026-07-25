# World ID Credential Lab

Prototype local pour tester **Selfie Check (Beta)** et **Identity Check** avec
IDKit 4.

## Prérequis

- Node.js 20.9 ou plus récent
- une application World configurée dans le Developer Portal
- l’accès à Selfie Check pour cette application
- l’application World officielle installée sur un téléphone

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
- `WORLD_IDENTITY_ACTION=identity-check-demo`
- `NEXT_PUBLIC_WORLD_ENVIRONMENT=production` avec l’application World officielle

Ne jamais placer `WORLD_RP_SIGNING_KEY` dans une variable `NEXT_PUBLIC_*`.

### Choisir l’environnement

| Environnement | Client | Selfie Check |
| --- | --- | --- |
| `production` | Application World officielle | Oui |
| `staging` | Simulateur web | Non disponible actuellement |
| `sandbox` | Build mobile Sandbox/TestFlight | Seulement avec un accès au build |

`staging` doit être utilisé uniquement avec le simulateur. Utiliser
l’application World officielle avec `staging` peut produire une preuve Face
avec une racine de production, ensuite refusée par l’API staging avec
`invalid_merkle_root`.

Après une modification de `.env.local`, arrêter puis relancer `npm run dev`.
Une nouvelle preuve doit être générée : ne pas modifier manuellement
l’environnement d’un ancien payload.

En développement, le terminal affiche le contexte RP, le payload IDKit complet
et la réponse complète de l’API World. Définir `WORLD_DEBUG_LOGS=false` pour
désactiver ces logs. La clé privée n’est jamais affichée et les logs sont
toujours désactivés en production.

## Lancer le test

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:3000`, choisir **Selfie continuity** ou **Identity
attributes**, puis scanner le QR code avec l’application World officielle.

Si World refuse le visage sur le téléphone, aucune preuve n’est générée et
`/api/verify-proof` n’est pas appelé. Il est donc normal de ne voir ni le log
`2/3 Complete IDKit payload`, ni le log `3/3 Complete World verification API
response` dans le terminal.

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

L’application ne reçoit et ne compare jamais deux photos. World effectue le
liveness check et le Face Auth. Ce prototype compare uniquement le nullifier
v3 après validation de la preuve par World :

- même World ID, même RP et même action : même nullifier ;
- autre World ID : nullifier différent ;
- autre visage présenté au même credential Face : World doit refuser le Face
  Auth avant de retourner une preuve.

Le bouton **Réinitialiser** efface cette personne de référence locale. Ce
stockage fichier convient au prototype local ; en production, utiliser une base
de données et associer l’empreinte à un compte applicatif précis. Le prototype
ne conserve qu’une seule personne de référence globale.

## Identity Check

Le second laboratoire utilise l’action `identity-check-demo` et demande
actuellement une seule condition :

```text
minimum_age >= 18
```

Le parcours **World réel** utilise le preset `identityCheck`, exige World ID
4.0, une présence utilisateur fraîche et un credential NFC compatible
(passeport, eID ou MNC). Le backend transmet la preuve à
`POST /api/v4/verify/{rp_id}` avant d’accepter le résultat.

Le parcours **Simulation** teste l’interface sans document :

- il est clairement marqué `SIMULATED` ;
- il ne génère aucune preuve cryptographique ;
- il ne contacte jamais l’API World ;
- il est toujours désactivé lorsque `NODE_ENV=production`.

Définir `IDENTITY_CHECK_MOCK=false` pour le désactiver également en
développement.

## Limites importantes

- Selfie Check est un signal biométrique à faible assurance, pas une preuve
  légale de vie ou d’identité.
- La preuve Face v3 est vérifiée dans le cloud via l’API World. Elle n’est pas
  directement supportée par le `WorldIDRouter` on-chain.
- Pour un renouvellement annuel, conserver une action stable, utiliser un
  signal dynamique lié au membre et à la période, et exiger explicitement une
  présence utilisateur fraîche.
- Identity Check atteste des conditions issues d’un document ; il ne constitue
  pas à lui seul un processus réglementaire KYC/AML complet.
- Les secrets RP restent exclusivement côté serveur et ne doivent jamais être
  commités.

Les retours rencontrés pendant l’intégration sont consignés dans
[`feedback.md`](./feedback.md).
