<?php
/**
 * SEFELEC — Téléversement des fiches techniques
 * ==============================================
 * Un fichier déposé par un utilisateur est le premier vecteur d'attaque
 * d'un site. Trois précautions, dans cet ordre d'importance :
 *
 *  1. Le type est vérifié sur le CONTENU du fichier, jamais sur son nom.
 *     Un « facture.pdf » peut parfaitement contenir du code PHP ; seuls
 *     les premiers octets ne mentent pas.
 *  2. Le nom enregistré est engendré par le serveur, jamais repris de
 *     celui fourni. Cela écarte d'un coup les noms piégés — « ../ »,
 *     double extension, caractères de contrôle.
 *  3. Le dossier de destination interdit l'exécution de PHP, par son
 *     propre .htaccess. Même si un fichier malveillant y parvenait, il
 *     serait servi comme un fichier, jamais exécuté.
 */

declare(strict_types=1);

define('DOSSIER_DOCUMENTS', RACINE . '/assets/documents');

const TAILLE_MAX_PDF = 20 * 1024 * 1024; // 20 Mo

/**
 * Enregistre le PDF reçu et renvoie ses informations, ou une erreur.
 * @return array{chemin:string,nom:string,taille:int}|array{erreur:string}
 */
function traiterDocument(array $fichier): array
{
    if (($fichier['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return ['erreur' => 'Le téléversement du document a échoué.'];
    }
    if (($fichier['size'] ?? 0) > TAILLE_MAX_PDF) {
        return ['erreur' => 'Document trop lourd : 20 Mo au maximum.'];
    }
    if (($fichier['size'] ?? 0) === 0) {
        return ['erreur' => 'Le fichier est vide.'];
    }

    // --- Vérification du contenu réel ---
    // Un PDF commence toujours par « %PDF- ». On le lit directement
    // plutôt que de se fier à l'extension ou au type déclaré par le
    // navigateur, tous deux fournis par le client.
    $flux = @fopen($fichier['tmp_name'], 'rb');
    if ($flux === false) {
        return ['erreur' => 'Le fichier n\'a pas pu être lu.'];
    }
    $entete = (string) fread($flux, 5);
    fclose($flux);

    if (strncmp($entete, '%PDF-', 5) !== 0) {
        return ['erreur' => 'Ce fichier n\'est pas un PDF. Seuls les PDF sont acceptés.'];
    }

    if (!is_dir(DOSSIER_DOCUMENTS) && !@mkdir(DOSSIER_DOCUMENTS, 0755, true)) {
        return ['erreur' => 'Le dossier des documents n\'a pas pu être créé.'];
    }
    protegerDossierDocuments();

    // Nom engendré par le serveur. Le nom d'origine est conservé à part,
    // pour l'afficher au visiteur, mais n'entre jamais dans le chemin.
    $identifiant = bin2hex(random_bytes(8));
    $destination = DOSSIER_DOCUMENTS . '/' . $identifiant . '.pdf';

    if (!move_uploaded_file($fichier['tmp_name'], $destination)) {
        return ['erreur' => 'L\'enregistrement du document a échoué.'];
    }
    @chmod($destination, 0644);

    return [
        'chemin' => 'assets/documents/' . $identifiant . '.pdf',
        'nom'    => nomLisible((string) ($fichier['name'] ?? 'fiche-technique.pdf')),
        'taille' => (int) $fichier['size']
    ];
}

/**
 * Nettoie le nom d'origine pour l'affichage : il n'est utilisé que comme
 * libellé, mais il finit dans du HTML et dans un en-tête de
 * téléchargement, où un retour à la ligne permettrait une injection.
 */
function nomLisible(string $nom): string
{
    $nom = basename($nom);
    $nom = str_replace(["\r", "\n", "\0", '"'], '', $nom);
    $nom = preg_replace('/\.(pdf)$/i', '', $nom) ?? $nom;
    return mb_substr(trim($nom), 0, 80);
}

/** Interdit l'exécution de PHP dans le dossier des documents. */
function protegerDossierDocuments(): void
{
    $htaccess = DOSSIER_DOCUMENTS . '/.htaccess';
    if (file_exists($htaccess)) {
        return;
    }
    $regles = "# Dossier de dépôt : aucun code ne doit s'y exécuter.\n"
        . "# Un fichier malveillant qui y parviendrait serait servi comme\n"
        . "# un simple fichier, jamais interprété.\n"
        . "<FilesMatch \"\\.(php[0-9]?|phtml|phar|cgi|pl|py|sh|htaccess)$\">\n"
        . "  Require all denied\n"
        . "</FilesMatch>\n"
        . "php_flag engine off\n"
        . "Options -Indexes -ExecCGI\n"
        . "AddType application/pdf .pdf\n";
    @file_put_contents($htaccess, $regles);
}

/**
 * Efface le document d'un élément lorsqu'il est remplacé ou supprimé.
 * Le chemin est vérifié : on ne supprime que dans le dossier prévu,
 * quelle que soit la valeur enregistrée.
 */
function supprimerDocumentDe(array $element, string $champ): void
{
    $rel = $element[$champ]['chemin'] ?? null;
    if (!$rel) {
        return;
    }
    $abs = realpath(RACINE . '/' . $rel);
    $base = realpath(DOSSIER_DOCUMENTS);
    if ($abs && $base && strpos($abs, $base) === 0 && is_file($abs)) {
        @unlink($abs);
    }
}

/** Taille lisible, pour prévenir le visiteur avant qu'il ne télécharge. */
function tailleLisible(int $octets): string
{
    if ($octets >= 1048576) {
        return number_format($octets / 1048576, 1, ',', ' ') . ' Mo';
    }
    return max(1, (int) round($octets / 1024)) . ' Ko';
}
