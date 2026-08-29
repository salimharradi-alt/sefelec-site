<?php
/**
 * SEFELEC — Rendu des champs de formulaire
 *
 * Un type de champ, une façon de l'afficher. Le formulaire lui-même ne
 * connaît aucun champ en particulier : il parcourt le schéma.
 */

declare(strict_types=1);

function afficherChamps(array $champs, array $valeurs, array $contenu): void
{
    $enAttenteDemi = null;

    foreach ($champs as $nom => $def) {
        // Deux champs marqués « demi » se placent côte à côte.
        if (!empty($def['demi'])) {
            if ($enAttenteDemi === null) {
                $enAttenteDemi = [$nom, $def];
                continue;
            }
            echo '<div class="admin-deux-colonnes">';
            afficherUnChamp($enAttenteDemi[0], $enAttenteDemi[1], $valeurs, $contenu);
            afficherUnChamp($nom, $def, $valeurs, $contenu);
            echo '</div>';
            $enAttenteDemi = null;
            continue;
        }

        if ($enAttenteDemi !== null) {
            afficherUnChamp($enAttenteDemi[0], $enAttenteDemi[1], $valeurs, $contenu);
            $enAttenteDemi = null;
        }
        afficherUnChamp($nom, $def, $valeurs, $contenu);
    }

    if ($enAttenteDemi !== null) {
        afficherUnChamp($enAttenteDemi[0], $enAttenteDemi[1], $valeurs, $contenu);
    }
}

function afficherUnChamp(string $nom, array $def, array $valeurs, array $contenu): void
{
    $valeur = $valeurs[$nom] ?? ($def['defaut'] ?? '');
    $requis = !empty($def['requis']) ? ' <span class="admin-requis">*</span>' : '';
    $lignes = (int) ($def['lignes'] ?? 4);

    echo '<div class="admin-champ">';
    echo '<label for="' . e($nom) . '">' . e($def['label']) . $requis . '</label>';

    switch ($def['type']) {

        case 'zone':
        case 'lignes':
            printf(
                '<textarea id="%s" name="%s" rows="%d"%s>%s</textarea>',
                e($nom), e($nom), $lignes,
                !empty($def['requis']) ? ' required' : '',
                e((string) $valeur)
            );
            break;

        case 'paires':
            $texte = '';
            foreach ((array) $valeur as $cle => $val) {
                $texte .= $cle . ' : ' . $val . "\n";
            }
            printf(
                '<textarea id="%s" name="%s" rows="%d" placeholder="Courant nominal : 20 A">%s</textarea>',
                e($nom), e($nom), $lignes, e(trim($texte))
            );
            break;

        case 'booleen':
            printf(
                '<label class="admin-bascule"><input type="checkbox" id="%s" name="%s" value="1"%s> <span>Oui</span></label>',
                e($nom), e($nom), !empty($valeur) ? ' checked' : ''
            );
            break;

        case 'nombre':
            printf(
                '<input type="number" id="%s" name="%s" value="%s"%s%s>',
                e($nom), e($nom), e((string) $valeur),
                isset($def['min']) ? ' min="' . (int) $def['min'] . '"' : '',
                isset($def['max']) ? ' max="' . (int) $def['max'] . '"' : ''
            );
            break;

        case 'couleur':
            // Le sélecteur graphique et le code hexadécimal restent liés :
            // certains préfèrent coller un code fourni par un graphiste.
            printf(
                '<div class="admin-couleur">'
                . '<input type="color" id="%1$s" name="%1$s" value="%2$s" oninput="this.nextElementSibling.value=this.value.toUpperCase()">'
                . '<input type="text" class="admin-couleur-code" value="%2$s" readonly>'
                . '</div>',
                e($nom), e((string) ($valeur ?: ($def['defaut'] ?? '#000000')))
            );
            break;

        case 'url':
            printf(
                '<input type="url" id="%s" name="%s" value="%s" placeholder="https://exemple.com">',
                e($nom), e($nom), e((string) $valeur)
            );
            break;

        case 'choix':
            $options = [];
            if (($def['source'] ?? '') === 'categories') {
                $options = (array) ($contenu['categories'] ?? []);
            }
            echo '<select id="' . e($nom) . '" name="' . e($nom) . '"'
                . (!empty($def['requis']) ? ' required' : '') . '>';
            echo '<option value="">— Choisir —</option>';
            foreach ($options as $cle => $libelle) {
                printf(
                    '<option value="%s"%s>%s</option>',
                    e((string) $cle),
                    (string) $valeur === (string) $cle ? ' selected' : '',
                    e((string) $libelle)
                );
            }
            echo '</select>';
            break;

        case 'image':
            if (!empty($valeur)) {
                printf(
                    '<div class="admin-apercu"><img src="/%s" alt="" width="110">'
                    . '<span>Image actuelle. En choisir une nouvelle la remplacera.</span></div>',
                    e((string) $valeur)
                );
            }
            printf(
                '<input type="file" id="%s" name="%s" accept="image/jpeg,image/png,image/webp">',
                e($nom), e($nom)
            );
            break;

        default: // texte
            printf(
                '<input type="text" id="%s" name="%s" value="%s"%s%s>',
                e($nom), e($nom), e((string) $valeur),
                !empty($def['requis']) ? ' required' : '',
                isset($def['max']) ? ' maxlength="' . (int) $def['max'] . '"' : ''
            );
    }

    if (!empty($def['aide'])) {
        echo '<small>' . e($def['aide']) . '</small>';
    }
    echo '</div>';
}
