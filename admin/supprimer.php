<?php
/**
 * SEFELEC — Suppression d'un produit
 *
 * Accessible uniquement en POST, avec le jeton de session : un lien
 * suffirait sinon à faire supprimer un produit par un simple clic depuis
 * un autre site.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/images.php';
exigerConnexion();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}
verifierCsrf();

$id = (string) ($_POST['id'] ?? '');
$contenu = lireContenu();
$produits = $contenu['products'] ?? [];

$restants = [];
$supprime = null;
foreach ($produits as $p) {
    if (($p['id'] ?? '') === $id) {
        $supprime = $p;
        continue;
    }
    $restants[] = $p;
}

if ($supprime === null) {
    messageFlash('Produit introuvable.', 'erreur');
    header('Location: index.php');
    exit;
}

$contenu['products'] = $restants;

if (ecrireContenu($contenu)) {
    // Les photos ne sont effacées qu'une fois l'enregistrement réussi :
    // sinon un échec d'écriture laisserait un produit sans image.
    supprimerAnciennesImages($supprime);
    messageFlash('« ' . ($supprime['name'] ?? 'Produit') . ' » supprimé.');
} else {
    messageFlash("La suppression n'a pas pu être enregistrée.", 'erreur');
}

header('Location: index.php');
exit;
