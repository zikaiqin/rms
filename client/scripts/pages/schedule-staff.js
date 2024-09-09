import $ from 'jquery';
import moment from 'moment';
import { debounce } from 'lodash-es';
import { Schedule } from '@scripts/common/requests';

$(() => {
    rebuildPage()
});

const rebuildPage = () => {
    setDate();
    buildOptions().then((code) => {
        const [start, end] = getWeekAsInterval();
        Schedule.staff.between.get(code, start, end).then((data) => {
            buildTable(data, start);
            attachListeners();
        });
    });
};

const attachListeners = () => {
    $('#entity-picker').on('change', onEntityChange);
    $('#date-picker').on('change', debounce(reloadRows, 200, { leading: true }));
}

const setDate = () => {
    const week = `${moment().year()}-W${moment().week()}`;
    const year = Number(week.split('-')[0]);
    const [min, max] = [-1, 1].map((offset) => week.split('-').with(0, year + offset).join('-'));
    $('#date-picker').val(week).attr({min, max});
};

const buildOptions = async () => new Promise((resolve, reject) => {
    Schedule.staff.options.get().then((data) => {
        const options = data.map(([code, fname, lname]) =>
            `<option value="${code}">${fname} ${lname}</option>`);
        $('#entity-picker select').append(options);
        $('#entity-picker').prop('hidden', false);
        resolve(data[0][0]);
        const listItems = data.map(([code, fname, lname]) =>
            `<li><label class="tag-cell"><input type="radio" name="tag" value="${code}" hidden /><kbd>${code}</kbd> ${fname} ${lname}</label></li>`);
        $('#entity-picker ul').append(listItems).find('input').first().prop('checked', true);
        setSelection();
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

const reloadRows = () => {
    const code = $('#entity-picker input:checked').val();
    const [start, end] = getWeekAsInterval();
    Schedule.staff.between.get(code, start, end).then((data) => {
        buildTable(data, start);
    }).catch(({status}) => {
        if (status === 404) rebuildPage();
    });
};

const onEntityChange = () => {
    setSelection();
    reloadRows();
};

const setSelection = () => {
    const picker = $('#entity-picker');
    picker.removeAttr('open');
    picker.find('li[hidden]').removeAttr('hidden');
    picker.find('li:has(:checked)').attr('hidden', '');
    const code = picker.find('input:checked').val();
    picker.find('select').val(code);
    picker.find('summary kbd').empty().text(code);
};
