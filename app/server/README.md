# Serveur back-end

Ce guide vous expliquera la démarche à suivre pour partir le serveur back-end.

## Dépendances

### Python

Il est nécessaire d'installer la version la plus récente de [Python 3.12](https://www.python.org/downloads/) sur votre ordinateur.

### Packages

Le serveur requiert aussi l'installation des packages Python suivants :

- [pyodbc](https://pypi.org/project/pyodbc/)
- [Flask](https://pypi.org/project/Flask/)
- [Flask-Cors](https://pypi.org/project/Flask-Cors/)

## Démarrage

Ouvrez le terminal à cet emplacement et exécutez la commande suivante :

```
flask run
```

Si vous êtes un développeur, faites plutôt :
```
flask run --debug
```

Ceci active le *hot reload*, ce qui redémarre le serveur automatiquement lorsque vous effectuez des modifications aux fichiers source.

## Débogage

Pour faire rouler le serveur en mode débogage, veuillez consulter le guide de débogage pour
[PyCharm](https://www.jetbrains.com/help/pycharm/run-debug-configuration-flask-server.html)
ou
[VSCode](https://code.visualstudio.com/docs/python/tutorial-flask)
selon votre choix de IDE.
