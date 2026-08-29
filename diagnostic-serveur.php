<?php
/**
 * SEFELEC — Diagnostic du serveur
 * ================================
 * Vérifie ce que l'hébergement permet, afin de savoir si une
 * administration en PHP peut y tourner : version de PHP, bibliothèque
 * de traitement d'images, droits d'écriture.
 *
 * Fichier temporaire, à supprimer une fois le diagnostic établi.
 * Protégé par un jeton : sans lui, il ne révèle rien de la
 * configuration du serveur à un visiteur de passage.
 */

// Jeton exigé dans l'adresse. Sans lui, la page se tait.
const JETON = 'sefelec-diagnostic-2026';

if (($_GET['cle'] ?? '') !== JETON) {
    http_response_code(404);
    exit('Not found');
}

header('Content-Type: application/json; charset=utf-8');

/** Teste l'écriture réelle dans un dossier, pas seulement is_writable(). */
function testerEcriture($chemin)
{
    if (!is_dir($chemin)) {
        return ['existe' => false];
    }
    $essai = rtrim($chemin, '/') . '/.essai-ecriture-' . uniqid();
    $ecrit = @file_put_contents($essai, 'test');
    if ($ecrit !== false) {
        @unlink($essai);
    }
    return [
        'existe'         => true,
        'inscriptible'   => $ecrit !== false,
        'is_writable'    => is_writable($chemin)
    ];
}

$racine = __DIR__;

$rapport = [
    'php' => [
        'version'          => PHP_VERSION,
        'version_id'       => PHP_VERSION_ID,
        'memory_limit'     => ini_get('memory_limit'),
        'max_upload'       => ini_get('upload_max_filesize'),
        'max_post'         => ini_get('post_max_size'),
        'max_execution'    => ini_get('max_execution_time')
    ],
    'images' => [
        'gd'        => extension_loaded('gd'),
        'imagick'   => extension_loaded('imagick'),
        'webp'      => function_exists('imagewebp'),
        'gd_infos'  => function_exists('gd_info') ? array_intersect_key(gd_info(), array_flip(['GD Version', 'WebP Support', 'JPEG Support', 'PNG Support'])) : null
    ],
    'extensions_utiles' => [
        'json'      => extension_loaded('json'),
        'mbstring'  => extension_loaded('mbstring'),
        'fileinfo'  => extension_loaded('fileinfo'),
        'session'   => extension_loaded('session'),
        'openssl'   => extension_loaded('openssl')
    ],
    'ecriture' => [
        'racine'            => testerEcriture($racine),
        'assets/data'       => testerEcriture($racine . '/assets/data'),
        'images/content'    => testerEcriture($racine . '/assets/images/content'),
        'services'          => testerEcriture($racine . '/services'),
        'produits'          => testerEcriture($racine . '/produits')
    ],
    'contenu' => [
        'content_json_present' => file_exists($racine . '/assets/data/content.json'),
        'content_json_taille'  => file_exists($racine . '/assets/data/content.json')
            ? filesize($racine . '/assets/data/content.json') : 0
    ],
    'serveur' => [
        'logiciel'  => $_SERVER['SERVER_SOFTWARE'] ?? '?',
        'mail'      => function_exists('mail')
    ]
];

echo json_encode($rapport, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
