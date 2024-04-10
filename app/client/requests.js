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
                get: () => Route.withAlert($.get(apiRoot.concat('/staff')))
            },

            details: {
                get: (code) => Route.withAlert($.get(apiRoot.concat('/staff/details'), {code}))
            },

            delete: {
                post: (code) => Route.withAlert($.post(apiRoot.concat('/staff/delete'), {code}))
            },

            add: {
                post: (data) => Route.withAlert($.post(apiRoot.concat('/staff/add'), data))
            },
        }
    }

    static get sector() {
        return {

            all: {
                get: () => Route.withAlert($.get(apiRoot.concat('/sector')))
            },
        }
    }

    static get salary() {
        return {

            all: {
                get: (date) => Route.withAlert($.get(apiRoot.concat('/salary'), {date}))
            },

            edit: {
                post: (code, date, salary) => Route.withAlert($.post(apiRoot.concat('/salary/edit'), {code, date, salary}))
            },

            add: {
                get: (date) => Route.withAlert($.get(apiRoot.concat('/salary/add'), {date})),

                post: (code, date, salary) => Route.withAlert($.post(apiRoot.concat('/salary/add'), {code, date, salary}))
            },
        }
    }

    static get schedule() {
        return {

            staff: {
                options: {
                    get: () => Route.withAlert($.get(apiRoot.concat('/schedule/staff/options')))
                },

                between: {
                    get: (code, start, end) => Route.withAlert($.get(apiRoot.concat('/schedule/staff'), {code, start, end}))
                },
            },

            sector: {
                options: {
                    get: () => Route.withAlert($.get(apiRoot.concat('/schedule/sector/options')))
                },

                one: {
                    get: (date, sector) => Route.withAlert($.get(apiRoot.concat('/schedule/sector'), {date, sector}))
                },
            },
        }
    }
}
