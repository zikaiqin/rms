import $ from 'jquery';
import { addYears, constructNow, differenceInCalendarWeeks, format, parseISO } from 'date-fns'
import { debounce } from 'lodash-es';
import { dateFormatStrings } from '@scripts/common/constants';
import { Schedule } from '@scripts/common/requests';

$(() => {
    rebuildPage();
});

const rebuildPage = () => {
    buildDatePicker();
    buildOptions().then((sector) => {
        const date = $('#date-picker').val();
        Schedule.sector.one.get(date, sector).then(({header, data}) => {
            buildTable(header, data);
            attachListeners();
        });
    });
}

const attachListeners = () => {
    $('#entity-picker').on('change', reloadRows);
    $('#date-picker').on('change', debounce(onDateChange, 200));
    $('#refresh').on('click', reloadRows);
}

const reloadRows = async () => {
    $('#entity-picker, #date-picker, #refresh').prop('inert', true);
    const sector = $('#entity-picker').val();
    const date = $('#date-picker').data('current');
    setEditLink(date);
    return Schedule.sector.one.get(date, sector).then(({header, data}) => {
        buildTable(header, data);
    }).catch(({status}) => {
        if (status === 404) rebuildPage();
    }).finally(() => {
        $('#entity-picker, #date-picker, #refresh').prop('inert', false);
    });
}

const setEditLink = (val) => {
    const edit = $('#edit');
    const date = parseISO(val);
    const noHash = (differenceInCalendarWeeks(date, constructNow(), {weekStartsOn: 1}) <= 0);
    const url = edit.attr('data-href');
    edit.attr('href', noHash ? url : `${url}#${format(date, dateFormatStrings.ISOWeek)}`);
}

const buildDatePicker = () => {
    const now = constructNow();
    const date = format(now, dateFormatStrings.ISO);
    const [min, max] = [-1, 1].map((offset) => format(addYears(now, offset), dateFormatStrings.ISO));
    $('#date-picker').val(date).attr({min, max}).data('current', date);
}

const onDateChange = (e) => {
    const el = $(e.target);
    const valid = e.target.validity.valid;
    if (!valid) {
        el.attr('aria-invalid', true);
    } else {
        el.data('current', el.val());
        if (el.attr('aria-invalid')) {
            el.attr('aria-invalid', false);
        }
        reloadRows().finally(() => {
            el.removeAttr('aria-invalid');
        });
    }
}

const buildOptions = async () => new Promise((resolve, reject) => {
    Schedule.sector.options.get().then((data) => {
        resolve(data[0]);
        const options = data.map((val) => `<option>${val}</option>`);
        $('#entity-picker').append(options)
    }).catch((e) => reject(e))
});

const buildTable = (header, data) => {
    const head = `<tr><th scope="row">Début</th>${
        header.map((pnum) => `<th>Parcelle #${pnum}</th>`)
    }</tr>`;
    const schedule = Object.fromEntries(header.map((pnum) => [pnum, {}]));
    let min = 9, max = 16;
    data.forEach(([time, parcel, code, fname, lname]) => {
        const hour = Number(time.split(':')[0]);
        min = Math.min(min, hour);
        max = Math.max(max, hour);
        schedule[parcel][hour] = [code, fname, lname];
    });
    const hours = Array.from({length: max + 1 - min}, (_, i) => (i + min) % 24);
    const rows = hours.map((hour) => {
        const rowHeader = `<th scope="row">${hour.toString().padStart(2, '0')}:00</th>`;
        const cells = header.map((parcel) => `<td><span class="tag-cell">${buildEmployee(schedule[parcel][hour])}</span></td>`);
        return `<tr>${rowHeader}${cells}</tr>`;
    });
    $('thead').empty().append(head);
    $('tbody').empty().append(rows);
}

const buildEmployee = (employee) => {
    if (!employee || employee.length !== 3) {
        return '<kbd class="secondary">N/A</kbd><i class="muted">Non surveillé</i>';
    }
    const [code, fname, lname] = employee;
    return `<kbd>${code}</kbd>${fname} ${lname}`
}
