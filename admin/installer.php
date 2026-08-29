<?php
/**
 * SEFELEC — Première configuration de l'administration
 * =====================================================
 * Définit le mot de passe d'accès. À ouvrir une seule fois.
 *
 * Le mot de passe n'est jamais enregistré tel quel : seule son empreinte
 * l'est, calculée par password_hash. Même en lisant le fichier produit,
 * on ne peut pas retrouver le mot de passe.
 *
 * Une fois mot-de-passe.php créé, cette page refuse de fonctionner :
 * elle ne peut donc pas servir à réinitialiser l'accès depuis l'extérieur.
 */

declare(strict_types=1);

$cible = __DIR__ . '/mot-de-passe.php';
$dejaFait = file_exists($cible);
$message = null;
$erreur = null;

if (!$dejaFait && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $mdp = (string) ($_POST['motdepasse'] ?? '');
    $confirmation = (string) ($_POST['confirmation'] ?? '');

    if (mb_strlen($mdp) < 10) {
        $erreur = 'Choisissez un mot de passe d\'au moins 10 caractères.';
    } elseif ($mdp !== $confirmation) {
        $erreur = 'Les deux saisies ne correspondent pas.';
    } else {
        $empreinte = password_hash($mdp, PASSWORD_DEFAULT);
        $contenu = "<?php\n"
            . "// Empreinte du mot de passe de l'administration.\n"
            . "// Ce fichier ne doit jamais être publié ni partagé.\n"
            . "return " . var_export($empreinte, true) . ";\n";

        if (file_put_contents($cible, $contenu) === false) {
            $erreur = "Impossible d'écrire mot-de-passe.php. Vérifiez les droits du dossier admin.";
        } else {
            @chmod($cible, 0600);
            $message = 'Mot de passe enregistré.';
            $dejaFait = true;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Configuration — Administration SEFELEC</title>
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="admin.css">
</head>
<body class="admin-connexion">
  <main class="connexion-boite">
    <img src="/assets/images/logo-icon.png" alt="SEFELEC" width="56" height="56">
    <h1>Configuration</h1>

    <?php if ($message): ?>
      <p class="admin-alerte admin-alerte-succes"><?= htmlspecialchars($message, ENT_QUOTES) ?></p>
    <?php endif; ?>
    <?php if ($erreur): ?>
      <p class="admin-alerte admin-alerte-erreur"><?= htmlspecialchars($erreur, ENT_QUOTES) ?></p>
    <?php endif; ?>

    <?php if ($dejaFait): ?>
      <p class="connexion-sous-titre">
        L'administration est configurée.<br>
        <strong>Supprimez maintenant le fichier <code>admin/installer.php</code></strong>
        depuis le Gestionnaire de fichiers.
      </p>
      <p><a href="connexion.php" class="btn btn-primary btn-block">Aller à la connexion</a></p>
    <?php else: ?>
      <p class="connexion-sous-titre">Choisissez le mot de passe d'accès à l'administration.</p>
      <form method="post" autocomplete="off">
        <label for="motdepasse">Mot de passe</label>
        <input type="password" id="motdepasse" name="motdepasse" required minlength="10" autofocus>
        <label for="confirmation">Confirmation</label>
        <input type="password" id="confirmation" name="confirmation" required minlength="10">
        <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
      </form>
    <?php endif; ?>
  </main>
</body>
</html>
