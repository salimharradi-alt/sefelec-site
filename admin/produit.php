<?php
/**
 * SEFELEC — Ajout et modification d'un produit
 *
 * Le même écran sert aux deux : sans identifiant dans l'adresse, il crée ;
 * avec, il modifie. Cela évite deux formulaires à maintenir en parallèle.
 *
 * Les images sont redimensionnées ici même, aux deux formats utilisés par
 * le site (carte et grand format), et converties en WebP.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/images.php';
exigerConnexion();

$contenu  = lireContenu();
$produits = $contenu['products'] ?? [];
$categories = $contenu['categories'] ?? [];

$id = (string) ($_GET['id'] ?? '');
$indice = null;
$produit = [
    'id' => '', 'name' => '', 'ref' => '', 'slug' => '', 'desc' => '',
    'category' => '', 'categoryName' => '', 'image' => null, 'imageLarge' => null,
    'specs' => [], 'applications' => '', 'avantages' => '',
    'seo_title' => '', 'seo_description' => '', 'image_alt' => '',
    'stock' => null, 'isFeatured' => false, 'isPopular' => false
];

if ($id !== '') {
    foreach ($produits as $i => $p) {
        if (($p['id'] ?? '') === $id) {
            $indice = $i;
            $produit = array_merge($produit, $p);
            break;
        }
    }
    if ($indice === null) {
        messageFlash('Produit introuvable.', 'erreur');
        header('Location: index.php');
        exit;
    }
}

$erreurs = [];

// ---------------------------------------------------------------------
//  Enregistrement
// ---------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifierCsrf();

    $nom  = trim((string) ($_POST['name'] ?? ''));
    $ref  = trim((string) ($_POST['ref'] ?? ''));
    $desc = trim((string) ($_POST['desc'] ?? ''));
    $cat  = trim((string) ($_POST['category'] ?? ''));

    if ($nom === '')  $erreurs[] = 'Le nom du produit est obligatoire.';
    if ($ref === '')  $erreurs[] = 'La référence est obligatoire.';
    if ($cat === '')  $erreurs[] = 'La catégorie est obligatoire.';

    // Caractéristiques : une ligne « Intitulé : valeur ».
    $specs = [];
    foreach (preg_split('/\r?\n/', (string) ($_POST['specs'] ?? '')) as $ligne) {
        $ligne = trim($ligne);
        if ($ligne === '' || strpos($ligne, ':') === false) continue;
        [$cle, $valeur] = explode(':', $ligne, 2);
        $cle = trim($cle);
        $valeur = trim($valeur);
        if ($cle !== '' && $valeur !== '') $specs[$cle] = $valeur;
    }

    $produit['name'] = $nom;
    $produit['ref']  = $ref;
    $produit['desc'] = $desc;
    $produit['category'] = $cat;
    $produit['categoryName'] = is_array($categories) ? ($categories[$cat] ?? $cat) : $cat;
    $produit['specs'] = $specs;
    $produit['applications']    = trim((string) ($_POST['applications'] ?? ''));
    $produit['avantages']       = trim((string) ($_POST['avantages'] ?? ''));
    $produit['seo_title']       = trim((string) ($_POST['seo_title'] ?? ''));
    $produit['seo_description'] = trim((string) ($_POST['seo_description'] ?? ''));
    $produit['image_alt']       = trim((string) ($_POST['image_alt'] ?? ''));

    // L'adresse de la fiche ne change pas toute seule : la modifier
    // casserait les liens déjà partagés et référencés par Google.
    if (($produit['slug'] ?? '') === '') {
        $base = versSlug($nom);
        $slug = $base;
        $n = 2;
        while (slugDejaPris($produits, $slug, $produit['id'] ?? '')) {
            $slug = $base . '-' . $n++;
        }
        $produit['slug'] = $slug;
    }

    // --- Image ---
    if (!empty($_FILES['image']['tmp_name']) && is_uploaded_file($_FILES['image']['tmp_name'])) {
        $resultat = traiterImageProduit($_FILES['image']);
        if (isset($resultat['erreur'])) {
            $erreurs[] = $resultat['erreur'];
        } else {
            supprimerAnciennesImages($produit);
            $produit['image']      = $resultat['carte'];
            $produit['imageLarge'] = $resultat['large'];
        }
    }

    if (!$erreurs) {
        if ($indice === null) {
            $produit['id'] = bin2hex(random_bytes(8));
            $produits[] = $produit;
            $message = 'Produit ajouté.';
        } else {
            $produits[$indice] = $produit;
            $message = 'Produit modifié.';
        }

        $contenu['products'] = array_values($produits);
        if (ecrireContenu($contenu)) {
            messageFlash($message);
            header('Location: index.php');
            exit;
        }
        $erreurs[] = 'Impossible d\'enregistrer. Vérifiez les droits d\'écriture du dossier assets/data.';
    }
}

/** Vrai si un autre produit occupe déjà cette adresse. */
function slugDejaPris(array $produits, string $slug, string $idCourant): bool
{
    foreach ($produits as $p) {
        if (($p['slug'] ?? '') === $slug && ($p['id'] ?? '') !== $idCourant) return true;
    }
    return false;
}

$specsTexte = '';
foreach ($produit['specs'] ?? [] as $cle => $valeur) {
    $specsTexte .= $cle . ' : ' . $valeur . "\n";
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<?php require __DIR__ . '/partie-theme.php'; ?>
<title><?= $indice === null ? 'Ajouter' : 'Modifier' ?> un produit — Administration SEFELEC</title>
<link rel="icon" href="/assets/images/favicon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="admin.css">
</head>
<body class="admin">

<header class="admin-entete">
  <div class="admin-entete-inner">
    <a href="index.php" class="admin-logo">
      <img src="/assets/images/logo-icon.png" alt="" width="34" height="34">
      <span>Administration <strong>SEFELEC</strong></span>
    </a>
    <nav class="admin-nav">
      <button type="button" class="theme-toggle" aria-pressed="false" aria-label="Passer au thème sombre" title="Thème sombre">
        <svg class="icone-claire" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 12H2M22 12h-2.2M5.6 5.6 4 4M20 20l-1.6-1.6M18.4 5.6 20 4M4 20l1.6-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <svg class="icone-sombre" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.4 8.4 0 1 0 9.4 9.4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
        <span class="theme-toggle-libelle">Thème</span>
      </button>
      <a href="/" target="_blank" rel="noopener">Voir le site &nearr;</a>
      <a href="mot-de-passe-changer.php">Mot de passe</a>
      <a href="deconnexion.php">Déconnexion</a>
    </nav>
  </div>
</header>

<main class="admin-contenu admin-contenu-etroit">

  <p class="admin-fil"><a href="index.php">&larr; Retour aux produits</a></p>
  <h1><?= $indice === null ? 'Ajouter un produit' : 'Modifier le produit' ?></h1>

  <?php if ($erreurs): ?>
    <div class="admin-alerte admin-alerte-erreur">
      <?php foreach ($erreurs as $e): ?><p><?= e($e) ?></p><?php endforeach; ?>
    </div>
  <?php endif; ?>

  <form method="post" enctype="multipart/form-data" class="admin-form">
    <input type="hidden" name="csrf" value="<?= e(jetonCsrf()) ?>">

    <div class="admin-champ">
      <label for="name">Nom du produit <span class="admin-requis">*</span></label>
      <input type="text" id="name" name="name" value="<?= e($produit['name']) ?>" required>
    </div>

    <div class="admin-deux-colonnes">
      <div class="admin-champ">
        <label for="ref">Référence <span class="admin-requis">*</span></label>
        <input type="text" id="ref" name="ref" value="<?= e($produit['ref']) ?>" required>
      </div>
      <div class="admin-champ">
        <label for="category">Catégorie <span class="admin-requis">*</span></label>
        <select id="category" name="category" required>
          <option value="">— Choisir —</option>
          <?php foreach ((array) $categories as $slug => $nomCat): ?>
            <option value="<?= e($slug) ?>" <?= $produit['category'] === $slug ? 'selected' : '' ?>>
              <?= e($nomCat) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <div class="admin-champ">
      <label for="desc">Description</label>
      <textarea id="desc" name="desc" rows="3"><?= e($produit['desc']) ?></textarea>
      <small>Phrase courte affichée sur la carte du produit.</small>
    </div>

    <div class="admin-champ">
      <label for="image">Photo du produit</label>
      <?php if (!empty($produit['image'])): ?>
        <div class="admin-apercu">
          <img src="/<?= e($produit['image']) ?>" alt="" width="120">
          <span>Photo actuelle. En choisir une nouvelle la remplacera.</span>
        </div>
      <?php endif; ?>
      <input type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp">
      <small>JPEG, PNG ou WebP. L'image est redimensionnée et convertie automatiquement.</small>
    </div>

    <div class="admin-champ">
      <label for="image_alt">Description de l'image</label>
      <input type="text" id="image_alt" name="image_alt" value="<?= e($produit['image_alt']) ?>">
      <small>Lue par les personnes non voyantes et par les moteurs de recherche.</small>
    </div>

    <div class="admin-champ">
      <label for="specs">Caractéristiques techniques</label>
      <textarea id="specs" name="specs" rows="6" placeholder="Courant nominal : 20 A&#10;Tension : 230 V"><?= e(trim($specsTexte)) ?></textarea>
      <small>Une par ligne, sous la forme « Intitulé : valeur ».</small>
    </div>

    <details class="admin-repli">
      <summary>Références et applications (facultatif)</summary>
      <div class="admin-champ">
        <label for="applications">Applications</label>
        <textarea id="applications" name="applications" rows="4"><?= e($produit['applications']) ?></textarea>
        <small>Une par ligne, préfixée d'un tiret. Laissé vide, ce bloc n'apparaît pas.</small>
      </div>
      <div class="admin-champ">
        <label for="avantages">Avantages</label>
        <textarea id="avantages" name="avantages" rows="4"><?= e($produit['avantages']) ?></textarea>
      </div>
    </details>

    <details class="admin-repli">
      <summary>Référencement (facultatif)</summary>
      <div class="admin-champ">
        <label for="seo_title">Titre pour les moteurs de recherche</label>
        <input type="text" id="seo_title" name="seo_title" value="<?= e($produit['seo_title']) ?>" maxlength="70">
        <small>Environ 60 caractères. Laissé vide, il est composé automatiquement.</small>
      </div>
      <div class="admin-champ">
        <label for="seo_description">Description pour les moteurs</label>
        <textarea id="seo_description" name="seo_description" rows="2" maxlength="170"><?= e($produit['seo_description']) ?></textarea>
        <small>Environ 155 caractères.</small>
      </div>
    </details>

    <div class="admin-actions-form">
      <button type="submit" class="btn btn-primary">
        <?= $indice === null ? 'Ajouter le produit' : 'Enregistrer les modifications' ?>
      </button>
      <a href="index.php" class="btn btn-outline">Annuler</a>
    </div>
  </form>

</main>
<script src="/assets/js/theme.js"></script>
</body>
</html>
