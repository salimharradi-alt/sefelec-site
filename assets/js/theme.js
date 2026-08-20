/**
 * SEFELEC — Bascule clair / sombre
 * =================================
 * Ce fichier ne fait que câbler le bouton. L'application du thème, elle,
 * se trouve dans un court script inséré directement dans le <head> de
 * chaque page : il doit s'exécuter avant la première peinture, sinon le
 * visiteur voit un éclair blanc avant que le thème sombre s'applique.
 * Un fichier externe serait chargé trop tard pour cela.
 *
 * Règle de décision, dans cet ordre :
 *   1. un choix déjà enregistré par le visiteur ;
 *   2. sinon, le réglage de son système (prefers-color-scheme) ;
 *   3. sinon, le thème clair.
 */

(function () {
  var CLE = 'sefelec_theme';

  function themeCourant() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function appliquer(theme) {
    var racine = document.documentElement;

    // La transition n'est active que le temps du basculement. Laissée en
    // permanence, elle s'appliquerait aussi aux survols de cartes et
    // rendrait toute l'interface molle.
    racine.classList.add('theme-en-transition');
    racine.setAttribute('data-theme', theme);

    try { localStorage.setItem(CLE, theme); } catch (e) { /* navigation privée */ }

    majBoutons(theme);
    window.setTimeout(function () {
      racine.classList.remove('theme-en-transition');
    }, 300);
  }

  function majBoutons(theme) {
    var sombre = theme === 'dark';
    var boutons = document.querySelectorAll('.theme-toggle');

    for (var i = 0; i < boutons.length; i++) {
      var b = boutons[i];
      // aria-pressed annonce l'état aux lecteurs d'écran ; le libellé
      // décrit l'action à venir, pas l'état courant.
      b.setAttribute('aria-pressed', String(sombre));
      b.setAttribute('aria-label', sombre ? 'Passer au thème clair' : 'Passer au thème sombre');
      b.setAttribute('title', sombre ? 'Thème clair' : 'Thème sombre');

      var libelle = b.querySelector('.theme-toggle-libelle');
      if (libelle) libelle.textContent = sombre ? 'Thème clair' : 'Thème sombre';
    }
  }

  document.addEventListener('click', function (e) {
    var bouton = e.target.closest ? e.target.closest('.theme-toggle') : null;
    if (!bouton) return;
    e.preventDefault();
    appliquer(themeCourant() === 'dark' ? 'light' : 'dark');
  });

  // Si le visiteur n'a jamais choisi, le site suit son système en direct :
  // basculer le thème du téléphone bascule aussi le site, sans recharger.
  if (window.matchMedia) {
    var systeme = window.matchMedia('(prefers-color-scheme: dark)');
    var surChangement = function (e) {
      var choix = null;
      try { choix = localStorage.getItem(CLE); } catch (err) { /* ignoré */ }
      if (choix) return;
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      majBoutons(e.matches ? 'dark' : 'light');
    };
    if (systeme.addEventListener) systeme.addEventListener('change', surChangement);
    else if (systeme.addListener) systeme.addListener(surChangement);
  }

  majBoutons(themeCourant());
})();
