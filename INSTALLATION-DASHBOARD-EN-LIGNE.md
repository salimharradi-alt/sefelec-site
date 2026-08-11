# Mettre le tableau de bord en ligne

Objectif : que votre client modifie le contenu depuis son navigateur, sans
votre ordinateur.

---

## Ce qui bloque aujourd'hui

`https://www.sefelec.ma/admin` renvoie **404** parce qu'il n'y a rien à cette
adresse. Le tableau de bord n'est pas un fichier : c'est un **programme qui
doit tourner en permanence**. Aucun téléversement ne peut le remplacer.

Il faut donc que votre hébergement sache exécuter Node.js.

---

## Étape 0 — Vérifier que c'est possible (2 minutes)

Connectez-vous à cPanel, tapez **`Node`** dans la barre de recherche.

| Résultat | Suite |
|---|---|
| **« Setup Node.js App »** apparaît | Continuez à l'étape 1. |
| Rien | Votre offre ne le permet pas. Deux issues : passer à l'offre **Professionnel** (499 DH HT/an) ou prendre un **VPS** (149 DH HT/mois). |

Repérez aussi **« Terminal »** ou **« SSH Access »** : sans l'un des deux,
l'installation des dépendances devra passer par le bouton *Run NPM Install*
de cPanel, ce qui fonctionne aussi mais offre moins de diagnostic en cas
d'échec.

---

## Étape 1 — Créer le sous-domaine

cPanel → **Domaines** → **Créer un domaine**

- Domaine : `admin.sefelec.ma`
- Racine du document : `admin_sefelec` **en dehors de `public_html`**

> **Pourquoi un sous-domaine plutôt que `sefelec.ma/admin` ?**
> Directus sert sa propre interface sur le chemin `/admin`. L'installer
> *dans* `/admin` donnerait `sefelec.ma/admin/admin`. Le sous-domaine évite
> ce conflit. L'étape 7 fera pointer `sefelec.ma/admin` vers lui : votre
> client gardera l'adresse simple.

Puis **SSL/TLS Status** → cochez `admin.sefelec.ma` → **Run AutoSSL**.

---

## Étape 2 — Transférer le tableau de bord

Depuis votre ordinateur, envoyez le contenu de `portfolio/cms/` vers le
dossier `admin_sefelec` — **sauf `node_modules`**, qui sera réinstallé sur
le serveur.

À transférer :

| Élément | Rôle |
|---|---|
| `app.js` | Point d'entrée exigé par cPanel |
| `package.json` | Liste des dépendances |
| `data.db` | **Votre contenu** : produits, services, comptes |
| `uploads/` | Les images d'origine |
| `scripts/` | Utilitaires de maintenance |

**Ne transférez pas votre `.env` local** : il contient les clés de votre
machine et impose un port qui casserait l'installation.

---

## Étape 3 — Déclarer l'application

cPanel → **Setup Node.js App** → **Create Application**

| Champ | Valeur |
|---|---|
| Node.js version | **20.x** ou supérieure (Directus exige ≥ 18) |
| Application mode | `Production` |
| Application root | `admin_sefelec` |
| Application URL | `admin.sefelec.ma` |
| Application startup file | `app.js` |

**Create**. Notez la ligne `source /home/.../bin/activate` affichée en haut :
elle sert à l'étape suivante.

---

## Étape 4 — Installer les dépendances

Cliquez **Run NPM Install**. Comptez 5 à 15 minutes — Directus pèse lourd.

En cas d'échec, ouvrez **Terminal** et lancez la commande `source …/activate`
notée à l'étape 3, puis :

```bash
cd ~/admin_sefelec && npm install --omit=dev
```

Vous verrez alors le message d'erreur exact, ce que le bouton ne montre pas.

> **Si l'installation échoue par manque d'espace ou d'inodes** : Directus
> installe environ 900 Mo et plusieurs dizaines de milliers de fichiers.
> C'est la limite la plus fréquente sur une offre mutualisée d'entrée de
> gamme, et c'est le signal qu'il faut passer au VPS.

---

## Étape 5 — Configurer

Dans `admin_sefelec`, copiez `.env.production.example` en `.env`, puis
renseignez `KEY` et `SECRET` avec des valeurs **neuves** :

```bash
node -e "console.log(require('crypto').randomUUID())"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Le fichier est commenté ligne par ligne. **Ne définissez ni `PORT` ni
`HOST`** : Passenger les fournit, et les figer provoque une erreur 503.

---

## Étape 6 — Démarrer

**Setup Node.js App** → **Restart**.

Ouvrez `https://admin.sefelec.ma/admin`. L'écran de connexion Directus doit
apparaître.

Si vous obtenez une **503**, ouvrez `stderr.log` dans `admin_sefelec` : la
cause y est écrite en clair.

**Connectez-vous immédiatement et changez le mot de passe administrateur**
(icône en bas à gauche → votre compte). Le tableau de bord est désormais
exposé publiquement : le mot de passe généré pendant le développement ne
doit plus servir.

---

## Étape 7 — Rediriger l'adresse simple

Pour que `sefelec.ma/admin` mène au tableau de bord, ajoutez ceci dans le
`.htaccess` du site, **avant** les autres règles de réécriture :

```apache
RewriteRule ^admin/?$ https://admin.sefelec.ma/admin [R=301,L]
```

> N'ajoutez cette ligne **qu'une fois le sous-domaine en service**. Sinon
> vous redirigeriez vos visiteurs vers une adresse morte.

---

## Étape 8 — Ce qu'il reste à câbler

**Attention : à ce stade, les modifications de votre client ne changent pas
encore le site.**

Le site public lit `assets/data/content.json`, un fichier figé produit par
`npm run build`. Tant que personne ne relance cette génération, le site
affiche l'ancien contenu.

Trois façons de fermer la boucle, par ordre de simplicité :

1. **Bouton de publication** — un workflow GitHub déclenché à la main lit le
   Directus en ligne et republie le site. Votre client clique quand il a fini.
2. **Publication programmée** — le même workflow s'exécute chaque nuit.
   Les modifications paraissent le lendemain.
3. **Publication immédiate** — Directus appelle GitHub à chaque
   enregistrement. Le plus confortable, le plus délicat à régler.

Ce câblage n'est pas encore fait : demandez-le une fois les étapes 1 à 7
réussies.

---

## Sécurité

Le tableau de bord devient accessible depuis Internet. Trois mesures, dans
l'ordre d'importance :

1. **Mot de passe fort et unique** — changé à l'étape 6
2. **Double authentification** — Directus la propose nativement dans le
   profil utilisateur. Activez-la.
3. **Comptes séparés** — créez un compte par personne avec le rôle minimal.
   Ne partagez jamais le compte administrateur.

`data.db` contient tout votre contenu : sauvegardez-le régulièrement via
**Sauvegardes** dans cPanel.
