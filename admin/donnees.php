<?php
/**
 * SEFELEC — Accès générique aux collections
 * ==========================================
 * Fait le pont entre la déclaration du schéma et la forme réelle de
 * content.json, qui n'est pas homogène : produits, services, partenaires
 * et témoignages sont des listes d'objets, tandis que les catégories
 * sont une simple correspondance « adresse → nom ».
 *
 * Cette différence est absorbée ici, une fois pour toutes, plutôt que
 * dans chaque écran.
 */

declare(strict_types=1);

/** Renvoie les éléments d'une collection, toujours sous forme de liste. */
function collectionLire(array $contenu, array $def): array
{
    if ($def['cle'] === '__categories') {
        // La correspondance devient une liste d'objets, pour que les
        // écrans n'aient qu'un seul format à connaître.
        $sortie = [];
        foreach ((array) ($contenu['categories'] ?? []) as $slug => $nom) {
            $sortie[] = ['id' => $slug, 'slug' => $slug, 'name' => $nom];
        }
        return $sortie;
    }
    return array_values((array) ($contenu[$def['cle']] ?? []));
}

/** Réécrit une collection entière dans le contenu. */
function collectionEcrire(array $contenu, array $def, array $elements): array
{
    if ($def['cle'] === '__categories') {
        $carte = [];
        foreach ($elements as $e) {
            $slug = trim((string) ($e['slug'] ?? ''));
            if ($slug !== '') {
                $carte[$slug] = (string) ($e['name'] ?? $slug);
            }
        }
        $contenu['categories'] = $carte;
        return $contenu;
    }
    $contenu[$def['cle']] = array_values($elements);
    return $contenu;
}

/** Retrouve un élément par son identifiant, avec sa position. */
function collectionTrouver(array $elements, string $id): array
{
    foreach ($elements as $i => $e) {
        if ((string) ($e['id'] ?? '') === $id) {
            return [$i, $e];
        }
    }
    return [null, null];
}

/**
 * Déplace un élément d'un cran.
 *
 * L'ordre du tableau EST l'ordre d'affichage sur le site : il n'y a pas
 * de champ de tri séparé à maintenir en cohérence.
 */
function collectionDeplacer(array $elements, string $id, int $sens): array
{
    [$i] = collectionTrouver($elements, $id);
    if ($i === null) {
        return $elements;
    }
    $j = $i + $sens;
    if ($j < 0 || $j >= count($elements)) {
        return $elements;
    }
    $tmp = $elements[$i];
    $elements[$i] = $elements[$j];
    $elements[$j] = $tmp;
    return $elements;
}

/**
 * Lit les valeurs envoyées par le formulaire, selon le type de chaque
 * champ. La validation des champs obligatoires est faite au passage.
 */
function champsDepuisFormulaire(array $champs, array $existant, array &$erreurs): array
{
    $valeurs = $existant;

    foreach ($champs as $nom => $def) {
        $brut = $_POST[$nom] ?? null;

        switch ($def['type']) {
            case 'booleen':
                $valeurs[$nom] = !empty($brut);
                break;

            case 'nombre':
                $n = ($brut === null || $brut === '') ? null : (int) $brut;
                if ($n !== null && isset($def['min']) && $n < $def['min']) $n = (int) $def['min'];
                if ($n !== null && isset($def['max']) && $n > $def['max']) $n = (int) $def['max'];
                $valeurs[$nom] = $n;
                break;

            case 'url':
                $u = trim((string) $brut);
                if ($u !== '' && !preg_match('#^https?://#i', $u)) {
                    // Une adresse sans protocole produirait un lien
                    // relatif pointant à l'intérieur du site.
                    $u = 'https://' . $u;
                }
                if ($u !== '' && !filter_var($u, FILTER_VALIDATE_URL)) {
                    $erreurs[] = sprintf('L\'adresse saisie pour « %s » n\'est pas valide.', $def['label']);
                    $u = (string) ($existant[$nom] ?? '');
                }
                $valeurs[$nom] = $u === '' ? null : $u;
                break;

            case 'paires':
                $paires = [];
                foreach (preg_split('/\r?\n/', (string) $brut) as $ligne) {
                    $ligne = trim($ligne);
                    if ($ligne === '' || strpos($ligne, ':') === false) continue;
                    [$cle, $val] = explode(':', $ligne, 2);
                    $cle = trim($cle);
                    $val = trim($val);
                    if ($cle !== '' && $val !== '') $paires[$cle] = $val;
                }
                $valeurs[$nom] = $paires;
                break;

            case 'couleur':
                $c = trim((string) $brut);
                $valeurs[$nom] = preg_match('/^#[0-9a-fA-F]{6}$/', $c) ? strtoupper($c) : ($def['defaut'] ?? null);
                break;

            case 'document':
            case 'image':
                // Traitée à part : le fichier n'arrive pas dans $_POST.
                break;

            default: // texte, zone, lignes, choix
                $v = trim((string) $brut);
                if (isset($def['max'])) {
                    $v = mb_substr($v, 0, (int) $def['max']);
                }
                $valeurs[$nom] = $v;
        }

        if (!empty($def['requis'])) {
            $v = $valeurs[$nom] ?? '';
            if ($v === '' || $v === null) {
                $erreurs[] = sprintf('Le champ « %s » est obligatoire.', $def['label']);
            }
        }
    }

    return $valeurs;
}

/** Valeur lisible d'un champ, pour la liste. */
function valeurAffichable($valeur, string $type): string
{
    if ($type === 'booleen') {
        return $valeur ? '★' : '';
    }
    if (is_array($valeur)) {
        return (string) count($valeur);
    }
    $texte = (string) ($valeur ?? '');
    return mb_strlen($texte) > 70 ? mb_substr($texte, 0, 70) . '…' : $texte;
}
