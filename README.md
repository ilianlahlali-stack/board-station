# 🎲 Board Station

Une table de jeux de société dans le navigateur, pour jouer **au tour par tour sur le même ordinateur** (avec des amis et/ou des robots).

| Jeu | Joueurs | En bref |
| --- | --- | --- |
| **421** | 2–6 | Le jeu de dés des bistrots : charge, décharge, 21 jetons, dés 3D qui roulent sur la piste. |
| **Président** | 3–6 | Jeu classique de 52 cartes : plis, titres (Président → Trouduc) et échanges de cartes. |
| **Chroma** | 2–6 | Jeu de défausse par couleurs (blocage, inversion, +2, Prisme, +4) avec des cartes originales. |

## Jouer

Aucune installation, aucune dépendance :

1. Télécharge le dépôt (`Code → Download ZIP`, ou `git clone`).
2. Ouvre `index.html` dans ton navigateur (double-clic).

Ou, si tu préfères un petit serveur local :

```bash
python3 -m http.server 4210
```

puis ouvre <http://localhost:4210>.

## Fonctionnement

- **Graine aléatoire à chaque partie** : chaque partie tire une nouvelle graine (affichée en haut à droite, clic pour la copier). Tu peux en saisir une dans l'écran de configuration pour rejouer exactement la même distribution / les mêmes dés.
- **Tour par tour local** : chaque joueur peut être un humain ou un robot. Avec plusieurs humains, un écran « passe l'ordinateur » cache les mains entre deux tours.
- **Règles** : bouton « Règles » en haut de chaque table.

## Structure

```
index.html
css/style.css          thème, table, cartes, dés 3D
js/rng.js              générateur aléatoire à graine (mulberry32)
js/audio.js            effets sonores synthétisés (Web Audio)
js/ui.js               animations de vol, modales, écran de passage
js/cards.js            rendu des cartes (52 cartes + Chroma)
js/seats.js            placement des joueurs, main en éventail
js/games/*.js          un fichier par jeu
js/app.js              menu, configuration, lancement
```

Tout est en HTML/CSS/JavaScript pur. Les cartes et les dés sont dessinés en CSS : aucune image ni ressource tierce.
