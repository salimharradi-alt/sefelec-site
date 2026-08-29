<?php
/**
 * SEFELEC — Changement du mot de passe
 * =====================================
 * Jusqu'ici, changer le mot de passe imposait de supprimer
 * mot-de-passe.php via cPanel puis de relancer l'installateur : trop
 * lourd pour être fait quand il le faudrait vraiment, c'est-à-dire vite.
 *
 * Cette page l'autorise depuis l'administration, en exigeant le mot de
 * passe actuel : quelqu'un qui trouverait un poste resté connecté ne
 * pourrait pas verrouiller le compte pour autant.
 */

declare(strict_types=1);
require __DIR__ . '/config.php';
exigerConnexion();

$fichierMdp = __DIR__ . '/mot-de-passe.php';
$erreurs = [];
$reussi = false;
$contenuManuel = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifierCsrf();

    $actuel  = (string) ($_POST['actuel'] ?? '');
    $nouveau = (string) ($_POST['nouveau'] ?? '');
    $confirmation = (string) ($_POST['confirmation'] ?? '');

    $empreinteActuelle = file_exists($fichierMdp) ? require $fichierMdp : '';

    if (!password_verify($actuel, (string) $empreinteActuelle)) {
        $erreurs[] = 'Le mot de passe actuel est incorrect.';
    }
    if (mb_strlen($nouveau) < 12) {
        $erreurs[] = 'Le nouveau mot de passe doit faire au moins 12 caractères.';
    }
    // Un mot de passe bâti sur le nom de l'entreprise est le premier
    // qu'une attaque automatisée essaie.
    if (stripos($nouveau, 'sefelec') !== false) {
        $erreurs[] = 'Évitez le nom de l\'entreprise dans le mot de passe.';
    }
    if (preg_match('/^[a-zA-Z]+[0-9]{1,4}$/', $nouveau)) {
        $erreurs[] = 'Un mot suivi de chiffres est trop prévisible.';
    }
    if ($nouveau !== $confirmation) {
        $erreurs[] = 'Les deux saisies ne correspondent pas.';
    }

    if (!$erreurs) {
        $empreinte = password_hash($nouveau, PASSWORD_DEFAULT);
        $contenu = "<?php\n"
            . "// Empreinte du mot de passe de l'administration.\n"
            . "// Ce fichier ne doit jamais être publié ni partagé.\n"
            . "return " . var_export($empreinte, true) . ";\n";

        if (@file_put_contents($fichierMdp, $contenu) === false) {
            $erreurs[] = 'Le fichier n\'a pas pu être réécrit.';
            $contenuManuel = $contenu;
        } else {
            @chmod($fichierMdp, 0600);
            $reussi = true;
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
<?php require __DIR__ . '/partie-theme.php'; ?>
<title>Mot de passe — Administration SEFELEC</title>
<link rel="icon" href="/assets/images/favicon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/style.css">
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
      <a href="index.php">Produits</a>
      <a href="deconnexion.php">Déconnexion</a>
    </nav>
  </div>
</header>

<main class="admin-contenu admin-contenu-etroit">

  <p class="admin-fil"><a href="index.php">&larr; Retour aux produits</a></p>
  <h1>Changer le mot de passe</h1>

  <?php if ($reussi): ?>
    <p class="admin-alerte admin-alerte-succes">
      Mot de passe modifié. Il sera demandé à votre prochaine connexion.
    </p>
    <p><a href="index.php" class="btn btn-primary">Retour aux produits</a></p>
  <?php else: ?>

    <?php if ($erreurs): ?>
      <div class="admin-alerte admin-alerte-erreur">
        <?php foreach ($erreurs as $msg): ?><p><?= e($msg) ?></p><?php endforeach; ?>
      </div>
    <?php endif; ?>

    <?php if ($contenuManuel): ?>
      <div class="installer-secours">
        <p><strong>Le fichier n'est pas modifiable. Remplacez-le vous-même :</strong></p>
        <ol>
          <li>cPanel &rarr; Gestionnaire de fichiers &rarr; <code>admin/mot-de-passe.php</code></li>
          <li>Modifier, remplacer tout le contenu par le texte ci-dessous</li>
        </ol>
        <textarea readonly rows="4" onclick="this.select()"><?= e($contenuManuel) ?></textarea>
      </div>
    <?php endif; ?>

    <form method="post" class="admin-form" autocomplete="off">
      <input type="hidden" name="csrf" value="<?= e(jetonCsrf()) ?>">

      <div class="admin-champ">
        <label for="actuel">Mot de passe actuel <span class="admin-requis">*</span></label>
        <input type="password" id="actuel" name="actuel" required autofocus>
      </div>

      <div class="admin-champ">
        <label for="nouveau">Nouveau mot de passe <span class="admin-requis">*</span></label>
        <input type="password" id="nouveau" name="nouveau" required minlength="12">
        <small>
          Au moins 12 caractères. Évitez le nom de l'entreprise et les suites
          de chiffres : ce sont les premières combinaisons essayées.
        </small>
      </div>

      <div class="admin-champ">
        <label for="confirmation">Confirmation <span class="admin-requis">*</span></label>
        <input type="password" id="confirmation" name="confirmation" required minlength="12">
      </div>

      <div class="admin-actions-form">
        <button type="submit" class="btn btn-primary">Changer le mot de passe</button>
        <a href="index.php" class="btn btn-outline">Annuler</a>
      </div>
    </form>
  <?php endif; ?>

</main>
<script src="/assets/js/theme.js"></script>
</body>
</html>
