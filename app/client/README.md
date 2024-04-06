# Serveur front-end

Ce guide vous expliquera la démarche à suivre pour partir le serveur front-end.

## Dépendances

### Node.js

Il est nécessaire d'installer [Node.js](https://nodejs.org/en/download/) sur votre ordinateur.

### http-server

Le package [http-server](https://www.npmjs.com/package/http-server) sera installé via le terminal lors de la première exécution de la commade de démarrage.

## Démarrage

Ouvrez le terminal à cet emplacement et exécutez la commande suivante :

```
npx http-server -p 3000 -o
```

Si vous êtes un développeur, notez que le serveur est en mode *hot reload* : toute modification aux fichiers sources sera reflétée dans le navigateur une fois que vous rafraîchissez avec <kbd>Ctrl</kbd> + <kbd>F5</kbd>.
