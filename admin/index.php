<?php
/**
 * SEFELEC — Point d'entrée de l'administration
 *
 * Redirige vers la première section. L'écran d'accueil de
 * l'administration est la liste des produits, la plus consultée.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
exigerConnexion();

header('Location: liste.php?type=produits');
exit;
