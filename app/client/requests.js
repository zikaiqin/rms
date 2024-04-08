// Set port to match that of back-end server
const port = 5000;

const {protocol, hostname} = window.location
const apiRoot = `${protocol}//${hostname}:${port}`

class Route {
    /**
     * @param {JQuery.jqXHR} jqXHR
     */
    static withAlert = async (jqXHR) => {
        return new Promise((resolve, reject) => {
            jqXHR.then((res) => {resolve(res)})
                .catch((err) => {
                    const msg = err?.responseJSON?.message;
                    window.alert(msg ?? 'Une erreur s\'est produite');
                    reject(err);
                });
        });
    }

    static get staff() {
        return {

            all: {
                get: () => Route.withAlert(jQuery.get(apiRoot.concat('/staff')))
            },

            details: {
                get: (code) => Route.withAlert(jQuery.get(apiRoot.concat('/staff/details?code=', code)))
            },

            delete: {
                post: (code) => Route.withAlert(jQuery.post(apiRoot.concat('/staff/delete'), {code}))
            },

            add: {
                post: (data) => Route.withAlert(jQuery.post(apiRoot.concat('/staff/add'), data))
            },
        }
    }

    static get sector() {
        return {

            all: {
                get: () => Route.withAlert(jQuery.get(apiRoot.concat('/sector')))
            },
        }
    }
}
