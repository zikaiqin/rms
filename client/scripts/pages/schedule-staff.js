import $ from 'jquery';
import moment from 'moment';
import { debounce } from 'lodash-es';
import { Schedule } from '@scripts/common/requests';
import { isInputTypeSupported, spamOnHold } from '@scripts/common/util';
import { TagPicker } from '@scripts/common/components';

$(() => {
    buildPage()
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
    const [min, max] = [-1, 1].map((offset) => `${moment().year() + offset}-W${moment().week()}`);
    $('#entity-picker').on('picker.change', reloadRows);
    [['#next-date', 1], ['#prev-date', -1]].forEach(([id, offset]) => {
        spamOnHold(id, onDateOffset(min, max).bind(null, offset));
    });
    $('#date-picker').on('input', () => {
        $('#next-date, #prev-date').css('pointer-events', 'none');
    }).on('change', debounce(onDateChange(min, max), 200));
    $('#refresh').on('click', reloadRows);
}

const buildDatePicker = () => {
    const week = `${moment().year()}-W${moment().week()}`;
    const year = Number(week.split('-')[0]);
    const [min, max] = [-1, 1].map((offset) => week.split('-').with(0, year + offset).join('-'));
    const el = $('#date-picker').val(week);
    if (!isInputTypeSupported('week', 'nonce')) {
        el.prop('readonly', true).attr('title', 'Switch to a newer browser for full feature support');
    } else {
        el.attr({min, max});
    }
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
    const weekVal = $('#date-picker').val();
    const mo = moment(weekVal);
    const start = mo.format('yyyy-MM-DD');
    const end = mo.endOf('isoWeek').format('yyyy-MM-DD');
    return [start, end];
};

const buildTable = (data, start) => {
    const days = Array.from({length: 7}, (_, i) => {
        const mo = moment(start).add(i, 'days').locale('fr');
        return mo.format('yyyy-MM-DD');
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
    $('#prev-date, #next-date, #date-picker, #refresh', '#entity-picker').css('pointer-events', 'none');
    const code = $('#entity-picker input:checked').val();
    const [start, end] = getWeekAsInterval();
    return Schedule.staff.between.get(code, start, end).then((data) => {
        buildTable(data, start);
    }).catch(({status}) => {
        if (status === 404) {
            buildPage(true);
        };
    }).finally(() => {
        $('#prev-date, #next-date, #date-picker, #refresh, #entity-picker').css('pointer-events', '');
    });
};

const onDateOffset = (min, max) => {
    const [minDate, maxDate] = [min, max].map((date) => {
        const arr = date.split('-W');
        return { year: Number(arr[0]), week: Number(arr[1]) }
    });
    return (offset) => {
        const el = $('#date-picker');
        const val = el.get(0).validity.valid ? el.val() : el.data('prev');
        const [year, week] = val.split('-W').map((x) => Number(x));
        const newWeek = (week + offset - 1 + 52) % 52 + 1;
        const newYear = year + (offset < 0 ? -Number(week + offset <= 0) : Number(week + offset > 52));
        if (newYear <= minDate.year && newWeek <= minDate.week) {
            $('#prev-date').prop('disabled', true);
        } else if (newYear >= maxDate.year && newWeek >= maxDate.week) {
            $('#next-date').prop('disabled', true);
        }
        const newVal = `${newYear}-W${newWeek.toString().padStart(2, '0')}`;
        el.val(newVal).trigger('change');
    };
};

const onDateChange = (min, max) => (e) => {
    const el = $(e.target);
    const valid = e.target.validity.valid;
    if (!valid) {
        el.attr('aria-invalid', !valid);
    }
    else {
        const val = el.val();
        $('#next-date').prop('disabled', val === max);
        $('#prev-date').prop('disabled', val === min);
        if (val === el.data('prev')) {
            el.removeAttr('aria-invalid');
            return;
        }
        if (el.attr('aria-invalid')) {
            el.attr('aria-invalid', false);
        }
        el.data('prev', val);
        reloadRows().finally(() => {
            el.removeAttr('aria-invalid');
        });
    }
};
