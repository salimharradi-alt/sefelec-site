<?php
/**
 * SEFELEC — Traitement des photos de produits
 * ============================================
 * Redimensionne la photo téléversée aux deux formats employés par le
 * site, et la convertit en WebP.
 *
 * Les proportions sont toujours conservées : l'image est réduite pour
 * tenir dans le cadre, jamais rognée ni étirée. Un produit photographié
 * en portrait reste en portrait.
 *
 * GD est utilisée plutôt qu'Imagick : les deux sont disponibles sur
 * l'hébergement, mais GD est présente partout et suffit ici.
 */

declare(strict_types=1);

/** Formats produits, alignés sur ceux qu'attend le site. */
const FORMAT_CARTE = ['largeur' => 600, 'hauteur' => 450];
const FORMAT_GRAND = ['largeur' => 1600, 'hauteur' => 1200];

const TAILLE_MAX_OCTETS = 12 * 1024 * 1024; // 12 Mo

/**
 * Traite le fichier reçu et écrit les deux versions.
 * Renvoie ['carte' => chemin, 'large' => chemin] ou ['erreur' => texte].
 */
function traiterImageProduit(array $fichier): array
{
    if (($fichier['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return ['erreur' => "Le téléversement de l'image a échoué."];
    }
    if (($fichier['size'] ?? 0) > TAILLE_MAX_OCTETS) {
        return ['erreur' => 'Image trop lourde : 12 Mo au maximum.'];
    }

    // Le type est déduit du contenu, jamais du nom du fichier : une
    // extension peut mentir, pas les premiers octets.
    $infos = @getimagesize($fichier['tmp_name']);
    if ($infos === false) {
        return ['erreur' => "Ce fichier n'est pas une image reconnue."];
    }

    $source = chargerImage($fichier['tmp_name'], $infos[2]);
    if ($source === null) {
        return ['erreur' => 'Format non pris en charge. Utilisez JPEG, PNG ou WebP.'];
    }

    if (!function_exists('imagewebp')) {
        imagedestroy($source);
        return ['erreur' => 'Le serveur ne sait pas produire de WebP.'];
    }

    $identifiant = bin2hex(random_bytes(8));
    $dossier = DOSSIER_IMAGES;
    if (!is_dir($dossier) && !@mkdir($dossier, 0755, true)) {
        imagedestroy($source);
        return ['erreur' => "Le dossier des images est introuvable et n'a pas pu être créé."];
    }

    $sorties = [];
    foreach (['carte' => FORMAT_CARTE, 'large' => FORMAT_GRAND] as $nom => $format) {
        $reduite = reduireDansCadre($source, $format['largeur'], $format['hauteur']);
        $chemin = $dossier . '/' . $identifiant . '-' . $nom . '.webp';

        if (!imagewebp($reduite, $chemin, 82)) {
            imagedestroy($reduite);
            imagedestroy($source);
            return ['erreur' => "L'enregistrement de l'image a échoué."];
        }
        imagedestroy($reduite);
        $sorties[$nom] = 'assets/images/content/' . $identifiant . '-' . $nom . '.webp';
    }

    imagedestroy($source);
    return $sorties;
}

/** Ouvre l'image selon son type réel. */
function chargerImage(string $chemin, int $type)
{
    switch ($type) {
        case IMAGETYPE_JPEG: return @imagecreatefromjpeg($chemin);
        case IMAGETYPE_PNG:  return @imagecreatefrompng($chemin);
        case IMAGETYPE_WEBP: return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($chemin) : null;
        default: return null;
    }
}

/**
 * Réduit l'image pour qu'elle tienne dans le cadre, sans la déformer
 * ni la rogner. Une image plus petite que le cadre n'est pas agrandie :
 * l'étirer ne ferait que la rendre floue.
 */
function reduireDansCadre($source, int $largeurMax, int $hauteurMax)
{
    $l = imagesx($source);
    $h = imagesy($source);

    $facteur = min($largeurMax / $l, $hauteurMax / $h, 1);
    $nl = max(1, (int) round($l * $facteur));
    $nh = max(1, (int) round($h * $facteur));

    $destination = imagecreatetruecolor($nl, $nh);

    // Préserve la transparence des PNG et des WebP.
    imagealphablending($destination, false);
    imagesavealpha($destination, true);
    $transparent = imagecolorallocatealpha($destination, 0, 0, 0, 127);
    imagefilledrectangle($destination, 0, 0, $nl, $nh, $transparent);

    imagecopyresampled($destination, $source, 0, 0, 0, 0, $nl, $nh, $l, $h);
    return $destination;
}

/**
 * Efface les fichiers de l'ancienne photo lorsqu'elle est remplacée.
 * Sans cela, le dossier accumulerait des images que plus rien n'affiche.
 */
function supprimerAnciennesImages(array $produit): void
{
    foreach (['image', 'imageLarge'] as $cle) {
        $rel = $produit[$cle] ?? null;
        if (!$rel) continue;

        // Garde-fou : on ne supprime que dans le dossier des images du
        // contenu, jamais ailleurs, quelle que soit la valeur reçue.
        $abs = realpath(RACINE . '/' . $rel);
        $base = realpath(DOSSIER_IMAGES);
        if ($abs && $base && strpos($abs, $base) === 0 && is_file($abs)) {
            @unlink($abs);
        }
    }
}
