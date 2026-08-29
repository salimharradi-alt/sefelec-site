<?php
/**
 * SEFELEC — Administration en ligne : configuration et socle
 * ===========================================================
 * Cette administration tourne en PHP, sur l'hébergement mutualisé
 * existant. Elle a été retenue parce que l'offre ne fait pas tourner
 * Node.js : le tableau de bord Directus ne peut donc pas y être installé,
 * alors que PHP, lui, y est disponible et vérifié.
 *
 * Elle écrit directement dans assets/data/content.json, que le site
 * public lit. Une modification est donc visible immédiatement, sans
 * aucune étape de publication.
 *
 * Le mot de passe n'est jamais stocké en clair : seule son empreinte
 * l'est, dans mot-de-passe.php, fichier exclu du dépôt.
 */

declare(strict_types=1);

// Racine du site : ce fichier vit dans /admin, le contenu est au-dessus.
define('RACINE', dirname(__DIR__));
define('FICHIER_CONTENU', RACINE . '/assets/data/content.json');
define('DOSSIER_IMAGES', RACINE . '/assets/images/content');

/** Durée d'inactivité au-delà de laquelle la session est fermée. */
const DUREE_SESSION = 3600; // une heure

// ---------------------------------------------------------------------
//  Session
// ---------------------------------------------------------------------

function demarrerSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/admin',
        'secure'   => !empty($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    session_name('sefelec_admin');
    session_start();
}

function estConnecte(): bool
{
    demarrerSession();

    if (empty($_SESSION['connecte'])) {
        return false;
    }
    // Une session oubliée ouverte sur un poste partagé se referme seule.
    if (time() - ($_SESSION['vu_a'] ?? 0) > DUREE_SESSION) {
        deconnecter();
        return false;
    }
    $_SESSION['vu_a'] = time();
    return true;
}

function exigerConnexion(): void
{
    if (!estConnecte()) {
        header('Location: connexion.php');
        exit;
    }
}

function deconnecter(): void
{
    demarrerSession();
    $_SESSION = [];
    session_destroy();
}

// ---------------------------------------------------------------------
//  Protection contre les envois forgés depuis un autre site
// ---------------------------------------------------------------------

function jetonCsrf(): string
{
    demarrerSession();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function verifierCsrf(): void
{
    demarrerSession();
    $recu = $_POST['csrf'] ?? '';
    if (!$recu || !hash_equals($_SESSION['csrf'] ?? '', $recu)) {
        http_response_code(419);
        exit('Session expirée. Revenez en arrière et rechargez la page.');
    }
}

// ---------------------------------------------------------------------
//  Contenu
// ---------------------------------------------------------------------

function lireContenu(): array
{
    if (!file_exists(FICHIER_CONTENU)) {
        return ['products' => [], 'categories' => new stdClass(), 'services' => []];
    }
    $brut = file_get_contents(FICHIER_CONTENU);
    $data = json_decode($brut, true);
    return is_array($data) ? $data : [];
}

/**
 * Écrit le contenu de façon atomique.
 *
 * L'écriture passe par un fichier temporaire puis un renommage : si le
 * serveur s'interrompt en cours d'écriture, content.json n'est jamais
 * laissé à moitié écrit — ce qui viderait le site entier.
 * Une copie de la version précédente est conservée.
 */
function ecrireContenu(array $contenu): bool
{
    $json = json_encode($contenu, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }

    if (file_exists(FICHIER_CONTENU)) {
        @copy(FICHIER_CONTENU, FICHIER_CONTENU . '.sauvegarde');
    }

    $temporaire = FICHIER_CONTENU . '.tmp';
    if (file_put_contents($temporaire, $json, LOCK_EX) === false) {
        return false;
    }
    return rename($temporaire, FICHIER_CONTENU);
}

// ---------------------------------------------------------------------
//  Utilitaires
// ---------------------------------------------------------------------

function e($valeur): string
{
    return htmlspecialchars((string) $valeur, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Fabrique une adresse courte : accents retirés, minuscules, tirets. */
function versSlug(string $texte): string
{
    $t = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $texte);
    $t = $t === false ? $texte : $t;
    $t = strtolower($t);
    $t = preg_replace('/[^a-z0-9]+/', '-', $t);
    return trim((string) $t, '-');
}

/** Message affiché une seule fois, après une redirection. */
function messageFlash(?string $texte = null, string $type = 'succes'): ?array
{
    demarrerSession();
    if ($texte !== null) {
        $_SESSION['flash'] = ['texte' => $texte, 'type' => $type];
        return null;
    }
    $m = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $m;
}
