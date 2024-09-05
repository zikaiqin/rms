# RMS &ndash; Back-End

RMS uses Python and Flask for its back-end. See the following sections for instructions on how to run this project locally.



## Dependencies

### Python

To run this project locally, you must [install Python 3.12](https://www.python.org/downloads/).

### Packages

The following Python packages are also required for this project:

- [pyodbc](https://pypi.org/project/pyodbc/)
- [Flask](https://pypi.org/project/Flask/)
- [Flask-Cors](https://pypi.org/project/Flask-Cors/)

The easiest way to install a package is by running the following command in the terminal:
```
pip install <package-name>
```



## Starting the server

To start the server, open a terminal in this directory and run the following command:
```
flask run --debug
```
The server will start listening on `localhost:5000`.
The optional `--debug` flag allows Flask to automatically reload when changes to the code are detected.

All routes are documented in the `ROUTES.md` file.



## Debugging the server

There are many ways of [debugging a Flask application](https://flask.palletsprojects.com/en/3.0.x/debugging/).
Some popular IDEs for instance include built-in tools for that very purpose.

Check out the guides for debugging Flask using
[PyCharm](https://www.jetbrains.com/help/pycharm/run-debug-configuration-flask-server.html)
or
[VSCode](https://code.visualstudio.com/docs/python/tutorial-flask).
