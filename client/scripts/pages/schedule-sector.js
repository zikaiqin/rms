import $ from 'jquery';
import { debounce } from 'lodash-es';
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
    $('#date-picker').on('change', debounce(onDateChange.bind({ prev: $('#date-picker').val() }), 200));
    $('#refresh').on('click', reloadRows);
}

const reloadRows = async () => {
    $('#entity-picker, #date-picker, #refresh').css('pointer-events', 'none');
    const sector = $('#entity-picker').val();
    const date = $('#date-picker').val();
    return Schedule.sector.one.get(date, sector).then(({header, data}) => {
        buildTable(header, data);
    }).catch(({status}) => {
        if (status === 404) rebuildPage();
    }).finally(() => {
        $('#entity-picker, #date-picker, #refresh').css('pointer-events', '');
    });
}

const buildDatePicker = () => {
    const date = new Date().toISOString().split('T')[0];
    const year = Number(date.split('-')[0]);
    const [min, max] = [-1, 1].map((offset) => date.split('-').with(0, year + offset).join('-'));
    $('#date-picker').val(date).attr({min, max});
}

const onDateChange = (e) => {
    const el = $(e.target);
    const valid = e.target.validity.valid;
    if (!valid) {
        el.attr('aria-invalid', !valid);
    } else {
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
    const head = `<tr><th>Début</th>${
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
