<?php
/**
 * SEFELEC — Liste générique d'une section
 *
 * Le même écran sert aux produits, services, partenaires, témoignages et
 * catégories : les colonnes et les libellés viennent du schéma.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/schema.php';
require __DIR__ . '/donnees.php';
require __DIR__ . '/mise-en-page.php';
exigerConnexion();

$schema = schemaContenu();
$type = (string) ($_GET['type'] ?? 'produits');
if (!isset($schema[$type])) {
    $type = 'produits';
}
$def = $schema[$type];

$contenu = lireContenu();
$elements = collectionLire($contenu, $def);

// --- Réordonnancement ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['deplacer'])) {
    verifierCsrf();
    $elements = collectionDeplacer($elements, (string) $_POST['id'], (int) $_POST['deplacer']);
    if (ecrireContenu(collectionEcrire($contenu, $def, $elements))) {
        messageFlash('Ordre modifié.');
    } else {
        messageFlash('L\'ordre n\'a pas pu être enregistré.', 'erreur');
    }
    header('Location: liste.php?type=' . urlencode($type));
    exit;
}

$flash = messageFlash();
$recherche = trim((string) ($_GET['q'] ?? ''));
$affiches = $elements;

if ($recherche !== '') {
    $affiches = array_values(array_filter($elements, function ($e) use ($recherche, $def) {
        foreach ($def['colonnes'] as $c) {
            if (mb_stripos((string) ($e[$c] ?? ''), $recherche) !== false) return true;
        }
        return mb_stripos((string) ($e['name'] ?? ''), $recherche) !== false;
    }));
}

debutPage($def['libelle'], $type);
?>

<?php if ($flash): ?>
  <p class="admin-alerte admin-alerte-<?= e($flash['type']) ?>"><?= e($flash['texte']) ?></p>
<?php endif; ?>

<div class="admin-titre-ligne">
  <div>
    <h1><?= e($def['libelle']) ?></h1>
    <p class="admin-compte"><?= count($elements) ?> <?= e($def['singulier']) ?>(s)</p>
  </div>
  <a href="editer.php?type=<?= e($type) ?>" class="btn btn-primary">
    Ajouter un<?= in_array($def['singulier'], ['catégorie'], true) ? 'e' : '' ?> <?= e($def['singulier']) ?>
  </a>
</div>

<?php if (count($elements) > 6): ?>
  <form method="get" class="admin-recherche">
    <input type="hidden" name="type" value="<?= e($type) ?>">
    <input type="search" name="q" value="<?= e($recherche) ?>" placeholder="Rechercher">
    <button type="submit" class="btn btn-outline">Rechercher</button>
    <?php if ($recherche !== ''): ?>
      <a href="liste.php?type=<?= e($type) ?>" class="admin-lien">Tout afficher</a>
    <?php endif; ?>
  </form>
<?php endif; ?>

<?php if (!$affiches): ?>
  <p class="admin-vide">
    <?= $recherche !== '' ? 'Aucun résultat.' : 'Rien pour le moment. Utilisez le bouton ci-dessus pour commencer.' ?>
  </p>
<?php else: ?>
  <div class="admin-table-enveloppe">
    <table class="admin-table">
      <thead>
        <tr>
          <?php foreach ($def['colonnes'] as $c): ?>
            <th><?= e($def['champs'][$c]['label'] ?? ucfirst($c)) ?></th>
          <?php endforeach; ?>
          <th class="admin-col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($affiches as $rang => $el): ?>
        <?php $id = (string) ($el['id'] ?? $el['slug'] ?? ''); ?>
        <tr>
          <?php foreach ($def['colonnes'] as $c): ?>
            <?php $typeChamp = $def['champs'][$c]['type'] ?? 'texte'; ?>
            <td class="<?= $typeChamp === 'image' ? 'admin-cel-image' : ($c === 'name' ? 'admin-cel-nom' : '') ?>">
              <?php if ($typeChamp === 'image'): ?>
                <?php if (!empty($el[$c])): ?>
                  <img src="/<?= e($el[$c]) ?>" alt="" loading="lazy" width="64" height="48">
                <?php else: ?>
                  <span class="admin-sans-image">—</span>
                <?php endif; ?>
              <?php else: ?>
                <?= e(valeurAffichable($el[$c] ?? '', $typeChamp)) ?>
              <?php endif; ?>
            </td>
          <?php endforeach; ?>

          <td class="admin-col-actions">
            <?php if (!empty($def['ordonnable']) && $recherche === ''): ?>
              <form method="post" class="admin-form-inline">
                <input type="hidden" name="csrf" value="<?= e(jetonCsrf()) ?>">
                <input type="hidden" name="id" value="<?= e($id) ?>">
                <button type="submit" name="deplacer" value="-1" class="admin-action admin-action-fleche"
                        title="Monter" <?= $rang === 0 ? 'disabled' : '' ?>>↑</button>
                <button type="submit" name="deplacer" value="1" class="admin-action admin-action-fleche"
                        title="Descendre" <?= $rang === count($affiches) - 1 ? 'disabled' : '' ?>>↓</button>
              </form>
            <?php endif; ?>

            <a href="editer.php?type=<?= e($type) ?>&id=<?= e($id) ?>" class="admin-action">Modifier</a>

            <form method="post" action="supprimer.php" class="admin-form-inline"
                  onsubmit="return confirm('Supprimer définitivement « <?= e($el['name'] ?? '') ?> » ?');">
              <input type="hidden" name="csrf" value="<?= e(jetonCsrf()) ?>">
              <input type="hidden" name="type" value="<?= e($type) ?>">
              <input type="hidden" name="id" value="<?= e($id) ?>">
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

<?php finPage(); ?>
