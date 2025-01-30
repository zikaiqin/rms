# RMS &ndash; Back-End

RMS uses Python and Flask for its back-end. Continue reading to find out how you can run this project in development mode.



## Dependencies

### Python

[Python 3.13](https://www.python.org/downloads/) is required to run the project locally. Make sure it is installed on your machine.

### Packages

This project also requires a few packages.
It is recommended that you [create a virtual environment](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/) and install them there.
Once your virtual environment is active, run the following command in the terminal:

```
pip install -r requirements.txt
```



## Development server

To start the development server, open a terminal in this directory and run the following command:

```
flask run --debug
```

The `--debug` flag is optional and allows Flask to automatically reload when changes to the code are detected.

You can access Flask directly at the following address:

```
http://localhost:5000
```

Note that if the [front-end development server](../client/README.md#development-server) is running, you can also access the back-end at the following address:

```
<front-end root address>/api
```

API endpoints are documented in the [`ROUTES.md`](./ROUTES.md) file.



## Debugging

Some IDEs have built-in tools for [debugging a Flask application](https://flask.palletsprojects.com/en/3.0.x/debugging/).

Check out the guides for debugging Flask using
[PyCharm](https://www.jetbrains.com/help/pycharm/run-debug-configuration-flask-server.html)
or
[VSCode](https://code.visualstudio.com/docs/python/tutorial-flask).
