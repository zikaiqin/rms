// Set port to match that of back-end server
const port = 5000;

const {protocol, hostname} = window.location
const apiRoot = `${protocol}//${hostname}:${port}`

class Route {
    static get staff() {
        return class {

            static get all() {
                return {
                    get: () => jQuery.get(apiRoot.concat('/staff'))
                }
            }

            static get details() {
                return {
                    get: (code) => jQuery.get(apiRoot.concat('/staff/details?code=', code))
                }
            }
        }
    }
}
