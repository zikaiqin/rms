import $ from 'jquery';

const {protocol, hostname} = window.location;
const apiURL = `${protocol}//${hostname}${__API_ROOT__}`;

const withAlert = async (jqXHR) => new Promise((resolve, reject) => {
    jqXHR.then((res) => {resolve(res)})
        .catch((err) => {
            const msg = err?.responseJSON?.message;
            window.alert(msg ?? 'Une erreur s\'est produite');
            reject(err);
        });
}); 

const API = new Proxy((({get, post}) => ({get, post}))($), {
    get(target, prop) {
        return (first, ...rest) => {
            if (typeof first === 'string') {
                first = apiURL.concat(first);
            } else if ('url' in first) {
                first.url = apiURL.concat(first.url);
            }
            return withAlert(target[prop](first, ...rest));
        };
    },
});

const Staff = {
    all: {
        get: (role) => API.get('/staff', {role}),
    },
    details: {
        get: (code) => API.get('/staff/details', {code}),
    },
    delete: {
        post: (code) => API.post('/staff/delete', {code}),
    },
    add: {
        post: (data) => API.post('/staff/add', data),
    },
};

const Sector = {
    all: {
        get: () => API.get('/sector/details'),
    },
    preference: {
        get: (sector) => API.get('/sector/preference', {sector}),
        post: (sector, preferences) => API.post({
            url: '/sector/preference',
            contentType: 'application/json',
            data: JSON.stringify({sector, preferences}),
        }),
    },
    supervisor: {
        get: () => API.get('/sector/supervisor'),
        post: (sectors) => API.post({
            url: '/sector/supervisor',
            contentType: 'application/json',
            data: JSON.stringify(sectors),
        }),
    },
    parcel: {
        get: () => API.get('/parcel'),
        post: (parcels) => API.post({
            url: '/parcel',
            contentType: 'application/json',
            data: JSON.stringify(parcels),
        }),
    },
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

export { Staff, Sector, Salary, Schedule };
