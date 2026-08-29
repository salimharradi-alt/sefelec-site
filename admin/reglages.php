<?php
/**
 * SEFELEC — Réglages du site
 *
 * Coordonnées, réseaux sociaux et couleurs. Un seul enregistrement,
 * d'où un écran distinct des listes.
 *
 * Les couleurs sont écrites dans une feuille de style dédiée plutôt
 * qu'appliquées en JavaScript : appliquées après coup, elles
 * produiraient un changement de couleur visible au chargement.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/schema.php';
require __DIR__ . '/donnees.php';
require __DIR__ . '/champs.php';
require __DIR__ . '/mise-en-page.php';
exigerConnexion();

const FICHIER_COULEURS = RACINE . '/assets/css/couleurs.css';

$contenu  = lireContenu();
$reglages = (array) ($contenu['settings'] ?? []);
$groupes  = schemaReglages();
$erreurs  = [];
$flash    = messageFlash();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifierCsrf();

    $tous = [];
    foreach ($groupes as $champs) {
        $tous += $champs;
    }
    $reglages = champsDepuisFormulaire($tous, $reglages, $erreurs);

    if (!$erreurs) {
        $contenu['settings'] = $reglages;

        if (ecrireContenu($contenu) && ecrireCouleurs($reglages)) {
            messageFlash('Réglages enregistrés.');
            header('Location: reglages.php');
            exit;
        }
        $erreurs[] = 'L\'enregistrement a échoué. Vérifiez les droits d\'écriture.';
    }
}

/**
 * Écrit la feuille des couleurs personnalisées.
 *
 * Seules les variables dérivées du bleu et du rouge sont redéfinies :
 * le reste de l'identité — surfaces, textes, bordures — reste piloté par
 * la feuille principale et par le thème clair/sombre.
 */
function ecrireCouleurs(array $reglages): bool
{
    $bleu  = $reglages['color_primary'] ?? '#1E3A8A';
    $rouge = $reglages['color_accent'] ?? '#E53935';

    if (!preg_match('/^#[0-9A-F]{6}$/i', $bleu) || !preg_match('/^#[0-9A-F]{6}$/i', $rouge)) {
        return false;
    }

    $css = "/* Couleurs définies depuis l'administration.\n"
        . "   Ce fichier est réécrit à chaque enregistrement : ne le modifiez\n"
        . "   pas à la main, vos changements seraient perdus. */\n"
        . ":root {\n"
        . "  --navy: {$bleu};\n"
        . "  --navy-dark: " . assombrir($bleu, 0.35) . ";\n"
        . "  --navy-darker: " . assombrir($bleu, 0.55) . ";\n"
        . "  --navy-soft: " . eclaircir($bleu, 0.35) . ";\n"
        . "  --accent-link: {$bleu};\n"
        . "  --heading: " . assombrir($bleu, 0.35) . ";\n"
        . "  --red: {$rouge};\n"
        . "  --red-dark: " . assombrir($rouge, 0.2) . ";\n"
        . "}\n"
        . "[data-theme=\"dark\"] {\n"
        . "  --accent-link: " . eclaircir($bleu, 0.55) . ";\n"
        . "}\n";

    return file_put_contents(FICHIER_COULEURS, $css) !== false;
}

function melanger(string $hex, float $part, int $vers): string
{
    $hex = ltrim($hex, '#');
    $sortie = '#';
    for ($i = 0; $i < 3; $i++) {
        $c = hexdec(substr($hex, $i * 2, 2));
        $n = (int) round($c + ($vers - $c) * $part);
        $sortie .= str_pad(dechex(max(0, min(255, $n))), 2, '0', STR_PAD_LEFT);
    }
    return strtoupper($sortie);
}
function assombrir(string $hex, float $part): string { return melanger($hex, $part, 0); }
function eclaircir(string $hex, float $part): string { return melanger($hex, $part, 255); }

debutPage('Réglages', 'reglages');
?>

<?php if ($flash): ?>
  <p class="admin-alerte admin-alerte-<?= e($flash['type']) ?>"><?= e($flash['texte']) ?></p>
<?php endif; ?>

<div class="admin-titre-ligne">
  <div>
    <h1>Réglages du site</h1>
    <p class="admin-compte">Coordonnées, réseaux sociaux et couleurs</p>
  </div>
</div>

<?php if ($erreurs): ?>
  <div class="admin-alerte admin-alerte-erreur">
    <?php foreach ($erreurs as $msg): ?><p><?= e($msg) ?></p><?php endforeach; ?>
  </div>
<?php endif; ?>

<form method="post" class="admin-form admin-form-large">
  <input type="hidden" name="csrf" value="<?= e(jetonCsrf()) ?>">

  <?php foreach ($groupes as $titre => $champs): ?>
    <h2 class="admin-sous-titre"><?= e($titre) ?></h2>
    <?php afficherChamps($champs, $reglages, $contenu); ?>
  <?php endforeach; ?>

  <p class="admin-avertissement">
    Les couleurs s'appliquent à l'ensemble du site. Vérifiez le rendu après
    enregistrement : une teinte trop claire rendrait les boutons difficiles à lire.
  </p>

  <div class="admin-actions-form">
    <button type="submit" class="btn btn-primary">Enregistrer les réglages</button>
    <a href="/" target="_blank" rel="noopener" class="btn btn-outline">Voir le site</a>
  </div>
</form>

<?php finPage(); ?>
