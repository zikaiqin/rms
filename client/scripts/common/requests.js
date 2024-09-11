import $ from 'jquery';

// Set port to match that of back-end server
const port = 5000;

const {protocol, hostname} = window.location
const apiRoot = `${protocol}//${hostname}:${port}`

const withAlert = async (jqXHR) => {
    return new Promise((resolve, reject) => {
        jqXHR.then((res) => {resolve(res)})
            .catch((err) => {
                const msg = err?.responseJSON?.message;
                window.alert(msg ?? 'Une erreur s\'est produite');
                reject(err);
            });
    });
};

const Staff = {
    all: {
        get: (role) => withAlert($.get(apiRoot.concat('/staff'), {role})),
    },
    details: {
        get: (code) => withAlert($.get(apiRoot.concat('/staff/details'), {code})),
    },
    delete: {
        post: (code) => withAlert($.post(apiRoot.concat('/staff/delete'), {code})),
    },
    add: {
        post: (data) => withAlert($.post(apiRoot.concat('/staff/add'), data)),
    },
};

const Sector = {
    all: {
        get: () => withAlert($.get(apiRoot.concat('/sector'))),
    },
    preferences: {
        get: (sector) => withAlert($.get(apiRoot.concat('/preferences'), {sector})),
        post: (sector, preferences) => withAlert($.ajax({
            url:apiRoot.concat('/preferences'),
            type: 'post',
            contentType: 'application/json',
            data: JSON.stringify({sector, preferences}),
        })),
    },
    supervisor: {
        get: () => withAlert($.get(apiRoot.concat('/sector/supervisor'))),
        post: (sectors) => withAlert($.ajax({
            url:apiRoot.concat('/sector/supervisor'),
            type: 'post',
            contentType: 'application/json',
            data: JSON.stringify(sectors),
        })),
    },
};

const Salary = {
    all: {
        get: (date) => withAlert($.get(apiRoot.concat('/salary'), {date})),
    },
    edit: {
        post: (code, date, salary) => withAlert($.post(apiRoot.concat('/salary/edit'), {code, date, salary})),
    },
    options: {
        get: (date) => withAlert($.get(apiRoot.concat('/salary/options'), {date})),
    },
    add: {
        post: (code, date, salary) => withAlert($.post(apiRoot.concat('/salary/add'), {code, date, salary})),
    },
};

const Schedule = {
    staff: {
        options: {
            get: () => withAlert($.get(apiRoot.concat('/staff'), {role: 'Gardien'})),
        },
        between: {
            get: (code, start, end) => withAlert($.get(apiRoot.concat('/schedule/staff'), {code, start, end})),
        },
    },
    sector: {
        options: {
            get: () => withAlert($.get(apiRoot.concat('/schedule/sector/options'))),
        },
        one: {
            get: (date, sector) => withAlert($.get(apiRoot.concat('/schedule/sector'), {date, sector})),
        },
    },
};

export { Staff, Sector, Salary, Schedule };
