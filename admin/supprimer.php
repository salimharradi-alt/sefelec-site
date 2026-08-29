<?php
/**
 * SEFELEC — Suppression générique
 *
 * Accessible uniquement en POST, avec le jeton de session : un simple
 * lien suffirait sinon à faire supprimer un élément depuis un autre site.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/schema.php';
require __DIR__ . '/donnees.php';
require __DIR__ . '/images.php';
exigerConnexion();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}
verifierCsrf();

$schema = schemaContenu();
$type = (string) ($_POST['type'] ?? 'produits');
if (!isset($schema[$type])) {
    header('Location: index.php');
    exit;
}
$def = $schema[$type];
$retour = 'liste.php?type=' . urlencode($type);

$contenu  = lireContenu();
$elements = collectionLire($contenu, $def);
$id = (string) ($_POST['id'] ?? '');

[$indice, $element] = collectionTrouver($elements, $id);
if ($indice === null) {
    messageFlash('Élément introuvable.', 'erreur');
    header('Location: ' . $retour);
    exit;
}

// Une catégorie encore utilisée laisserait des produits orphelins,
// affichés sans étiquette et absents de toute page de catégorie.
if ($type === 'categories') {
    $utilisee = 0;
    foreach ((array) ($contenu['products'] ?? []) as $p) {
        if (($p['category'] ?? '') === $id) $utilisee++;
    }
    if ($utilisee > 0) {
        messageFlash(
            sprintf('Impossible : %d produit(s) utilisent encore cette catégorie. Changez-les d\'abord.', $utilisee),
            'erreur'
        );
        header('Location: ' . $retour);
        exit;
    }
}

array_splice($elements, $indice, 1);

if (ecrireContenu(collectionEcrire($contenu, $def, $elements))) {
    // Les images ne sont effacées qu'une fois l'enregistrement réussi :
    // sinon un échec laisserait un élément sans visuel.
    foreach ($def['champs'] as $nom => $d) {
        if (($d['type'] ?? '') === 'image') {
            supprimerImagesDe($element, $nom);
        }
    }
    messageFlash('« ' . ($element['name'] ?? 'Élément') . ' » supprimé.');
} else {
    messageFlash("La suppression n'a pas pu être enregistrée.", 'erreur');
}

header('Location: ' . $retour);
exit;
