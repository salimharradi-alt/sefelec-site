<?php
/**
 * SEFELEC — Liste des produits
 *
 * Écran d'accueil de l'administration : tout le catalogue, avec accès
 * direct à la modification, à la suppression et à l'ajout.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
exigerConnexion();

$contenu   = lireContenu();
$produits  = $contenu['products'] ?? [];
$categories = $contenu['categories'] ?? [];
$flash     = messageFlash();

// Recherche simple : sur le nom et la référence.
$recherche = trim((string) ($_GET['q'] ?? ''));
if ($recherche !== '') {
    $produits = array_values(array_filter($produits, function ($p) use ($recherche) {
        $foin = ($p['name'] ?? '') . ' ' . ($p['ref'] ?? '');
        return mb_stripos($foin, $recherche) !== false;
    }));
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Produits — Administration SEFELEC</title>
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
      <a href="/" target="_blank" rel="noopener">Voir le site &nearr;</a>
      <a href="deconnexion.php">Déconnexion</a>
    </nav>
  </div>
</header>

<main class="admin-contenu">

  <?php if ($flash): ?>
    <p class="admin-alerte admin-alerte-<?= e($flash['type']) ?>"><?= e($flash['texte']) ?></p>
  <?php endif; ?>

  <div class="admin-titre-ligne">
    <div>
      <h1>Produits</h1>
      <p class="admin-compte"><?= count($contenu['products'] ?? []) ?> produit(s) au catalogue</p>
    </div>
    <a href="produit.php" class="btn btn-primary">Ajouter un produit</a>
  </div>

  <form method="get" class="admin-recherche">
    <input type="search" name="q" value="<?= e($recherche) ?>" placeholder="Rechercher par nom ou référence">
    <button type="submit" class="btn btn-outline">Rechercher</button>
    <?php if ($recherche !== ''): ?>
      <a href="index.php" class="admin-lien">Tout afficher</a>
    <?php endif; ?>
  </form>

  <?php if (!$produits): ?>
    <p class="admin-vide">
      <?= $recherche !== '' ? 'Aucun produit ne correspond à cette recherche.' : 'Aucun produit pour le moment.' ?>
    </p>
  <?php else: ?>
    <div class="admin-table-enveloppe">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Nom</th>
            <th>Référence</th>
            <th>Catégorie</th>
            <th class="admin-col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($produits as $p): ?>
          <tr>
            <td class="admin-cel-image">
              <?php if (!empty($p['image'])): ?>
                <img src="/<?= e($p['image']) ?>" alt="" loading="lazy" width="64" height="48">
              <?php else: ?>
                <span class="admin-sans-image">—</span>
              <?php endif; ?>
            </td>
            <td class="admin-cel-nom"><?= e($p['name'] ?? '') ?></td>
            <td><code><?= e($p['ref'] ?? '') ?></code></td>
            <td><?= e($p['categoryName'] ?? '—') ?></td>
            <td class="admin-col-actions">
              <a href="produit.php?id=<?= e($p['id'] ?? '') ?>" class="admin-action">Modifier</a>
              <form method="post" action="supprimer.php" class="admin-form-inline"
                    onsubmit="return confirm('Supprimer définitivement « <?= e($p['name'] ?? '') ?> » ?');">
                <input type="hidden" name="csrf" value="<?= e(jetonCsrf()) ?>">
                <input type="hidden" name="id" value="<?= e($p['id'] ?? '') ?>">
                <button type="submit" class="admin-action admin-action-danger">Supprimer</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>

  <p class="admin-note">
    Vos modifications apparaissent immédiatement sur le site : aucune étape
    de publication n'est nécessaire.
  </p>

</main>
</body>
</html>
