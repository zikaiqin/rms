// Set port to match that of back-end server
const port = 5000;

const {method, hostname} = window.location
const root = `${method}://${hostname}:${port}`
