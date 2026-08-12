<?php
/**
 * SEFELEC — Réception des demandes de devis
 * ==========================================
 * Reçoit le formulaire de devis et l'envoie par courriel à l'entreprise.
 *
 * Ce fichier ne s'exécute QUE sur l'hébergement : le serveur de
 * développement local est en Node.js et ne sait pas interpréter PHP.
 * Il y répond par une simulation (voir server.js) afin que le parcours
 * reste testable hors ligne.
 *
 * Réponse : toujours du JSON, pour que le site affiche un message clair
 * plutôt que de changer de page.
 */

// Volontairement écrit en PHP 7.4 compatible : la version installée sur
// l'hébergement n'est pas connue, et une syntaxe trop récente ferait
// échouer l'analyse du fichier avec une erreur 500 muette.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/** Adresse qui reçoit les demandes. */
const DESTINATAIRE = 'contact@sefelec.ma';

/**
 * Expéditeur technique. Doit appartenir au domaine : un courriel envoyé
 * au nom du visiteur (« De : client@gmail.com ») serait rejeté comme
 * usurpation par la plupart des messageries. L'adresse du visiteur est
 * placée en Reply-To, ce qui permet de lui répondre d'un clic.
 */
const EXPEDITEUR = 'no-reply@sefelec.ma';

function repondre($code, array $corps)
{
    http_response_code($code);
    echo json_encode($corps, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Neutralise l'injection d'en-têtes : un retour à la ligne dans un champ
 * réinjecté dans l'en-tête du courriel permettrait d'ajouter des
 * destinataires cachés et de transformer le site en relais de spam.
 */
function ligneSure(string $valeur): string
{
    return trim(str_replace(["\r", "\n", "\0"], ' ', $valeur));
}

function champ(string $nom, int $maximum = 200): string
{
    $valeur = isset($_POST[$nom]) && is_string($_POST[$nom]) ? $_POST[$nom] : '';
    $valeur = trim($valeur);

    // mbstring n'est pas garantie sur tous les hébergements : sans ce
    // repli, l'absence de l'extension provoquerait une erreur 500 muette.
    return function_exists('mb_substr')
        ? mb_substr($valeur, 0, $maximum)
        : substr($valeur, 0, $maximum);
}

// ---------------------------------------------------------------------
// 1. Contrôles d'entrée
// ---------------------------------------------------------------------

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    repondre(405, ['ok' => false, 'erreur' => 'Méthode non autorisée.']);
}

// Piège à robots : ce champ est masqué, un humain ne peut pas le remplir.
// On répond « ok » sans rien envoyer, pour ne pas renseigner le robot.
if (champ('site_web') !== '') {
    repondre(200, ['ok' => true]);
}

$nom        = ligneSure(champ('name', 120));
$entreprise = ligneSure(champ('company', 120));
$email      = ligneSure(champ('email', 160));
$telephone  = ligneSure(champ('phone', 40));
$message    = champ('message', 4000);

if ($nom === '' || $message === '') {
    repondre(422, [
        'ok' => false,
        'erreur' => 'Merci d\'indiquer au moins votre nom et la description de votre projet.',
    ]);
}

// Sans moyen de rappel, la demande serait inexploitable.
if ($email === '' && $telephone === '') {
    repondre(422, [
        'ok' => false,
        'erreur' => 'Merci d\'indiquer un email ou un téléphone pour que nous puissions vous répondre.',
    ]);
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    repondre(422, ['ok' => false, 'erreur' => 'L\'adresse email saisie n\'est pas valide.']);
}

// ---------------------------------------------------------------------
// 2. Composition du courriel
// ---------------------------------------------------------------------

$sujet = 'Demande de devis — ' . ($entreprise !== '' ? $entreprise : $nom);

$corps = "Nouvelle demande de devis depuis sefelec.ma\n"
    . str_repeat('-', 46) . "\n\n"
    . "Nom        : {$nom}\n"
    . 'Entreprise : ' . ($entreprise !== '' ? $entreprise : '—') . "\n"
    . 'Email      : ' . ($email !== '' ? $email : '—') . "\n"
    . 'Téléphone  : ' . ($telephone !== '' ? $telephone : '—') . "\n\n"
    . "Projet :\n{$message}\n\n"
    . str_repeat('-', 46) . "\n"
    . 'Reçue le ' . date('d/m/Y à H:i') . "\n";

$entetes = [
    'From: SEFELEC — Site web <' . EXPEDITEUR . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];

// Permet de répondre directement au visiteur depuis la messagerie.
if ($email !== '') {
    $entetes[] = 'Reply-To: ' . ($nom !== '' ? "{$nom} <{$email}>" : $email);
}

// Sujet encodé : sans cela, les accents arrivent illisibles.
$sujetEncode = '=?UTF-8?B?' . base64_encode($sujet) . '?=';

$envoye = @mail(
    DESTINATAIRE,
    $sujetEncode,
    $corps,
    implode("\r\n", $entetes),
    '-f' . EXPEDITEUR
);

if (!$envoye) {
    // Trace côté serveur pour diagnostic, sans exposer de détail au visiteur.
    error_log('[SEFELEC] Echec mail() pour une demande de devis de ' . $nom);
    repondre(500, [
        'ok' => false,
        'erreur' => 'L\'envoi a échoué. Contactez-nous au 06 65 84 18 07 ou à contact@sefelec.ma.',
    ]);
}

repondre(200, ['ok' => true]);
