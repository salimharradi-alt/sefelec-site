<?php
/**
 * SEFELEC — Formulaire générique
 *
 * Construit le formulaire à partir du schéma : ajouter un champ à une
 * section, c'est ajouter une ligne dans schema.php, rien d'autre.
 * Le même écran crée et modifie, selon la présence d'un identifiant.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/schema.php';
require __DIR__ . '/donnees.php';
require __DIR__ . '/images.php';
require __DIR__ . '/documents.php';
require __DIR__ . '/mise-en-page.php';
exigerConnexion();

$schema = schemaContenu();
$type = (string) ($_GET['type'] ?? $_POST['type'] ?? 'produits');
if (!isset($schema[$type])) {
    header('Location: liste.php');
    exit;
}
$def = $schema[$type];
$champs = $def['champs'];

$contenu  = lireContenu();
$elements = collectionLire($contenu, $def);
$id = (string) ($_GET['id'] ?? $_POST['id'] ?? '');

[$indice, $element] = $id !== '' ? collectionTrouver($elements, $id) : [null, null];
if ($id !== '' && $indice === null) {
    messageFlash('Élément introuvable.', 'erreur');
    header('Location: liste.php?type=' . urlencode($type));
    exit;
}
if ($element === null) {
    $element = [];
    foreach ($champs as $nom => $d) {
        $element[$nom] = $d['type'] === 'booleen' ? false : ($d['defaut'] ?? '');
    }
}

$erreurs = [];

// ---------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifierCsrf();

    $element = champsDepuisFormulaire($champs, $element, $erreurs);

    // --- Documents PDF ---
    foreach ($champs as $nom => $d) {
        if ($d['type'] !== 'document') continue;
        if (empty($_FILES[$nom]['tmp_name']) || !is_uploaded_file($_FILES[$nom]['tmp_name'])) continue;

        $resultat = traiterDocument($_FILES[$nom]);
        if (isset($resultat['erreur'])) {
            $erreurs[] = $resultat['erreur'];
        } else {
            supprimerDocumentDe($element, $nom);
            $element[$nom] = $resultat;
        }
    }

    // --- Images ---
    foreach ($champs as $nom => $d) {
        if ($d['type'] !== 'image') continue;
        if (empty($_FILES[$nom]['tmp_name']) || !is_uploaded_file($_FILES[$nom]['tmp_name'])) continue;

        $resultat = traiterImageProduit($_FILES[$nom], $d['preset'] ?? 'produit');
        if (isset($resultat['erreur'])) {
            $erreurs[] = $resultat['erreur'];
        } else {
            supprimerImagesDe($element, $nom);
            $element[$nom] = $resultat['carte'];
            // Les produits utilisent aussi un grand format pour la fiche.
            if (isset($resultat['large']) && $nom === 'image') {
                $element['imageLarge'] = $resultat['large'];
            }
        }
    }

    // --- Cohérences propres à certaines sections ---
    if ($type === 'produits' && !$erreurs) {
        $cats = (array) ($contenu['categories'] ?? []);
        $element['categoryName'] = $cats[$element['category']] ?? $element['category'];
        if (empty($element['slug'])) {
            $element['slug'] = slugUnique($elements, versSlug((string) $element['name']), $id);
        }
    }
    if ($type === 'categories' && !$erreurs) {
        // L'adresse découle du nom si elle n'est pas fournie.
        $element['slug'] = versSlug((string) ($element['slug'] !== '' ? $element['slug'] : $element['name']));
        if ($element['slug'] === '') {
            $erreurs[] = 'L\'adresse de la catégorie ne peut pas être vide.';
        }
    }
    if ($type === 'services' && !$erreurs) {
        if (empty($element['slug'])) {
            $element['slug'] = slugUnique($elements, versSlug((string) $element['name']), $id);
        }
        // Une seule activité principale : cocher celle-ci décoche l'autre.
        if (!empty($element['featured'])) {
            foreach ($elements as $i => $autre) {
                if ((string) ($autre['id'] ?? '') !== $id) {
                    $elements[$i]['featured'] = false;
                }
            }
        }
    }

    if (!$erreurs) {
        if ($indice === null) {
            $element['id'] = $element['id'] ?? bin2hex(random_bytes(8));
            if ($type === 'categories') $element['id'] = $element['slug'];
            $elements[] = $element;
            $msg = 'Ajouté.';
        } else {
            $elements[$indice] = $element;
            $msg = 'Modifications enregistrées.';
        }

        if (ecrireContenu(collectionEcrire($contenu, $def, $elements))) {
            messageFlash($msg);
            header('Location: liste.php?type=' . urlencode($type));
            exit;
        }
        $erreurs[] = 'Impossible d\'enregistrer. Vérifiez les droits d\'écriture du dossier assets/data.';
    }
}

function slugUnique(array $elements, string $base, string $idCourant): string
{
    $slug = $base !== '' ? $base : 'element';
    $n = 2;
    $pris = function ($s) use ($elements, $idCourant) {
        foreach ($elements as $e) {
            if (($e['slug'] ?? '') === $s && (string) ($e['id'] ?? '') !== $idCourant) return true;
        }
        return false;
    };
    while ($pris($slug)) {
        $slug = $base . '-' . $n++;
    }
    return $slug;
}

/** Regroupe les champs par volet repliable. */
$principaux = [];
$replis = [];
foreach ($champs as $nom => $d) {
    if (!empty($d['repli'])) {
        $replis[$d['repli']][$nom] = $d;
    } else {
        $principaux[$nom] = $d;
    }
}

debutPage(($indice === null ? 'Ajouter' : 'Modifier') . ' — ' . $def['libelle'], $type);
require __DIR__ . '/champs.php';
?>

<p class="admin-fil"><a href="liste.php?type=<?= e($type) ?>">&larr; Retour à <?= e(mb_strtolower($def['libelle'])) ?></a></p>
<h1><?= $indice === null ? 'Ajouter' : 'Modifier' ?> un<?= $def['singulier'] === 'catégorie' ? 'e' : '' ?> <?= e($def['singulier']) ?></h1>

<?php if ($erreurs): ?>
  <div class="admin-alerte admin-alerte-erreur">
    <?php foreach ($erreurs as $msg): ?><p><?= e($msg) ?></p><?php endforeach; ?>
  </div>
<?php endif; ?>

<form method="post" enctype="multipart/form-data" class="admin-form admin-form-large">
  <input type="hidden" name="csrf" value="<?= e(jetonCsrf()) ?>">
  <input type="hidden" name="type" value="<?= e($type) ?>">
  <input type="hidden" name="id" value="<?= e($id) ?>">

  <?php afficherChamps($principaux, $element, $contenu); ?>

  <?php foreach ($replis as $titre => $groupe): ?>
    <details class="admin-repli">
      <summary><?= e($titre) ?></summary>
      <?php afficherChamps($groupe, $element, $contenu); ?>
    </details>
  <?php endforeach; ?>

  <div class="admin-actions-form">
    <button type="submit" class="btn btn-primary">
      <?= $indice === null ? 'Ajouter' : 'Enregistrer' ?>
    </button>
    <a href="liste.php?type=<?= e($type) ?>" class="btn btn-outline">Annuler</a>
  </div>
</form>

<?php finPage(); ?>
