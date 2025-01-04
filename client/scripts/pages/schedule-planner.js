import $ from 'jquery';
import { addYears, constructNow, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { debounce, memoize } from 'lodash-es';
import { dateFormatStrings } from '@scripts/common/constants';
import { Schedule } from '@scripts/common/requests';

$(() => {
    buildDatePicker();
    buildTable().then(() => {
        attachListeners();
    });
})

const buildTable = async () => {
    $('#reset, #save').prop('disabled', true);
    const table = $('#planner').off('change');
    const date = $('#date-picker').val();
    return Promise.all([getOptions(), Schedule.all.get(date)]).then(([options, data]) => {
        const header = buildTableHeader(data);
        const body = buildTableBody(options, data);
        table.empty().append(header, body).data('mod-count', 0).on('change', onScheduleChange);
    });
}

const getOptions = async () => {
    let options = $('#planner').data('options');
    if (options) {
        return options;
    } else {
        options = await Schedule.staff.options.get();
        $('#planner').data('options', options);
        return options;
    }
};

const attachListeners = () => {
    $('#date-picker').on('change', debounce(onDateChange, 200));
    $('#reset').on('click', onReset);
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

// TODO: Assert one assignment per hour
const onScheduleChange = function(e) {
    const select = $(e.target);
    const option = select.find(`option[value="${select.val()}"]`);
    if (option.is('[selected]')) {
        select.removeClass('modified deleted');
        $(this).data('mod-count', $(this).data('mod-count') - 1);
    } else {
        if (!($(this).hasClass('modified') || $(this).hasClass('deleted'))) {
            $(this).data('mod-count', $(this).data('mod-count') + 1);
        }
        if (option.is('[data-none]')) {
            select.removeClass('modified');
            select.addClass('deleted');
        } else {
            select.removeClass('deleted');
            select.addClass('modified');
        }
    }
    const modCount = $(this).data('mod-count');
    $('#reset, #save').prop('disabled', modCount <= 0);
}

const onReset = () => {
    const modified = $('#planner select:is(.deleted, .modified)');
    modified.each(function() {
        const select = $(this);
        select.val(select.find('[selected]').val());
        select.removeClass('modified deleted');
    });
    $('#planner').data('mod-count', 0);
    $('#reset, #save').prop('disabled', true);
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

const buildTableBody = (options, data) => {
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
    const select = buildSelect(options)
    const rows = hours.map((hour) => {
        const rowHeader = `<th scope="row">${hour.toString().padStart(2, '0')}:00</th>`;
        const cells = parcels.map(
            (parcel) => `<td data-parcel="${parcel}">${select(schedule[parcel][hour])}</td>`
        );
        return `<tr>${rowHeader}${cells}</tr>`;
    });
    return `<tbody>${rows}</tbody>`;
};

const buildSelect = (options) => memoize((code) => {
    const select = `<select><option value="" data-none ${code ? '' : 'selected'}>---</option>${options.map(([c]) => `<option value="${c}" ${c === code ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
    return select;
});

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
