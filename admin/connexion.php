<?php
/**
 * SEFELEC — Écran de connexion à l'administration
 *
 * Le mot de passe attendu n'est pas ici : seule son empreinte est lue
 * depuis mot-de-passe.php, fichier absent du dépôt public.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';

demarrerSession();

if (estConnecte()) {
    header('Location: index.php');
    exit;
}

$erreur = null;
$fichierMdp = __DIR__ . '/mot-de-passe.php';

if (!file_exists($fichierMdp)) {
    $erreur = 'L\'administration n\'est pas encore configurée. '
        . 'Le fichier admin/mot-de-passe.php est absent.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifierCsrf();

    /** @var string $EMPREINTE_MOT_DE_PASSE */
    $EMPREINTE_MOT_DE_PASSE = require $fichierMdp;
    $saisi = (string) ($_POST['motdepasse'] ?? '');

    // Ralentit les tentatives répétées : une seconde par essai suffit à
    // rendre une attaque par dictionnaire inexploitable, sans gêner un
    // utilisateur légitime.
    $derniere = $_SESSION['dernier_essai'] ?? 0;
    if (time() - $derniere < 1) {
        sleep(1);
    }
    $_SESSION['dernier_essai'] = time();

    if ($saisi !== '' && password_verify($saisi, $EMPREINTE_MOT_DE_PASSE)) {
        session_regenerate_id(true); // empêche la fixation de session
        $_SESSION['connecte'] = true;
        $_SESSION['vu_a'] = time();
        header('Location: index.php');
        exit;
    }
    $erreur = 'Mot de passe incorrect.';
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<?php require __DIR__ . '/partie-theme.php'; ?>
<title>Connexion — Administration SEFELEC</title>
<link rel="icon" href="/assets/images/favicon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="admin.css">
</head>
<body class="admin-connexion">
  <main class="connexion-boite">
    <img src="/assets/images/logo-icon.png" alt="SEFELEC" width="56" height="56">
    <h1>Administration</h1>
    <p class="connexion-sous-titre">Gestion du catalogue SEFELEC</p>

    <?php if ($erreur): ?>
      <p class="admin-alerte admin-alerte-erreur"><?= e($erreur) ?></p>
    <?php endif; ?>

    <?php if (file_exists($fichierMdp)): ?>
      <form method="post" autocomplete="off">
        <input type="hidden" name="csrf" value="<?= e(jetonCsrf()) ?>">
        <label for="motdepasse">Mot de passe</label>
        <input type="password" id="motdepasse" name="motdepasse" required autofocus>
        <button type="submit" class="btn btn-primary btn-block">Se connecter</button>
      </form>
    <?php endif; ?>

    <p class="connexion-retour"><a href="/">&larr; Retour au site</a></p>
  </main>
<script src="/assets/js/theme.js"></script>
</body>
</html>
