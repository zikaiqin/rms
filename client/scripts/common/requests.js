import { addDays, format, parseISO } from 'date-fns';
import $ from 'jquery';
import { dateFormatStrings } from './constants';

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
        get: () => API.get('/supervisor'),
        post: (sectors) => API.post('/supervisor', sectors),
    },
    parcel: {
        get: () => API.get('/parcel'),
        post: (parcels) => API.post('/parcel', parcels),
    },

    /** @param {string} name @param {string} supervisor */
    add: (name, supervisor) => API.post('/sector', {name, supervisor}),

    /** @param {string} name @param {Array<{parcel: number, sector: string}> | undefined} transfer */
    delete: (name, transfer) => API.delete(`/sector/${name}`, transfer),
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
    /** @param {Array<{dtStart: string, parcelNbr: number, staffCode: string}>} data */
    edit: (data) => API.post('/schedule', data),

    /** @param {string} date */
    listOnDate: (date) => API.get('/schedule', {
        start: date,
        end: format(addDays(parseISO(date), 1), dateFormatStrings.ISO),
    }),

    /** @param {string} code @param {string} start @param {string} end */
    listForStaffBetween: (code, start, end) => API.get('/schedule' , {start, end, staffCode: code}),

    /** @param {string} name @param {string} date */
    listForSectorOnDate: (name, date) => API.get('/schedule', {
        start: date,
        end: format(addDays(parseISO(date), 1), dateFormatStrings.ISO),
        sectorName: name,
    }),
};

export { Sector, Salary, Schedule, Staff };
