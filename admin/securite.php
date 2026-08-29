<?php
/**
 * SEFELEC — Protection contre les tentatives répétées
 * ====================================================
 * L'administration est accessible publiquement, à une adresse devinable.
 * Sans limite, un programme peut essayer des milliers de mots de passe
 * par minute : une temporisation d'une seconde ne suffit pas.
 *
 * Le nombre d'échecs est compté par adresse IP. Au-delà du seuil, cette
 * adresse est écartée pour un temps, quel que soit le mot de passe
 * proposé. Un essai réussi remet le compteur à zéro.
 *
 * Le suivi tient dans un fichier : l'hébergement n'a pas de base de
 * données, et le volume concerné ne le justifie pas.
 */

declare(strict_types=1);

const FICHIER_TENTATIVES = __DIR__ . '/tentatives.php';
const ECHECS_AVANT_BLOCAGE = 5;
const DUREE_BLOCAGE = 900;   // 15 minutes
const FENETRE_COMPTAGE = 900; // les échecs plus anciens sont oubliés

function adresseVisiteur(): string
{
    // On ne se fie qu'à REMOTE_ADDR : les en-têtes X-Forwarded-For sont
    // fournis par le client et peuvent être forgés, ce qui permettrait
    // de contourner le blocage en changeant d'en-tête à chaque essai.
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'inconnue');
}

function lireTentatives(): array
{
    if (!file_exists(FICHIER_TENTATIVES)) {
        return [];
    }
    $donnees = @include FICHIER_TENTATIVES;
    return is_array($donnees) ? $donnees : [];
}

function ecrireTentatives(array $tentatives): void
{
    // Purge des entrées périmées, pour que le fichier ne grossisse pas
    // indéfiniment au fil des mois.
    $limite = time() - max(DUREE_BLOCAGE, FENETRE_COMPTAGE);
    foreach ($tentatives as $ip => $t) {
        if (($t['dernier'] ?? 0) < $limite) {
            unset($tentatives[$ip]);
        }
    }

    $contenu = "<?php\n// Suivi des tentatives de connexion. Fichier technique.\nreturn "
        . var_export($tentatives, true) . ";\n";

    $temporaire = FICHIER_TENTATIVES . '.tmp';
    if (file_put_contents($temporaire, $contenu, LOCK_EX) !== false) {
        @rename($temporaire, FICHIER_TENTATIVES);
    }
}

/** Secondes restantes avant de pouvoir réessayer, ou 0 si non bloqué. */
function secondesAvantNouvelEssai(): int
{
    $t = lireTentatives()[adresseVisiteur()] ?? null;
    if (!$t || ($t['echecs'] ?? 0) < ECHECS_AVANT_BLOCAGE) {
        return 0;
    }
    $reste = ($t['dernier'] ?? 0) + DUREE_BLOCAGE - time();
    return $reste > 0 ? $reste : 0;
}

function enregistrerEchec(): void
{
    $tentatives = lireTentatives();
    $ip = adresseVisiteur();
    $t = $tentatives[$ip] ?? ['echecs' => 0, 'dernier' => 0];

    // Une série d'échecs isolés dans le temps ne doit pas s'additionner
    // indéfiniment : au-delà de la fenêtre, on repart de zéro.
    if (time() - ($t['dernier'] ?? 0) > FENETRE_COMPTAGE) {
        $t['echecs'] = 0;
    }

    $t['echecs'] = ($t['echecs'] ?? 0) + 1;
    $t['dernier'] = time();
    $tentatives[$ip] = $t;

    ecrireTentatives($tentatives);
}

function reinitialiserEchecs(): void
{
    $tentatives = lireTentatives();
    unset($tentatives[adresseVisiteur()]);
    ecrireTentatives($tentatives);
}

/** Nombre d'essais encore possibles avant blocage. */
function essaisRestants(): int
{
    $t = lireTentatives()[adresseVisiteur()] ?? null;
    $faits = $t['echecs'] ?? 0;
    return max(0, ECHECS_AVANT_BLOCAGE - $faits);
}
