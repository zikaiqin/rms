# Serveur front-end

Ce guide vous expliquera la démarche à suivre pour partir le serveur front-end.

## Dépendances

### Node.js

Il est nécessaire d'installer [Node.js](https://nodejs.org/en/download/) sur votre ordinateur.

### http-server

Le package [http-server](https://www.npmjs.com/package/http-server) sera installé via le terminal lors de la première exécution de la commade de démarrage.

## Démarrage

Ouvrez le terminal à cet emplacement et faites rouler la commande suivante :

```
npx http-server -p 3000 -o
```

Notez que le serveur implémente le *hot reload* : tout changement aux fichiers sera reflété dans le navigateur suite à un *refresh*.
