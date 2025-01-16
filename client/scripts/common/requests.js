import $ from 'jquery';

const apiRoot = '/api';

const withAlert = async (jqXHR) => new Promise((resolve, reject) => {
    jqXHR.then((res) => {resolve(res)})
        .catch((err) => {
            const msg = err?.responseJSON?.message;
            window.alert(msg ?? "Une erreur s'est produite");
            reject(err);
        });
});

const API = {
    /** @param {string} url @param {string | JQuery.PlainObject | undefined} params */
    get: (url, params) => withAlert($.get(apiRoot.concat(url), params)),

    /** @param {string} url */
    post: (url, data) => withAlert($.post({ url: apiRoot.concat(url), contentType: 'application/json', data: JSON.stringify(data) })),

    /** @param {string} url */
    put: (url, data) => withAlert($.ajax({ type: 'PUT', url: apiRoot.concat(url), contentType: 'application/json', data: JSON.stringify(data) })),

    /** @param {string} url */
    delete: (url, data) => withAlert($.ajax({ type: 'DELETE', url: apiRoot.concat(url), contentType: 'application/json', data: JSON.stringify(data) })),
};

const Staff = {
    /** @param {string} role */
    listAll: (role) => API.get('/staff', {role}),

    /** @param {string} code */
    get: (code) => API.get(`/staff/${code}`),

    /** @param {string} code */
    delete: (code) => API.delete(`/staff/${code}`),

    add: (data) => API.post('/staff', data),
};

const Sector = {
    all: {
        get: () => API.get('/sector/details'),
    },
    preference: {
        get: (sector) => API.get('/sector/preference', {sector}),
        post: (sector, preferences) => API.post('/sector/preference', {sector, preferences}),
    },
    supervisor: {
        get: () => API.get('/sector/supervisor'),
        post: (sectors) => API.post('/sector/supervisor', {sectors}),
    },
    parcel: {
        get: () => API.get('/parcel'),
        post: (parcels) => API.post('/parcel', {parcels}),
    },

    /** @param {string} name @param {string} supervisor */
    add: (name, supervisor) => API.post('/sector', {name, supervisor}),
};

const Salary = {
    all: {
        get: (date) => API.get('/salary', {date}),
    },
    edit: {
        post: (code, date, salary) => API.post('/salary/edit', {code, date, salary}),
    },
    options: {
        get: (date) => API.get('/salary/options', {date}),
    },
    add: {
        post: (code, date, salary) => API.post('/salary/add', {code, date, salary}),
    },
};

const Schedule = {
    planner: {
        get: (date) => API.get(`/schedule/${date}`),
        post: (data) => API.post('/schedule', {data}),
    },
    staff: {
        options: {
            get: () => API.get('/staff', {role: 'Gardien'}),
        },
        between: {
            get: (code, start, end) => API.get('/schedule/staff', {code, start, end}),
        },
    },
    sector: {
        options: {
            get: () => API.get('/sector'),
        },
        one: {
            get: (date, sector) => API.get('/schedule/sector', {date, sector}),
        },
    },
};

export { Sector, Salary, Schedule, Staff };
