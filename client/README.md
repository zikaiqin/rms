# RMS &ndash; Front-End

RMS uses Node.js to serve front-end assets. See the following sections for instructions on how to run this project locally.



## Dependencies

### Node.js

To run this project locally, you must first [install Node.js](https://nodejs.org/en/download).

### http-server

This project also requires [http-server](https://www.npmjs.com/package/http-server), which is a package for Node.js.
It is automatically installed when you run the project for the first time.



## Starting the server

To start the server, open a terminal in this directory and run the following command:
```
npx http-server -p 3000
```
http-server will automatically reload when changes are made to the files it serves.

To see the changes, you must *hard reload* the page, which is usually done using the <kbd>Ctrl</kbd> + <kbd>F5</kbd> shortcut.
