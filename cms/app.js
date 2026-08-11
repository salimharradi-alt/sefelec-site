/**
 * SEFELEC — Point d'entrée du tableau de bord en ligne
 * =====================================================
 * Ce fichier n'est utilisé QUE sur l'hébergement, par la fonction
 * « Setup Node.js App » de cPanel. En local, rien ne change : c'est
 * toujours demarrer.cmd qui lance Directus.
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * cPanel démarre les applications Node.js avec Passenger, qui exige un
 * fichier de démarrage classique. Or le paquet « directus » n'est qu'un
 * lanceur en ligne de commande : il ne peut pas être démarré ainsi.
 *
 * Passenger surveille les serveurs qui se mettent à écouter DANS le
 * processus qu'il a lancé. Lancer Directus comme sous-processus ne
 * fonctionnerait donc pas : il faut démarrer le serveur ici même.
 *
 * @directus/api expose « startServer » pour cela. On l'appelle via un
 * import dynamique parce que ce module est en ESM alors que Passenger
 * charge ce fichier en CommonJS.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Les variables de connexion sont lues depuis cms/.env, comme en local.
// Sur l'hébergement, ce fichier doit contenir les valeurs de production
// (voir .env.production.example).

// Sans extension : la table « exports » du paquet ajoute elle-même « .js ».
// Écrire « @directus/api/server.js » ferait chercher « server.js.js ».
import('@directus/api/server')
  .then(({ startServer }) => startServer())
  .catch((erreur) => {
    // Sans ce message, Passenger n'afficherait qu'une page 503 muette.
    console.error('[SEFELEC] Le tableau de bord n\'a pas pu démarrer :');
    console.error(erreur);
    process.exit(1);
  });
