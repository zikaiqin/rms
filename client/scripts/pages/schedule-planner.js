import $ from 'jquery';
import { addHours, addYears, constructNow, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { debounce, memoize } from 'lodash-es';
import { dateFormatStrings } from '@scripts/common/constants';
import { Schedule } from '@scripts/common/requests';

$(() => {
    buildDatePicker();
    buildTable().then(() => {
        attachListeners();
    });
})

const buildTable = async (refreshOptions = false) => {
    $('#reset, #save').prop('disabled', true);
    const table = $('#planner').off('change');
    const date = $('#date-picker').val();
    return Promise.all([getOptions(refreshOptions), Schedule.planner.get(date)]).then(([options, data]) => {
        const header = buildTableHeader(data);
        const [schedule, body] = buildTableBody(options, data);
        table.empty().append(header, body).data('default-schedule', schedule);
        setRowScheduleData();
        table.on('change', onScheduleChange);
    });
}

const getOptions = async (purge = false) => {
    let options;
    if (!purge && (options = $('#planner').data('options'))) {
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
    $('#save').on('click', onSave);
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

const onScheduleChange = function(e) {
    const select = $(e.target);
    const row = select.closest('tr');
    const schedule = row.data('schedule');
    const parcel = select.parent().data('parcel');
    const newVal = select.val();
    const oldVal = schedule.parcelMap[parcel];
    schedule.parcelMap[parcel] = newVal;

    // if previously invalid, remove invalid style and check if rest of row is valid
    if (oldVal) {
        const set = schedule.staffMap[oldVal];
        set.delete(parcel);
        select.removeAttr('aria-invalid');
        switch (set.size) {
            case 0:
                row.find(`option[value="${oldVal}"]`).removeAttr('class');
                break;
            case 1:
                row.find(`td[data-parcel="${Array.from(set)[0]}"] select`).removeAttr('aria-invalid');
        }
    }

    // if assigning a staff, check if staff isn't already assigned
    if (newVal) {
        if (schedule.staffMap[newVal]) {
            const set = schedule.staffMap[newVal];
            let errCells;
            switch (set.size) {
                case 0:
                    set.add(parcel);
                    row.find(`option[value="${newVal}"]`).addClass('blocked');
                    break;
                case 1:
                    errCells = row.find(`td[data-parcel="${Array.from(set)[0]}"] select`).add(select);
                default:
                    (errCells ?? select).attr('aria-invalid', true);
                    set.add(parcel);
            }
        } else {
            schedule.staffMap[newVal] = new Set([parcel]);
            row.find(`option[value="${newVal}"]`).addClass('blocked');
        }
    }

    const option = select.find(`option[value="${newVal}"]`);
    if (option.is('[selected]')) {
        select.removeClass('modified');
    } else {
        select.addClass('modified');
    }
    const unmodified = $(this).has('.modified').length <= 0;
    const invalid = $(this).has('[aria-invalid]').length > 0;
    $('#reset').prop('disabled', unmodified);
    $('#save').prop('disabled', unmodified || invalid);
}

const onReset = () => {
    const touched = $('#planner select:is(.modified, [aria-invalid])');
    touched.each(function() {
        const select = $(this);
        select.removeAttr('aria-invalid').removeClass('modified').val(select.find('[selected]').val());
    });
    $('#planner .blocked').removeAttr('class');
    setRowScheduleData();
    $('#reset, #save').prop('disabled', true);
}

const onSave = () => {
    const date = parseISO($('#date-picker').val());
    const modified = $('#planner tr:has(select.modified)').toArray().flatMap((el) => {
        const row = $(el);
        const hour = row.data('hour');
        const time = format(addHours(date, hour), dateFormatStrings.ISODateTime);
        return row.find('select.modified').toArray().map((sel) => {
            const select = $(sel);
            const code = select.val() || null;
            const parcel = select.parent().data('parcel');
            return { code, parcel, time };
        });
    });
    Schedule.planner.post(modified).then(() => {
        buildTable();
    }).catch((err) => {
        const matches = err.responseJSON.message.match(/code|parcelle/);
        if (matches) {
            buildTable(matches[0] === 'code');
        }
    });
}

const setRowScheduleData = () => {
    const table = $('#planner');
    const schedule = table.data('default-schedule');
    table.find('tbody tr').each(function() {
        const row = $(this);
        const time = row.data('hour');
        const staffMap = Object.fromEntries(Object.entries(schedule[time]).reduce(
            (acc, [k, v]) => {
                if (v) {
                    acc.push([v, new Set([Number(k)])]);
                    row.find(`option[value="${v}"]`).addClass('blocked');
                };
                return acc;
            },
            [],
        ));
        // clone schedule slice so that default-schedule remains constant
        row.data('schedule', { parcelMap: {...schedule[time]}, staffMap });
    });
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
    const schedule = {};
    Object.values(data).flatMap(
        (sector) => Object.entries(sector)
    ).forEach(([parcel, timeslots]) => {
        timeslots.forEach(([time, code]) => {
            const hour = Number(time.split(':')[0]);
            min = Math.min(min, hour);
            max = Math.max(max, hour);
            if (!(hour in schedule)) {
                schedule[hour] = Object.fromEntries(parcels.map(p => [p, '']));
            }
            schedule[hour][parcel] = code;
        });
    });
    const hours = Array.from({ length: max + 1 - min }, (_, i) => {
        const hour = (i + min) % 24
        if (!(hour in schedule)) {
            schedule[hour] = Object.fromEntries(parcels.map(p => [p, '']));
        }
        return hour;
    });
    const select = buildSelect(options);
    const rows = hours.map((hour) => {
        const rowHeader = `<th scope="row">${hour.toString().padStart(2, '0')}:00</th>`;
        const cells = parcels.map((parcel) => {
            const code = schedule[hour][parcel];
            return `<td data-parcel="${parcel}">${select(code)}</td>`;
        });
        return `<tr data-hour="${hour}">${rowHeader}${cells}</tr>`;
    });
    return [schedule, `<tbody>${rows}</tbody>`];
};

const buildSelect = (options) => memoize((code) => {
    const select = `<select>\
        <option value="" title="Non surveillé" data-none ${code ? '' : 'selected'}>---</option>\
        ${options.map(([c, fname, lname]) => {
            const match = c === code;
            return `<option value="${c}" title="${fname} ${lname}${match ? ' (Valeur initiale)' : ''}" ${match ? 'selected' : ''}>${c}</option>`;
        }).join('')}\
    </select>`;
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
