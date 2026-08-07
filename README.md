# SEFELEC S.A.R.L. — Site web

Site vitrine et catalogue de SEFELEC S.A.R.L.
Électricité industrielle MT/BT, automatisme, tableaux et armoires électriques — Casablanca, Maroc.

---

## Comprendre l'architecture en 30 secondes

Le projet a **deux parties bien séparées** :

| | Où elle tourne | Rôle |
|---|---|---|
| **Site public** | En ligne chez Nindohost | Ce que voient vos visiteurs. Fichiers statiques uniquement |
| **Back-office** | Sur votre ordinateur | Là où vous modifiez le contenu. Ne va **jamais** en ligne |

Entre les deux : la commande `npm run build`. Elle fige tout le contenu du
back-office dans `assets/data/content.json` et `assets/images/content/`.
Ce sont ces fichiers qui partent en ligne.

**Pourquoi ainsi ?** L'hébergement mutualisé Nindohost (cPanel, LiteSpeed)
sert du PHP et des fichiers statiques, mais ne fait pas tourner de serveur
Node.js en permanence. Un site statique y fonctionne parfaitement, se charge
plus vite, et ne peut pas tomber en panne de base de données.

> **Conséquence à retenir** : le tableau de bord continue de piloter tout le
> contenu du site, mais une modification n'apparaît en ligne qu'après
> `npm run build` puis `git push`. Ce n'est pas instantané.

---

## Arborescence

```
portfolio/
├── index.html                  Page du site
├── .htaccess                   Configuration serveur (HTTPS, cache, sécurité)
├── .gitignore
├── package.json
├── README.md
│
├── assets/                     ← tout ce qui part en ligne
│   ├── css/style.css
│   ├── js/
│   │   ├── store.js            Chargement du contenu
│   │   ├── cart.js             Panier
│   │   └── script.js           Affichage et interactions
│   ├── data/
│   │   └── content.json        ← contenu généré (versionné)
│   └── images/
│       ├── logo.png, logo-icon.png, favicon.png
│       ├── content/            ← images générées, optimisées WebP
│       └── products/           images d'origine (sauvegarde)
│
├── cms/                        Back-office Directus — jamais mis en ligne
│   ├── scripts/                Scripts de configuration et d'export
│   ├── .env.example            Modèle de configuration
│   └── .env                    Vos secrets (hors dépôt)
│
├── tools/                      Node.js portable (hors dépôt)
├── server.js                   Serveur local (site + back-office)
├── demarrer.cmd                Lance tout en local
└── .github/workflows/          Déploiement automatique
```

---

## Utilisation quotidienne

### Modifier le contenu et publier — 3 étapes

**1. Lancer le back-office**

Double-cliquez sur **`demarrer.cmd`**, puis ouvrez :

- Site local : http://localhost:5500
- Back-office : http://localhost:5500/admin

Modifiez ce que vous voulez : produits, prix, images, catégories, services,
témoignages, coordonnées. Ajouts, modifications et suppressions fonctionnent.

**2. Générer le contenu**

Dans un terminal, à la racine de `portfolio/` :

```bash
npm run build
```

Vérifiez le résultat sur http://localhost:5500

**3. Publier**

```bash
git add .
git commit -m "Mise à jour du catalogue"
git push
```

GitHub envoie automatiquement les fichiers vers Nindohost. Comptez une à deux
minutes.

> **L'étape 2 est obligatoire.** Sans elle, vous publiez l'ancien contenu.
> Le déploiement s'arrête d'ailleurs avec un message d'erreur si
> `assets/data/content.json` est absent.

---

# DÉPLOIEMENT GITHUB → NINDOHOST

Procédure complète, à suivre une seule fois.

## 1. Créer le dépôt GitHub

1. Allez sur https://github.com/new
2. **Repository name** : `sefelec-site`
3. Cochez **Private** — recommandé, le dépôt contient la configuration du site
4. Ne cochez **rien** d'autre (ni README, ni .gitignore, ni licence)
5. Cliquez sur **Create repository**

## 2. Placer le dossier portfolio

Le dossier `portfolio/` contient déjà tout. Ouvrez un terminal **à l'intérieur**
de ce dossier.

## 3. Initialiser Git

Déjà fait. Pour vérifier :

```bash
git status
```

Si le dossier n'était pas encore un dépôt :

```bash
git init
git branch -M main
```

## 4. Premier commit

```bash
git add .
git commit -m "Initial deployment"
```

## 5. Envoyer sur GitHub

Remplacez `VOTRE-COMPTE` par votre nom d'utilisateur GitHub :

```bash
git remote add origin https://github.com/VOTRE-COMPTE/sefelec-site.git
git push -u origin main
```

## 6. Configurer Nindohost

**a. Récupérer vos identifiants FTP**

Espace client Nindohost → **cPanel** → **Comptes FTP**. Notez :

| Information | Exemple |
|---|---|
| Serveur | `ftp.sefelec.ma` |
| Utilisateur | `sefelec@sefelec.ma` |
| Mot de passe | *(le vôtre)* |
| Dossier cible | `public_html/` |

**b. Enregistrer ces identifiants dans GitHub**

Sur votre dépôt → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Créez ces quatre secrets :

| Nom | Valeur |
|---|---|
| `FTP_SERVER` | `ftp.sefelec.ma` |
| `FTP_USERNAME` | votre identifiant FTP |
| `FTP_PASSWORD` | votre mot de passe FTP |
| `FTP_DIRECTORY` | `public_html/` |

> GitHub chiffre ces valeurs. Elles n'apparaissent jamais dans le code ni dans
> les journaux. **Ne les écrivez jamais dans un fichier du projet.**

## 7. Envoyer les fichiers vers le répertoire web

Automatique. Dès votre premier `git push`, GitHub transfère le site vers
`public_html/`. Suivez l'avancement dans l'onglet **Actions** du dépôt.

Les fichiers arrivent ainsi sur le serveur :

```
public_html/
├── index.html
├── .htaccess
└── assets/
```

Le dossier `cms/` n'est **pas** transféré : le back-office reste chez vous.

**Déploiement manuel de secours** — si vous préférez le FTP classique
(FileZilla), envoyez uniquement `index.html`, `.htaccess` et le dossier
`assets/` dans `public_html/`.

## 8. Configurer le domaine

Dans votre espace Nindohost :

1. Vérifiez que le domaine pointe bien vers votre hébergement
2. Si le domaine est enregistré ailleurs, réglez les serveurs DNS sur ceux
   fournis par Nindohost (typiquement `ns1.nindohost.com` et
   `ns2.nindohost.com` — la valeur exacte figure dans votre espace client)
3. Activez le **certificat SSL gratuit** dans cPanel → **SSL/TLS Status** →
   *Run AutoSSL*

La propagation DNS prend de quelques minutes à 24 heures.

Le fichier `.htaccess` force automatiquement le HTTPS. Si vous voulez fixer
une seule version du domaine (avec ou sans `www`), décommentez le bloc
correspondant en haut du fichier.

## 9. Vérifier le site

Ouvrez votre domaine et contrôlez :

- La page d'accueil s'affiche avec le logo
- Le cadenas HTTPS est présent
- Les produits apparaissent **avec leurs images**
- Les filtres par catégorie fonctionnent
- Les fiches techniques s'ouvrent

## 10. Tester le tableau de bord

Le back-office est **local**, il ne s'ouvre pas depuis le domaine.
Lancez `demarrer.cmd`, puis http://localhost:5500/admin

## 11. Tester ajouts, modifications, suppressions

Dans le back-office :

1. Créez un produit de test → `npm run build` → il apparaît sur le site local
2. Modifiez son prix → `npm run build` → le prix change
3. Supprimez-le → `npm run build` → il disparaît
4. Publiez avec `git push` et vérifiez en ligne

## 12. Tester images et formulaires

- Téléversez une image dans le back-office, associez-la à un produit,
  relancez `npm run build` : elle doit apparaître
- Sur le site en ligne, remplissez le formulaire de devis : il doit ouvrir
  WhatsApp avec le message pré-rempli
- Ajoutez un produit au panier, puis « Passer la commande » : le récapitulatif
  doit se pré-remplir dans le formulaire

---

## Installation sur un autre ordinateur

```bash
git clone https://github.com/VOTRE-COMPTE/sefelec-site.git
cd sefelec-site/cms
npm install
cp .env.example .env      # puis renseignez vos valeurs
npx directus bootstrap
```

Node.js 20 est requis (https://nodejs.org).
La base `cms/data.db` n'étant pas dans Git, restaurez votre sauvegarde ou
repartez d'une base vide.

---

## Sauvegardes

| Quoi | Où | Fréquence |
|---|---|---|
| Contenu du site | `assets/data/content.json`, versionné dans Git | à chaque publication |
| Base du back-office | `cms/data.db` — **hors Git** | à copier manuellement de temps en temps |
| Images d'origine | `assets/images/products/`, versionné | automatique |

La base contient vos brouillons et l'historique des modifications. Copiez-la
régulièrement sur une clé USB ou un disque externe.

---

## En cas de problème

**Le back-office ne démarre pas**
Vérifiez qu'aucune autre fenêtre `demarrer.cmd` n'est ouverte.

**`npm run build` échoue**
Le back-office doit tourner. Lancez `demarrer.cmd` d'abord.

**Le déploiement échoue dans GitHub Actions**
Ouvrez l'onglet *Actions* et lisez le message. Le plus souvent : un secret FTP
mal saisi, ou `npm run build` oublié.

**Le site en ligne montre l'ancien contenu**
Vous avez publié sans relancer `npm run build`. Refaites les trois étapes.

**Les images ne s'affichent pas en ligne**
Vérifiez dans cPanel → Gestionnaire de fichiers que
`public_html/assets/images/content/` contient bien les fichiers `.webp`.

**Erreur 500 après mise en ligne**
Le fichier `.htaccess` utilise des modules Apache standards, mais si votre
hébergement en désactive un, renommez temporairement `.htaccess` en
`.htaccess.bak` pour identifier la ligne en cause.
