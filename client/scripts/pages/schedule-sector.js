import $ from 'jquery';
import { addYears, constructNow, format, getHours } from 'date-fns'
import { debounce, memoize } from 'lodash-es';
import { dateFormatStrings } from '@scripts/common/constants';
import { Schedule, Sector, Staff } from '@scripts/common/requests';

$(() => {
    rebuildPage();
});

const rebuildPage = () => {
    buildDatePicker();
    Promise.all([buildOptions(), getStaffMap()]).then(([sector, staff]) => {
        const date = $('#date-picker').val();
        Schedule.listForSectorOnDate(sector, date).then((schedule) => {
            buildTable(sector, staff, schedule);
            attachListeners();
        });
    });
};

const getSectors = memoize(Sector.parcel.get);
const getStaffMap = memoize(async () => {
    return Staff.listAll('Gardien').then((data) => {
        return Object.fromEntries(data.map(([code, fname, lname]) => [code, [fname, lname]]));
    });
});

const attachListeners = () => {
    $('#entity-picker').on('change', reloadRows);
    $('#date-picker').on('change', debounce(onDateChange, 200));
    $('#refresh').on('click', reloadRows);
};

const reloadRows = async () => {
    $('#entity-picker, #date-picker, #refresh').prop('inert', true);
    const sector = $('#entity-picker').val();
    const date = $('#date-picker').val();
    setEditLink(date !== $('#date-picker').prop('defaultValue') && date);
    return Promise.all([getStaffMap(), Schedule.listForSectorOnDate(sector, date)]).then(([staff, schedule]) => {
        buildTable(sector, staff, schedule);
    }).catch(({status}) => {
        if (status === 404) rebuildPage();
    }).finally(() => {
        $('#entity-picker, #date-picker, #refresh').prop('inert', false);
    });
};

const setEditLink = (val) => {
    const edit = $('#edit');
    const url = edit.attr('data-href');
    edit.attr('href', val ? `${url}#${val}` : url);
};

const buildDatePicker = () => {
    const now = constructNow();
    const value = format(now, dateFormatStrings.ISO);
    const [min, max] = [-1, 1].map((offset) => format(addYears(now, offset), dateFormatStrings.ISO));
    $('#date-picker').attr({min, max, value});
};

const onDateChange = (e) => {
    const el = $(e.target);
    const valid = e.target.validity.valid;
    if (!valid) {
        el.attr('aria-invalid', true);
    } else {
        if (el.attr('aria-invalid')) {
            el.attr('aria-invalid', false);
        }
        reloadRows().finally(() => {
            el.removeAttr('aria-invalid');
        });
    }
};

const buildOptions = async (setValue) => new Promise((resolve, reject) => {
    getSectors.cache.clear();
    getSectors().then((data) => {
        if (setValue && !(setValue in data)) {
            setValue = null;
        }
        const keys = Object.keys(data);
        resolve(setValue || keys[0]);
        const options = keys.map((val) => `<option>${val}</option>`);
        $('#entity-picker').append(options);
    }).catch((e) => reject(e));
});

const buildTable = async (sector, staff, data) => {
    let parcelMap = await getSectors();
    const parcelSet = new Set(parcelMap[sector]);
    const schedule = Object.fromEntries(parcelMap[sector].map((pnum) => [pnum, {}]));
    let min = 9, max = 16;
    for (const {dtStart, parcelNbr, staffCode} of data) {
        if (!(parcelSet.has(parcelNbr))) {
            sector = await buildOptions(sector);
            return buildTable(sector, staff, data);
        }
        if (!(staffCode in staff)) {
            getStaffMap.cache.clear();
            staff = await getStaffMap();
        }
        const hour = getHours(dtStart);
        min = Math.min(min, hour);
        max = Math.max(max, hour);
        schedule[parcelNbr][hour] = staffCode;
    }
    const hours = Array.from({length: max + 1 - min}, (_, i) => (i + min) % 24);
    const rows = hours.map((hour) => {
        const rowHeader = `<th scope="row">${hour.toString().padStart(2, '0')}:00</th>`;
        const cells = parcelMap[sector].map((parcel) => {
            const staffCode = schedule[parcel][hour];
            return `<td><span class="tag-cell">${buildEmployee(staffCode && [staffCode, ...staff[staffCode]])}</span></td>`;
        });
        return `<tr>${rowHeader}${cells}</tr>`;
    });
    const head = `<tr><th scope="row">Début</th>${
        parcelMap[sector].map((pnum) => `<th>Parcelle #${pnum}</th>`)
    }</tr>`;
    $('thead').empty().append(head);
    $('tbody').empty().append(rows);
};

const buildEmployee = (employee) => {
    if (!employee || employee.length !== 3) {
        return '<kbd class="secondary">N/A</kbd><i class="muted">Non surveillé</i>';
    }
    const [code, fname, lname] = employee;
    return `<kbd>${code}</kbd>${fname} ${lname}`
};
