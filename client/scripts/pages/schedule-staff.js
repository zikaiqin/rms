import $ from 'jquery';
import { addDays, addWeeks, addYears, constructNow, differenceInCalendarWeeks, format, parseISO } from 'date-fns'
import { debounce } from 'lodash-es';
import { dateFormatStrings } from '@scripts/common/constants';
import { Schedule } from '@scripts/common/requests';
import { DatePicker, TagPicker } from '@scripts/common/components';

const pickerType = 'week';
const pickerSettings = {
    title: {
        prev: 'Semaine précédente',
        next: 'Semaine prochaine',
    },
    required: true,
};

$(() => {
    buildPage();
});

const buildPage = (rebuild = false) => {
    if (!rebuild) {
        buildDatePicker();
    }
    buildOptions().then((code) => {
        const [start, end] = getWeekAsInterval();
        Schedule.staff.between.get(code, start, end).then((data) => {
            buildTable(data, start);
            if (!rebuild) {
                attachListeners();
            }
        });
    });
};

const attachListeners = () => {
    $('#refresh').on('click', reloadRows);
    $('#entity-picker').on('picker.change', reloadRows);
    $('#date-picker').on('picker.input', onDateInput).on('picker.change', onDateChange);
}

const buildDatePicker = () => {
    const now = constructNow();
    const val = format(now, dateFormatStrings.ISOWeek)
    const values = {
        min: format(addYears(now, -1), dateFormatStrings.ISOWeek),
        max: format(addYears(now, 1), dateFormatStrings.ISOWeek),
        init: val,
    };
    const picker = new DatePicker('#date-picker', pickerType, { values, ...pickerSettings });
    $('#date-picker').data('picker', picker).data('oldval', val);
};

const buildOptions = async () => new Promise((resolve, reject) => {
    Schedule.staff.options.get().then((data) => {
        resolve(data[0][0]);
        new TagPicker(
            data.map(([code, fname, lname]) => [code, `${fname} ${lname}`]),
            '#entity-picker',
            {
                title: `Sélectionnez un gardien`,
                name: 'guard',
            },
        );
    }).catch((e) => reject(e))
});

const getWeekAsInterval = () => {
    const val = $('#date-picker').data('oldval');
    const monday = parseISO(val);
    const start = format(monday, dateFormatStrings.ISO);
    const end = format(addWeeks(monday, 1), dateFormatStrings.ISO);
    return [start, end, val];
};

const buildTable = (data, start) => {
    const days = Array.from({length: 7}, (_, i) => {
        return format(addDays(parseISO(start), i), dateFormatStrings.ISO);
    });
    const schedule = Object.fromEntries(days.map((day) => [day, {}]));
    let min = 9, max = 16;
    data.forEach(([datetime, parcel, sector]) => {
        const [date, time] = datetime.split(' ');
        const hour = Number(time.split(':')[0]);
        min = Math.min(min, hour);
        max = Math.max(max, hour);
        schedule[date][hour] = [parcel, sector];
    });
    const hours = Array.from({length: max + 1 - min}, (_, i) => (i + min) % 24);
    const rows = hours.map((hour) => {
        const rowHeader = `<th scope="row">${hour.toString().padStart(2, '0')}:00</th>`;
        const cells = days.map((date) => `<td><span class="tag-cell">${buildParcel(schedule[date][hour])}</span></td>`)
        return `<tr>${rowHeader}${cells}</tr>`
    });
    const head = `<tr><th>Début</th>${
        days.map((date) => `<th>${date}</th>`)
    }</tr>`;
    $('thead').empty().append(head);
    $('tbody').empty().append(rows);
};

const buildParcel = (parcel) => {
    if (!parcel || parcel.length !== 2) {
        return '<kbd class="secondary">N/A</kbd><i class="muted">Aucun</i>'
    }
    const [parcelNum, sector] = parcel
    return `<kbd>${parcelNum.toString().padStart(3, '0')}</kbd>${sector}`
}

const reloadRows = async () => {
    $('#date-picker, #refresh, #entity-picker').prop('inert', true);
    const code = $('#entity-picker input:checked').val();
    const [start, end, val] = getWeekAsInterval();
    setEditLink(val);
    return Schedule.staff.between.get(code, start, end).then((data) => {
        buildTable(data, start);
    }).catch(({status}) => {
        if (status === 404) {
            buildPage(true);
        };
    }).finally(() => {
        $('#date-picker, #refresh, #entity-picker').prop('inert', false);
    });
};

const setEditLink = (val) => {
    const edit = $('#edit');
    const noHash = (differenceInCalendarWeeks(parseISO(val), constructNow(), {weekStartsOn: 1}) <= 0);
    const url = edit.attr('data-href');
    edit.attr('href', noHash ? url : `${url}#${val}`);
}

const onDateInput = debounce(() => {
    onDateChange.cancel();
    const container = $('#date-picker');
    const picker = container.data('picker');
    if (!picker.valid) {
        picker.showValidity(false);
        return;
    }
    if (picker.val === container.data('oldval')) {
        picker.hideValidity();
        return;
    }
    if (container.find('[aria-invalid]').length > 0) {
        picker.showValidity(true);
    }
    container.data('oldval', picker.val);
    reloadRows().finally(() => {
        picker.hideValidity();
    });
}, 200);

const onDateChange = debounce(() => {
    onDateInput.cancel();
    const container = $('#date-picker');
    const picker = container.data('picker').hideValidity();
    container.data('oldval', picker.val);
    reloadRows();
}, 200);
