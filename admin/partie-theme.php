<?php
/**
 * SEFELEC — Application du thème dans l'administration
 * =====================================================
 * Ce fragment est inséré dans le <head> de chaque page de
 * l'administration. Il applique le thème avant la première peinture :
 * un fichier externe arriverait après, et un utilisateur en thème sombre
 * verrait un éclair blanc au chargement.
 *
 * La clé de stockage est celle du site public : le thème choisi sur le
 * site vaut donc aussi dans l'administration, et inversement.
 *
 * Écrit ici plutôt que recopié dans chaque page, pour n'avoir qu'un seul
 * endroit à corriger.
 */
?>
<script>
(function(){try{var c=localStorage.getItem('sefelec_theme');
document.documentElement.setAttribute('data-theme',c||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'));
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();
</script>
