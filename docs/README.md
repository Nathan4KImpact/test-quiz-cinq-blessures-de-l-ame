# Documents remis à Vie Florissante

Deux documents, chacun en trois formats. **Le `.html` est la source de
vérité** : c'est lui qu'on modifie, lui qui se lit dans un diff, et lui dont
les deux autres formats sont dérivés.

| Document | À qui il sert |
|---|---|
| `guide-accompagnant` | À l'association, pour accompagner une personne : déroulé du test, lecture des résultats, tableau de bord, situations courantes |
| `chronique-des-versions` | Au dossier BR/SLA : chaque fonctionnalité porte une référence citable, et la dernière partie rassemble les conditions d'exploitation |

## Régénérer les formats dérivés

```bash
bash docs/outils/generer.sh
```

Le PDF est rendu par un vrai navigateur, donc à l'identique de ce que montre
la page. Le DOCX est reconstruit en OOXML, avec des styles Word natifs
(Titre 1, 2, 3) pour rester navigable et modifiable par l'association.

## Pourquoi un contrôle de couverture

La conversion vers DOCX procède par réécritures successives du HTML. **Une
réécriture qui ne correspond à rien ne lève aucune erreur** : elle laisse le
bloc en place, où l'étape suivante l'ignore. Le document produit s'ouvre très
bien — il lui manque simplement une page, et rien ne le signale.

C'est arrivé trois fois en construisant cette chaîne : le tableau des paliers
de score, les pastilles d'état de la chronique, et son pied de page. À chaque
fois parce qu'un motif exigeait une balise nue là où le document portait une
classe, ou supposait une indentation.

`couverture.py` compare donc les occurrences de mots entre la source et le
document produit, et échoue s'il en manque une seule. Il tolère les
réordonnancements et les insertions — la conversion a le droit d'ajouter un
numéro d'étape — mais pas les pertes.

## Après un changement de comportement visible

Une livraison qui modifie ce que voit ou fait un participant rend le guide
faux sans rien casser. Les deux documents sont à relire à ce moment-là, pas
plus tard : le guide a déjà pris quatre livraisons de retard une fois, et
décrivait un formulaire qui n'existait plus.

Les mêmes documents sont publiés en pages consultables, mises à jour en même
temps que ces fichiers.
