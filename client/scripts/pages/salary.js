import $ from 'jquery';
import { debounce } from 'lodash-es';
import { Salary } from '@scripts/common/requests';
import { isInputTypeSupported, spamOnHold } from '@scripts/common/util';

$(() => {
    setupSelect();
    $('#add-new').on('click', onClickAdd);
});

const setupSelect = () => {
    const max = (new Date()).toISOString().match(/^\d{4}-\d{2}/)[0];
    const min = (([year, month]) => `${year - 1}-${month}`)(max.split('-'));
    const el = $('#date-picker');
    if (isInputTypeSupported('month', 'nonce')) {
        el.attr({min, max});
    } else {
        el.prop('readonly', true).attr('title', 'Switch to a newer browser for full feature support');
    }
    [['#next-month', 1], ['#prev-month', -1]].forEach(([id, offset]) => {
        spamOnHold(id, offsetMonth(min, max).bind(null, offset));
    });
    el.on('input', () => {
        $('#next-month, #prev-month').attr('disabled', true);
    });
    el.on('change', debounce(onChangeMonth(min, max), 200)).val(max).trigger('change');
}

const offsetMonth = (min, max) => {
    const [minDate, maxDate] = [min, max].map((date) => {
        const arr = date.split('-');
        return { year: Number(arr[0]), month: Number(arr[1]) }
    });
    return (offset) => {
        const el = $('#date-picker');
        const val = el.get(0).validity.valid ? el.val() : el.data('prev');
        const [year, month] = val.split('-').map((x) => Number(x));
        const newmonth = (month + offset - 1 + 12) % 12 + 1;
        const newyear = year + (offset < 0 ? -Number(month + offset <= 0) : Number(month + offset > 12));
        if (newyear <= minDate.year && newmonth <= minDate.month) {
            $('#prev-month').attr('disabled', true);
        } else if (newyear >= maxDate.year && newmonth >= maxDate.month) {
            $('#next-month').attr('disabled', true);
        }
        const newVal = `${newyear}-${newmonth.toString().padStart(2, '0')}`;
        el.val(newVal).trigger('change');
    };
}

const onChangeMonth = (min, max) => (e) => {
    const el = $(e.target);
    const valid = e.target.validity.valid;
    if (!valid) {
        el.attr('aria-invalid', !valid);
    } else {
        const val = el.val();
        $('#next-month').attr('disabled', val === max);
        $('#prev-month').attr('disabled', val === min);
        if (val === el.data('prev')) {
            el.removeAttr('aria-invalid');
            return;
        }
        if (el.attr('aria-invalid')) {
            el.attr('aria-invalid', false);
        }
        el.data('prev', val);
        Salary.all.get(val).then((data) => {
            fillRows(data);
        }).finally(() => {
            el.removeAttr('aria-invalid');
        });
    }
};

const fillRows = (data) => {
    $('#add-new').removeAttr('disabled');
    if (!data.length) {
        insertEmptyRow();
        return;
    }
    const rows = data.map((row) => {
        const editBtn = `<span role="button" class="icon-button secondary outline material-symbols-outlined" title="Modifier">edit</span>`
        const cells = row.map((val, idx) => {
            switch (idx) {
                case 5:
                    return `<td>${parseOccupation(val)}</td>`;
                case 6:
                    return `<td>\$${val}</td>`
                default:
                    return `<td>${val}</td>`
            }
        });
        return `<tr>${cells.join('')}<td><div class="icon-button-container">${editBtn}</td></div></tr>`;
    });
    $('table').removeClass('stretch');
    $('tbody').empty().append(rows);
    $('tbody span').on('click', onClickEdit);
};

const insertEmptyRow = () => {
    const noData = `<tr><td colspan="8" class="no-data muted"><em>Pas de données</em></td></tr>`
    $('table').addClass('stretch');
    $('tbody').empty().append(noData);
}

const parseOccupation = (val) => (val === null) ? '<i class="muted">Temps plein</i>' : Number(val) === 100 ? 'Temps plein' : `${val}%`

const onClickEdit = (e) => {
    const btn = $(e.target);
    btn.prop('hidden', true);
    $('table span').not(btn).attr('disabled', true);
    const parentCell = btn.closest('td');
    const salaryCell = parentCell.siblings().eq(-1);
    const text = salaryCell.text();
    const val = text.slice(1);
    const cancel = $(cancelIcon);
    const confirm = $(confirmIcon);
    const form = $('<form></form>');
    const trigger = $('<input type="submit" hidden />');
    const input = $(`<input id="edit-input" type="number" min="0" placeholder="${val}" value="${val}" />`);
    form.append(input, trigger);
    const onCancel = () => {
        parentCell.find('span').not(btn).remove();
        salaryCell.empty().text(text);
        btn.prop('hidden', false);
        $('table span').not(btn).removeAttr('disabled');
    };
    form.on('submit', (e) => {
        e.preventDefault();
        const newVal = input.val()
        if (val === newVal) {
            onCancel();
            return;
        }
        const code = parentCell.siblings().eq(0).text();
        const date = $('#date-picker').val();
        Salary.edit.post(code, date, newVal).finally(() => {
            Salary.all.get(date).then((data) => {
                fillRows(data);
            });
        });
    });
    cancel.on('click', onCancel);
    confirm.on('click', () => {
        trigger.trigger('click');
    });
    salaryCell.empty().append(form);
    parentCell.append(cancel, confirm);
    input.trigger('focus');
}

const onClickAdd = () => {
    const date = $('#date-picker').val();
    $('table span').attr('disabled', true);
    Salary.options.get(date).then((data) => {
        const row = $('<tr></tr>');
        const codeMap = Object.fromEntries(data.map(([code, ...rest]) => [code, [...rest]]));
        const options = data.map(([code, ..._]) => `<option>${code}</option>`);
        const select = $('<select id="code-select"></select>').append(options);
        const cells = data[0].slice(1).map((val, idx) => {
            return idx === 4 ? $(`<td>${parseOccupation(val)}</td>`) : $(`<td>${val}</td>`)
        });
        select.on('change', function() {
            const code = $(this).find(':selected').text();
            const vals = codeMap[code];
            cells.forEach((cell, idx) => {
                const val = vals[idx];
                if (idx === 4 && val === null) {
                    cell.empty().append(parseOccupation(val));
                } else {
                    cell.text(idx === 4 ? parseOccupation(val) : val);
                }
            })
        })
        const cancel = $(cancelIcon);
        const confirm = $(confirmIcon);
        const form = $('<form></form>');
        const trigger = $('<input type="submit" hidden />');
        const input = $(`<input id="edit-input" type="number" min="0" />`);
        form.append(input, trigger);
        const onCancel = () => {
            $(row).remove();
            $('table span').removeAttr('disabled');
            if ($('tbody').children().length === 0) {
                insertEmptyRow();
            }
        };
        form.on('submit', (e) => {
            e.preventDefault();
            const val = input.val()
            if (!val || Number(val) <= 0) {
                onCancel();
                return;
            }
            const code = select.find(':selected').text();
            const date = $('#date-picker').val();
            Salary.add.post(code, date, val).finally(() => {
                Salary.all.get(date).then((data) => {
                    fillRows(data);
                });
            });
        });
        cancel.on('click', onCancel);
        confirm.on('click', () => {
            trigger.trigger('click');
        });
        row.append(
            $('<td></td>').append(select),
            ...cells,
            $('<td></td>').append(form),
            $('<td><div class="icon-button-container"></div></td>').find('div').append(cancel, confirm).parent(),
        );
        if ($('tbody').find('.no-data').length > 0) {
            $('tbody').empty();
            $('table').removeClass('stretch');
        }
        $('tbody').append(row);
        input.trigger('focus');
    });
}

const confirmIcon = '<span role="button" class="icon-button secondary outline material-symbols-outlined" title="Confirmer">check</span>'
const cancelIcon = '<span role="button" class="icon-button secondary outline material-symbols-outlined" title="Annuler">close</span>'
