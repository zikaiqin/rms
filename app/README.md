# Guide d'utilisation de l'application

## Structure de l'application

L'application a été conçue en deux parties: 

- Le serveur *front-end* qui distribue les fichiers HTML, CSS et JS de l'application. Ses fichiers se trouvent dans le répertoire `/client`.
- Le serveur *back-end* qui répond aux requêtes HTTP lancées par l'application. Ses fichiers se trouvent dans le répertoire `/server`.

Le serveur *back-end* fonctionne indépendemment du serveur *front-end*, mais le bon fonctionnement de l'application dans son ensemble requiert que les deux serveurs soient en train de rouler simultanément.

## Initialisation de l'application

Il est tout d'abord nécessaire d'exécuter les scripts dans le répertoire `../sql` afin que la base de données soit initialisée et remplie avec des données avec lequelles travailler.

Si vous ne l'avez pas déjà fait, **faites-le.**

Pour accéder à l'application, vous devez par la suite démarrer les deux serveurs en suivant les guides fournis dans leurs répertoires respectifs.
