<?php
/**
 * SEFELEC — Déclaration du contenu administrable
 * ===============================================
 * Chaque section du site est décrite ici : ses champs, leurs types,
 * leurs libellés et leurs aides. Les écrans de liste et de formulaire
 * sont ensuite construits automatiquement à partir de cette
 * déclaration.
 *
 * L'intérêt est de n'avoir qu'un seul endroit à modifier : ajouter un
 * champ à un service, c'est ajouter une ligne ici, sans toucher au
 * formulaire ni à la liste. Six écrans écrits à la main auraient été six
 * fois le même code à corriger.
 *
 * Types disponibles :
 *   texte    ligne simple
 *   zone     paragraphe libre
 *   lignes   liste à puces — une ligne par point, préfixée de « - »
 *   image    photo téléversée, redimensionnée automatiquement
 *   booleen  case à cocher
 *   nombre   valeur numérique
 *   choix    liste déroulante
 *   couleur  sélecteur de couleur
 *   url      adresse web, vérifiée
 *   paires   tableau « intitulé : valeur »
 */

declare(strict_types=1);

function schemaContenu(): array
{
    return [

        // ---------------------------------------------------------
        'produits' => [
            'libelle'   => 'Produits',
            'singulier' => 'produit',
            'cle'       => 'products',
            'icone'     => '📦',
            'colonnes'  => ['image', 'name', 'ref', 'categoryName'],
            'champs'    => [
                'name'         => ['type' => 'texte', 'label' => 'Nom du produit', 'requis' => true],
                'ref'          => ['type' => 'texte', 'label' => 'Référence', 'requis' => true, 'demi' => true],
                'category'     => ['type' => 'choix', 'label' => 'Catégorie', 'requis' => true, 'demi' => true,
                                   'source' => 'categories'],
                'desc'         => ['type' => 'zone', 'label' => 'Description', 'lignes' => 3,
                                   'aide' => 'Phrase courte affichée sur la carte du produit.'],
                'image'        => ['type' => 'image', 'label' => 'Photo du produit'],
                'image_alt'    => ['type' => 'texte', 'label' => 'Description de l\'image',
                                   'aide' => 'Lue par les personnes non voyantes et par les moteurs de recherche.'],
                'fiche_technique' => ['type' => 'document', 'label' => 'Fiche technique (PDF)',
                                   'aide' => 'Document PDF de 20 Mo au maximum. Un bouton de téléchargement apparaîtra sur la fiche du produit.'],
                'specs'        => ['type' => 'paires', 'label' => 'Caractéristiques techniques', 'lignes' => 6,
                                   'aide' => 'Une par ligne, sous la forme « Intitulé : valeur ».'],
                'applications' => ['type' => 'lignes', 'label' => 'Applications', 'lignes' => 4, 'repli' => 'Compléments',
                                   'aide' => 'Une par ligne, préfixée d\'un tiret. Vide, la section n\'apparaît pas.'],
                'avantages'    => ['type' => 'lignes', 'label' => 'Avantages', 'lignes' => 4, 'repli' => 'Compléments'],
                'seo_title'    => ['type' => 'texte', 'label' => 'Titre pour les moteurs', 'repli' => 'Référencement',
                                   'max' => 70, 'aide' => 'Environ 60 caractères. Vide, il est composé automatiquement.'],
                'seo_description' => ['type' => 'zone', 'label' => 'Description pour les moteurs', 'lignes' => 2,
                                   'repli' => 'Référencement', 'max' => 170],
            ],
        ],

        // ---------------------------------------------------------
        'services' => [
            'libelle'   => 'Services',
            'singulier' => 'service',
            'cle'       => 'services',
            'icone'     => '🛠️',
            'colonnes'  => ['name', 'description', 'featured'],
            'ordonnable' => true,
            'champs'    => [
                'name'        => ['type' => 'texte', 'label' => 'Nom du service', 'requis' => true],
                'description' => ['type' => 'zone', 'label' => 'Description courte', 'lignes' => 2, 'requis' => true,
                                  'aide' => 'Phrase affichée sur la carte, en page d\'accueil.'],
                'featured'    => ['type' => 'booleen', 'label' => 'Activité principale',
                                  'aide' => 'Le service coché est mis en avant : carte pleine largeur, en tête de section.'],
                'details'     => ['type' => 'lignes', 'label' => 'Détail de la prestation', 'lignes' => 8,
                                  'aide' => 'Une ligne par point, préfixée d\'un tiret. Les lignes sans tiret deviennent des paragraphes.'],
                'avantages'   => ['type' => 'lignes', 'label' => 'Ce que le client y gagne', 'lignes' => 5],
                'applications'=> ['type' => 'lignes', 'label' => 'Secteurs et applications', 'lignes' => 5],
                'equipements' => ['type' => 'lignes', 'label' => 'Équipements et solutions', 'lignes' => 5],
                'seo_title'   => ['type' => 'texte', 'label' => 'Titre pour les moteurs', 'repli' => 'Référencement', 'max' => 70],
                'seo_description' => ['type' => 'zone', 'label' => 'Description pour les moteurs', 'lignes' => 2,
                                  'repli' => 'Référencement', 'max' => 170],
            ],
        ],

        // ---------------------------------------------------------
        'partenaires' => [
            'libelle'   => 'Partenaires',
            'singulier' => 'partenaire',
            'cle'       => 'partners',
            'icone'     => '🤝',
            'colonnes'  => ['logo', 'name', 'website'],
            'ordonnable' => true,
            'champs'    => [
                'name'        => ['type' => 'texte', 'label' => 'Nom', 'requis' => true],
                'logo'        => ['type' => 'image', 'label' => 'Logo', 'preset' => 'logo',
                                  'aide' => 'Le logo est réduit sans être rogné ni déformé.'],
                'alt'         => ['type' => 'texte', 'label' => 'Description du logo',
                                  'aide' => 'Vide, elle est composée automatiquement.'],
                'website'     => ['type' => 'url', 'label' => 'Site officiel',
                                  'aide' => 'Laissez vide si vous ne la connaissez pas : le logo s\'affichera sans lien. N\'inventez jamais une adresse.'],
                'description' => ['type' => 'texte', 'label' => 'Courte description'],
            ],
        ],

        // ---------------------------------------------------------
        'temoignages' => [
            'libelle'   => 'Témoignages',
            'singulier' => 'témoignage',
            'cle'       => 'testimonials',
            'icone'     => '💬',
            'colonnes'  => ['name', 'role', 'rating'],
            'ordonnable' => true,
            'champs'    => [
                'name'   => ['type' => 'texte', 'label' => 'Nom du client', 'requis' => true, 'demi' => true],
                'role'   => ['type' => 'texte', 'label' => 'Fonction et société', 'demi' => true],
                'quote'  => ['type' => 'zone', 'label' => 'Témoignage', 'lignes' => 4, 'requis' => true],
                'rating' => ['type' => 'nombre', 'label' => 'Note sur 5', 'min' => 1, 'max' => 5, 'demi' => true],
                'photo'  => ['type' => 'image', 'label' => 'Photo', 'preset' => 'miniature',
                             'aide' => 'Facultative. Sans photo, les initiales sont affichées.'],
            ],
        ],

        // ---------------------------------------------------------
        'categories' => [
            'libelle'   => 'Catégories',
            'singulier' => 'catégorie',
            'cle'       => '__categories',   // stockage particulier, voir donnees.php
            'icone'     => '🗂️',
            'colonnes'  => ['name', 'slug'],
            'champs'    => [
                'name' => ['type' => 'texte', 'label' => 'Nom de la catégorie', 'requis' => true],
                'slug' => ['type' => 'texte', 'label' => 'Adresse',
                           'aide' => 'Minuscules et tirets. La modifier change l\'adresse des fiches produits de cette catégorie.'],
            ],
        ],
    ];
}

/**
 * Réglages du site — un seul enregistrement, donc un écran à part.
 */
function schemaReglages(): array
{
    return [
        'Coordonnées' => [
            'site_name' => ['type' => 'texte', 'label' => 'Nom de l\'entreprise'],
            'tagline'   => ['type' => 'texte', 'label' => 'Accroche'],
            'phone_1'   => ['type' => 'texte', 'label' => 'Téléphone principal', 'demi' => true],
            'phone_2'   => ['type' => 'texte', 'label' => 'Téléphone secondaire', 'demi' => true],
            'whatsapp'  => ['type' => 'texte', 'label' => 'Numéro WhatsApp', 'demi' => true,
                            'aide' => 'Au format international, sans « + » : 212705638780'],
            'email'     => ['type' => 'texte', 'label' => 'Adresse e-mail', 'demi' => true],
            'address'   => ['type' => 'zone', 'label' => 'Adresse postale', 'lignes' => 2],
            'opening_hours' => ['type' => 'texte', 'label' => 'Horaires d\'ouverture'],
        ],
        'Réseaux sociaux' => [
            'facebook'  => ['type' => 'url', 'label' => 'Facebook'],
            'instagram' => ['type' => 'url', 'label' => 'Instagram'],
            'linkedin'  => ['type' => 'url', 'label' => 'LinkedIn'],
        ],
        'Couleurs' => [
            'color_primary' => ['type' => 'couleur', 'label' => 'Couleur principale',
                                'defaut' => '#1E3A8A', 'demi' => true,
                                'aide' => 'Le bleu de l\'identité SEFELEC.'],
            'color_accent'  => ['type' => 'couleur', 'label' => 'Couleur d\'accent',
                                'defaut' => '#E53935', 'demi' => true,
                                'aide' => 'Le rouge des boutons et des mises en avant.'],
        ],
    ];
}
