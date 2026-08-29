<?php
/**
 * SEFELEC — Ossature commune des écrans d'administration
 *
 * En-tête, menu des sections et pied de page. Écrit une fois : ajouter
 * une section au schéma la fait apparaître dans le menu sans toucher à
 * quoi que ce soit d'autre.
 */

declare(strict_types=1);

function debutPage(string $titre, string $sectionActive = ''): void
{
    $schema = schemaContenu();
    ?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<?php require __DIR__ . '/partie-theme.php'; ?>
<title><?= e($titre) ?> — Administration SEFELEC</title>
<link rel="icon" href="/assets/images/favicon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="/assets/css/couleurs.css">
<link rel="stylesheet" href="admin.css">
</head>
<body class="admin">

<header class="admin-entete">
  <div class="admin-entete-inner">
    <a href="index.php" class="admin-logo">
      <img src="/assets/images/logo-icon.png" alt="" width="34" height="34">
      <span>Administration <strong>SEFELEC</strong></span>
    </a>
    <nav class="admin-nav">
      <button type="button" class="theme-toggle" aria-pressed="false" aria-label="Changer de thème" title="Thème">
        <svg class="icone-claire" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 12H2M22 12h-2.2M5.6 5.6 4 4M20 20l-1.6-1.6M18.4 5.6 20 4M4 20l1.6-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <svg class="icone-sombre" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.4 8.4 0 1 0 9.4 9.4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
        <span class="theme-toggle-libelle">Thème</span>
      </button>
      <a href="/" target="_blank" rel="noopener">Voir le site &nearr;</a>
      <a href="mot-de-passe-changer.php">Mot de passe</a>
      <a href="deconnexion.php">Déconnexion</a>
    </nav>
  </div>

  <div class="admin-sections">
    <div class="admin-sections-inner">
      <?php foreach ($schema as $cle => $def): ?>
        <a href="liste.php?type=<?= e($cle) ?>"
           class="admin-onglet<?= $sectionActive === $cle ? ' actif' : '' ?>">
          <span aria-hidden="true"><?= $def['icone'] ?></span> <?= e($def['libelle']) ?>
        </a>
      <?php endforeach; ?>
      <a href="reglages.php" class="admin-onglet<?= $sectionActive === 'reglages' ? ' actif' : '' ?>">
        <span aria-hidden="true">⚙️</span> Réglages
      </a>
    </div>
  </div>
</header>

<main class="admin-contenu">
<?php
}

function finPage(): void
{
    ?>
</main>
<script src="/assets/js/theme.js"></script>
</body>
</html>
<?php
}
