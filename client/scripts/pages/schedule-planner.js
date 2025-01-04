import $ from 'jquery';
import { addYears, constructNow, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { debounce } from 'lodash-es';
import { dateFormatStrings } from '@scripts/common/constants';
import { Schedule } from '@scripts/common/requests';

$(() => {
    buildDatePicker();
    buildTable().then(() => {
        attachListeners();
    });
})

const buildTable = async () => {
    const table = $('#planner');
    const date = $('#date-picker').val();
    return Schedule.all.get(date).then((data) => {
        const header = buildTableHeader(data);
        const body = buildTableBody(data);
        table.empty().append(header, body);
    });
}

const attachListeners = () => {
    $('#date-picker').on('change', debounce(onDateChange, 200));
}

const buildDatePicker = () => {
    const now = constructNow();
    const [min, max] = [-1, 1].map((offset) => addYears(now, offset));
    const hashDate = window.location.hash && parseISO(window.location.hash.slice(1));
    const value = format(hashDate ? clampDate(hashDate, min, max) : now, dateFormatStrings.ISO);
    const values = {
        min: format(min, dateFormatStrings.ISO),
        max: format(max, dateFormatStrings.ISO),
        value,
    };
    $('#date-picker').attr(values);
}

const onDateChange = (e) => {
    const el = $(e.target);
    const valid = e.target.validity.valid;
    if (!valid) {
        el.attr('aria-invalid', true);
    } else {
        if (el.attr('aria-invalid')) {
            el.attr('aria-invalid', false);
        }
        buildTable().finally(() => {
            el.removeAttr('aria-invalid');
        });
    }
}

const buildTableHeader = (data) => {
    const sectors = ['<th scope="row" rowspan="2" class="spacer-cell">'];
    const parcels = [];
    const columns = ['<colgroup><col /></colgroup>'];
    Object.entries(data).forEach(([s, rest]) => {
        const p = Object.keys(rest);
        const length = p.length;
        columns.push(`<colgroup>${'<col />'.repeat(length)}</colgroup>`);
        sectors.push(`<th scope="col" colspan="${length}">${s}</th>`);
        parcels.push(...p.map((num) => `<th scope="col">#${num}</th>`));
    });
    return `${columns.join('')}<thead><tr>${sectors.join('')}</tr><tr>${parcels.join('')}</tr></thead>`;
};

const buildTableBody = (data) => {
    let min = 9, max = 16;
    const parcels = Object.values(data).flatMap(o => Object.keys(o));
    const schedule = Object.fromEntries(parcels.map(p => [p, {}]));
    Object.values(data).flatMap(
        (sector) => Object.entries(sector)
    ).forEach(([parcel, timeslots]) => {
        timeslots.forEach(([time, code]) => {
            const hour = Number(time.split(':')[0]);
            min = Math.min(min, hour);
            max = Math.max(max, hour);
            schedule[parcel][hour] = code;
        });
    });
    const hours = Array.from({length: max + 1 - min}, (_, i) => (i + min) % 24);
    const rows = hours.map((hour) => {
        const rowHeader = `<th scope="row">${hour.toString().padStart(2, '0')}:00</th>`;
        const cells = parcels.map(
            (parcel) => `<td><span class="tag-cell">${buildTag(schedule[parcel][hour])}</span></td>`
        );
        return `<tr>${rowHeader}${cells}</tr>`;
    });
    return `<tbody>${rows}</tbody>`;
};

const buildTag = (code) => (
    code ? `<kbd>${code}</kbd>` : '<kbd class="secondary">N/A</kbd>'
);

/** @type {(date: Date, min: Date, max: Date) => Date} */
const clampDate = (date, min, max) => {
    if (differenceInCalendarDays(date, min) < 0) {
        return min;
    }
    if (differenceInCalendarDays(date, max) > 0) {
        return max;
    }
    return date;
};
