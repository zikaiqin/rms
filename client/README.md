# RMS &ndash; Front-End

RMS uses Vite to build front-end assets. Continue reading to find out how you can run this project in development mode.



## Dependencies

### Node.js

[Node.js](https://nodejs.org/en/download) is required to run the project locally. Make sure it is installed on your machine.

### Packages

This project also requires a few packages.
Open a terminal in this directory and run the following command:

```
npm ci
```



## Development Server

To start the server, run the following command:

```
npm run dev
```

This starts a Vite development server which automatically reloads when changes to the code are detected.
Access the app at the following address:

```
http://localhost:3000
```

You must also [start the back-end server](../server/README.md#development-server) for the app to work properly.
