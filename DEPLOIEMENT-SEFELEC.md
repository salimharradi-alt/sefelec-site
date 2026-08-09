# DÉPLOIEMENT SEFELEC

Guide complet de mise en ligne, de la préparation à la maintenance.

---

## Avant tout : comprendre l'architecture

Votre projet utilise :

| Couche | Technologie |
|---|---|
| Site public | HTML / CSS / JavaScript natif — aucun framework |
| Back-office | Directus 11.3.5 — **nécessite Node.js ≥ 18** |
| Base de données | SQLite (fichier `cms/data.db`) |
| Authentification | JWT + argon2 + 2FA (fourni par Directus) |

### Pourquoi le back-office n'est pas en ligne

Votre hébergement Nindohost mutualisé fonctionne avec **cPanel + LiteSpeed +
PHP**. Il ne fait pas tourner de processus Node.js permanent. Directus ne peut
donc pas y être installé — ce n'est pas un réglage manquant, c'est une
incompatibilité de nature.

**L'architecture retenue :**

```
   VOTRE ORDINATEUR                      NINDOHOST
   ┌──────────────────┐                 ┌──────────────────┐
   │  Back-office     │   npm run build │  Site public     │
   │  localhost:5500  │ ──────────────► │  votre-domaine   │
   │  /admin          │   puis git push │  fichiers static │
   └──────────────────┘                 └──────────────────┘
```

Vous gardez **100 % du contrôle du contenu**. La seule différence : une
modification devient visible en ligne après `npm run build` + `git push`,
et non instantanément.

**Si vous voulez le back-office en ligne à `votre-domaine.com/admin`**, il
faut un **VPS** (Nindohost en propose, ~100–150 DH/mois). Dites-le moi et je
prépare cette configuration.

---

## 1. Préparation du projet

Déjà faite. Le dossier `portfolio/` contient :

```
portfolio/
├── index.html          Page du site
├── 404.html            Page d'erreur
├── .htaccess           HTTPS, cache, compression, sécurité
├── robots.txt          Instructions aux moteurs de recherche
├── sitemap.xml         Plan du site (régénéré à chaque build)
├── assets/             CSS, JS, images, contenu — tout ce qui part en ligne
├── cms/                Back-office — reste sur votre machine
├── tools/              Node.js portable — hors dépôt
├── server.js           Serveur local
└── demarrer.cmd        Lance tout en local
```

> ⚠️ **Le domaine est configuré sur `https://www.sefelec.ma`.** S'il diffère,
> remplacez-le dans **quatre endroits** : `index.html` (bloc RÉFÉRENCEMENT en
> haut), `robots.txt`, et `cms/scripts/build-static.mjs` (constante
> `SITE_URL`). Relancez ensuite `npm run build`.

---

## 2. Créer le repository GitHub

1. Allez sur https://github.com/new
2. **Repository name** : `sefelec-site`
3. Cochez **Private**
4. Ne cochez rien d'autre (ni README, ni .gitignore, ni licence)
5. **Create repository**

---

## 3. Configuration Git

Le dépôt est déjà initialisé avec un premier commit. Vérifiez :

```bash
cd portfolio
git status
git log --oneline
```

Renseignez votre identité si ce n'est pas fait :

```bash
git config user.name "Votre Nom"
git config user.email "vous@exemple.com"
```

Puis reliez le dépôt distant :

```bash
git remote add origin https://github.com/VOTRE-COMPTE/sefelec-site.git
git push -u origin main
```

GitHub demandera vos identifiants. Le mot de passe n'est plus accepté depuis
2021 : créez un **jeton d'accès personnel** sur
https://github.com/settings/tokens (portée `repo`) et collez-le à la place du
mot de passe.

> **Plus simple** : installez **GitHub Desktop** (https://desktop.github.com),
> connectez votre compte, puis *File → Add local repository* → sélectionnez
> `portfolio` → *Publish repository*. Aucun jeton à gérer.

---

## 4. Configuration cPanel

Dans votre espace client Nindohost → **cPanel** :

1. **Comptes FTP** → créez ou repérez un compte. Notez :
   - Serveur : `ftp.votre-domaine.com`
   - Utilisateur
   - Mot de passe
   - Dossier : `public_html/`

2. Vérifiez que `public_html` est bien le dossier racine de votre domaine
   (rubrique **Domaines**).

---

## 5. Connexion GitHub ↔ cPanel

cPanel propose parfois « Git Version Control », mais cette fonction fait un
`git pull` **manuel** depuis l'interface : elle ne se déclenche pas toute
seule à chaque push. Elle ne répond donc pas à votre besoin.

**La solution retenue — GitHub Actions + FTP** — est plus fiable : elle
fonctionne sur tous les hébergements cPanel, ne demande aucune installation
côté serveur, et se déclenche automatiquement.

Le fichier est déjà en place : `.github/workflows/deploy.yml`

---

## 6. Configuration du déploiement automatique

Sur votre dépôt GitHub → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**.

Créez ces quatre secrets :

| Nom | Valeur | Exemple |
|---|---|---|
| `FTP_SERVER` | Serveur FTP | `ftp.sefelec.ma` |
| `FTP_USERNAME` | Identifiant FTP | `sefelec@sefelec.ma` |
| `FTP_PASSWORD` | Mot de passe FTP | *(le vôtre)* |
| `FTP_DIRECTORY` | Dossier cible | `public_html/` |

GitHub chiffre ces valeurs : elles n'apparaissent ni dans le code, ni dans les
journaux de déploiement.

**Ce qui est envoyé** : `index.html`, `404.html`, `.htaccess`, `robots.txt`,
`sitemap.xml`, `assets/`.
**Ce qui ne l'est jamais** : `cms/`, `tools/`, la base de données, le `.env`.

---

## 7. Configuration de la base de données

**Aucune base à créer sur Nindohost.** Le site en ligne est statique : il lit
le fichier `assets/data/content.json`, sans MySQL ni PHP.

La base SQLite (`cms/data.db`) reste sur votre ordinateur. Elle n'est jamais
transférée, donc **un déploiement ne peut pas l'écraser**.

**Sauvegarde et restauration :**

| Élément | Emplacement | Protection |
|---|---|---|
| Contenu publié | `assets/data/content.json` | Versionné dans Git, historique complet |
| Base complète | `cms/data.db` | **À copier vous-même** sur clé USB ou disque externe |
| Images d'origine | `cms/uploads/` | Idem |

Copiez `cms/data.db` et `cms/uploads/` après chaque grosse session de saisie.

**Rollback** — pour revenir à une version antérieure du site en ligne :

```bash
git log --oneline           # repérez le commit voulu
git revert HEAD             # annule le dernier changement
git push                    # republie automatiquement
```

Le site en ligne revient à l'état précédent en une à deux minutes, sans
toucher à votre base locale.

---

## 8. Configuration .env

Le fichier `cms/.env` contient vos secrets. Il est **exclu de Git** — vérifié.

Un modèle sans valeurs sensibles est fourni : `cms/.env.example`.

Sur un nouvel ordinateur :

```bash
cd cms
cp .env.example .env
# puis renseignez KEY, SECRET et ADMIN_PASSWORD
```

Pour générer des valeurs sûres :

```bash
node -e "console.log(require('crypto').randomUUID())"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 9. Configuration du domaine

Si le domaine est **acheté chez Nindohost** : rien à faire, il pointe déjà
vers votre hébergement.

Si le domaine est **ailleurs** : dans l'interface du registrar, remplacez les
serveurs DNS par ceux de Nindohost (visibles dans votre espace client,
généralement `ns1.nindohost.com` / `ns2.nindohost.com`).

La propagation prend de quelques minutes à 24 heures.

**Choisir une seule version du domaine** (avec ou sans `www`) : ouvrez
`.htaccess` et décommentez le bloc correspondant, en haut du fichier. Cela
évite que Google considère les deux versions comme du contenu dupliqué.

---

## 10. Activation HTTPS

1. cPanel → **SSL/TLS Status**
2. Sélectionnez votre domaine → **Run AutoSSL**
3. Attendez quelques minutes

Le fichier `.htaccess` redirige déjà tout le trafic vers HTTPS
automatiquement. Vérifiez ensuite la présence du cadenas dans le navigateur.

---

## 11. Configuration Google Search Console

1. Allez sur https://search.google.com/search-console
2. **Ajouter une propriété** → choisissez **Préfixe de l'URL**
3. Saisissez `https://www.votre-domaine.com`
4. **Vérifier la propriété** — méthode la plus simple : *Balise HTML*.
   Google vous donne une ligne du type :

   ```html
   <meta name="google-site-verification" content="XXXXXXXX">
   ```

   Collez-la dans `index.html`, juste avant `</head>`, puis :

   ```bash
   git add . && git commit -m "Vérification Search Console" && git push
   ```

   Attendez la fin du déploiement, puis cliquez sur **Vérifier**.

> Alternative sans modifier le code : la vérification par **enregistrement DNS
> TXT**, à ajouter dans la zone DNS chez Nindohost.

---

## 12. Envoi du sitemap

1. Dans Search Console → menu **Sitemaps**
2. Saisissez : `sitemap.xml`
3. **Envoyer**

Votre sitemap est accessible à `https://www.votre-domaine.com/sitemap.xml`
et se régénère automatiquement à chaque `npm run build`.

**Demander l'indexation** : menu **Inspection de l'URL** → saisissez l'adresse
de votre page → **Demander une indexation**. Comptez quelques jours.

**Contrôler les erreurs** : menu **Pages**, qui liste les pages indexées et
les problèmes rencontrés. Consultez-le une fois par mois.

**Autres moteurs :**
- **Bing** (couvre aussi Yahoo et en partie DuckDuckGo) :
  https://www.bing.com/webmasters — importez directement depuis Search Console
- **DuckDuckGo, Qwant, Brave** : pas d'inscription, ils utilisent les index
  de Bing et leurs propres robots

---

## 13. Première mise en production

Dans l'ordre :

```bash
# 1. Lancer le back-office
demarrer.cmd

# 2. Vérifier le contenu sur http://localhost:5500

# 3. Générer le contenu statique
npm run build

# 4. Publier
git add .
git commit -m "Première mise en production"
git push
```

Suivez le déploiement dans l'onglet **Actions** de GitHub (1 à 2 minutes).

Puis contrôlez sur votre domaine :

- [ ] La page d'accueil s'affiche avec le logo
- [ ] Le cadenas HTTPS est présent
- [ ] Les produits apparaissent **avec leurs images**
- [ ] Les filtres par catégorie fonctionnent
- [ ] Les fiches techniques s'ouvrent
- [ ] Le panier fonctionne
- [ ] Le formulaire de devis ouvre WhatsApp
- [ ] Une adresse inexistante affiche la page 404
- [ ] `votre-domaine.com/robots.txt` répond
- [ ] `votre-domaine.com/sitemap.xml` répond
- [ ] L'affichage est correct sur téléphone

---

## 14. Procédure de mise à jour

**Votre routine quotidienne, en 3 étapes :**

```bash
# 1. Modifier le contenu
demarrer.cmd          → http://localhost:5500/admin

# 2. Générer et vérifier
npm run build         → vérifiez sur http://localhost:5500

# 3. Publier
git add .
git commit -m "Mise à jour du catalogue"
git push
```

Le site en ligne se met à jour tout seul.

> **L'étape 2 est indispensable.** Sans elle, vous publiez l'ancien contenu.
> Le déploiement s'interrompt d'ailleurs avec un message d'erreur si
> `assets/data/content.json` est absent.

---

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| Le back-office ne démarre pas | Une fenêtre `demarrer.cmd` est déjà ouverte |
| `npm run build` échoue | Le back-office n'est pas démarré |
| Le déploiement échoue | Secret FTP erroné — vérifiez l'onglet *Actions* |
| Le site montre l'ancien contenu | `npm run build` oublié avant le commit |
| Images absentes en ligne | Vérifiez `public_html/assets/images/content/` dans cPanel |
| Erreur 500 après mise en ligne | Renommez `.htaccess` en `.htaccess.bak` pour identifier la directive en cause |
