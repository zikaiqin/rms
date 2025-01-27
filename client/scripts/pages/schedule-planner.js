import $ from 'jquery';
import { addHours, addYears, constructNow, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { debounce, memoize, noop } from 'lodash-es';
import { dateFormatStrings } from '@scripts/common/constants';
import { Schedule, Sector, Staff } from '@scripts/common/requests';
import { Modal } from '@scripts/common/components';

$(() => {
    new Modal('#change-modal', {
        onClose: function() {
            $('#date-picker').val($('#date-picker').attr('data-prev')).removeAttr('aria-invalid');
        },
    });
    buildDatePicker();
    buildTable().then(() => {
        attachListeners();
    });
});

const buildTable = async (options = { refreshOptions: false, refreshSectors: false }) => {
    $('#reset, #save').prop('disabled', true);
    const table = $('#planner').off('change');
    const date = $('#date-picker').val();
    if (options.refreshOptions) {
        getStaff.cache.clear();
    }
    if (options.refreshSectors) {
        getSectors.cache.clear();
    }
    return Promise.all([getStaff(), getSectors(), Schedule.listOnDate(date)]).then(([staff, sectors, data]) => {
        const header = buildTableHeader(sectors);
        const [schedule, body] = buildTableBody(staff, sectors, data);
        table.empty().append(header, body).data('default-schedule', schedule);
        setRowScheduleData();
        table.on('change', onScheduleChange);
    });
};

const getSectors = memoize(Sector.parcel.get);
const getStaff = memoize(() => Staff.listAll('Gardien'));

const attachListeners = () => {
    $('#date-picker').on('change', debounce(onDateChange, 200));
    $('#reset').on('click', onReset);
    $('#save').on('click', onSave);
    $('#confirm-change').on('click', onConfirmChange);
};

const buildDatePicker = () => {
    const now = constructNow();
    const [min, max] = [-1, 1].map((offset) => addYears(now, offset));
    const hashDate = window.location.hash && parseISO(window.location.hash.slice(1));
    const value = format(hashDate ? clampDate(hashDate, min, max) : now, dateFormatStrings.ISO);
    const values = {
        min: format(min, dateFormatStrings.ISO),
        max: format(max, dateFormatStrings.ISO),
        value,
        'data-prev': value,
    };
    $('#date-picker').attr(values);
};

const onDateChange = (e) => {
    const el = $(e.target);
    const valid = e.target.validity.valid;
    if (!valid) {
        el.attr('aria-invalid', true);
        return;
    }
    if (el.attr('aria-invalid')) {
        el.attr('aria-invalid', false);
    }
    if (!$('#reset').attr('disabled')) {
        Modal.get('#change-modal').open();
        return;
    }
    onConfirmChange();
};

const onConfirmChange = () => {
    const el = $('#date-picker')
    el.attr('data-prev', el.val());
    if (Modal.visible.length) {
        Modal.get('#change-modal').close(noop);
    }
    buildTable().finally(() => {
        el.removeAttr('aria-invalid');
    });
};

const onScheduleChange = function(e) {
    const select = $(e.target);
    const row = select.closest('tr');
    const schedule = row.data('schedule');
    const parcel = select.parent().data('parcel');
    const newVal = select.val();
    const oldVal = schedule.parcelMap[parcel];
    schedule.parcelMap[parcel] = newVal;

    // set select title
    if (newVal) {
        const name = select.find(`option[value="${newVal}"]`).attr('title').replace(/\s+\(Valeur initiale\)$/, '');
        select.attr('title', name);
    } else {
        select.removeAttr('title');
    }

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
};

const onReset = () => {
    const touched = $('#planner select:is(.modified, [aria-invalid])');
    touched.each(function() {
        const select = $(this);
        select.removeAttr('aria-invalid').removeClass('modified').val(select.find('[selected]').val());
    });
    $('#planner .blocked').removeAttr('class');
    setRowScheduleData();
    $('#reset, #save').prop('disabled', true);
};

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
            return { staffCode: code, parcelNbr: parcel, dtStart: time };
        });
    });
    Schedule.edit(modified).then(() => {
        buildTable();
    }).catch((err) => {
        const matches = err.responseJSON.message.match(/code|parcelle/);
        if (matches) {
            const options = { [matches[0] === 'code' ? 'refreshOptions' : 'refreshSectors']: true }
            buildTable(options);
        }
    });
};

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
};

const buildTableHeader = (data) => {
    const sectors = ['<th scope="row" rowspan="2" class="spacer-cell">'];
    const parcels = [];
    const columns = ['<colgroup><col /></colgroup>'];
    Object.entries(data).forEach(([sector, ps]) => {
        columns.push(`<colgroup>${'<col />'.repeat(ps.length)}</colgroup>`);
        sectors.push(`<th scope="col" colspan="${ps.length}">${sector}</th>`);
        parcels.push(...ps.map((num) => `<th scope="col">#${num}</th>`));
    });
    return `${columns.join('')}<thead><tr>${sectors.join('')}</tr><tr>${parcels.join('')}</tr></thead>`;
};

const buildTableBody = (staff, sectors, data) => {
    let min = 9, max = 16;
    const parcels = Object.values(sectors).flat();
    const schedule = {};
    data.forEach(({dtStart, parcelNbr, staffCode}) => {
        const hour = parseISO(dtStart).getHours();
        min = Math.min(min, hour);
        max = Math.max(max, hour);
        if (!(hour in schedule)) {
            schedule[hour] = Object.fromEntries(parcels.map(p => [p, '']));
        }
        schedule[hour][parcelNbr] = staffCode;
    });
    const hours = Array.from({ length: max + 1 - min }, (_, i) => {
        const hour = (i + min) % 24
        if (!(hour in schedule)) {
            schedule[hour] = Object.fromEntries(parcels.map(p => [p, '']));
        }
        return hour;
    });
    const select = buildSelect(staff);
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
    const title = code && options.find(([c]) => c === code).slice(1).join(' ');
    const select = `<select ${title ? `title="${title}"` : ''}>\
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
