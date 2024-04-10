$(() => {
    setupSelect();
});

const setupSelect = () => {
    const max = (new Date()).toISOString().match(/^\d{4}-\d{2}/)[0];
    const min = (([year, month]) => `${year - 1}-${month}`)(max.split('-'));
    const el = $('#month-input').attr({min, max});
    $('#month-next').on('click', () => offsetMonth(min, max)(1));
    $('#month-prev').on('click', () => offsetMonth(min, max)(-1));
    el.on('change', onChangeMonth(min, max)).val(max).trigger('change');
}

const offsetMonth = (min, max) => (offset) => {
    if (offset === 0)
        return;
    const el = $('#month-input');
    const [year, month] = el.val().split('-').map((x) => Number(x));
    const newmonth = (month + offset - 1 + 12) % 12 + 1;
    const newyear = year + (offset < 0 ? -Number(month + offset <= 0) : Number(month + offset > 12));
    const newVal = clampedMonth(min, max, `${newyear}-${newmonth.toString().padStart(2, '0')}`);
    el.val(newVal).trigger('change');
}

const onChangeMonth = (min, max) => (e) => {
    const el = $(e.target);
    let date = el.val();
    if (!date) {
        el.val(max).trigger('change');
        return;
    }
    $('#month-next').attr('disabled', date === max);
    $('#month-prev').attr('disabled', date === min);
    Route.salary.all.get(date).then((data) => {
        fillRows(data);
    });
}

const clampedMonth = (min, max, val) => {
    const [lowyr, lowmo] = min.split('-');
    const [hiyr, himo] = max.split('-');
    const [yr, mo] = val.split('-');
    const newyr = Number(yr) < Number(lowyr) ? lowyr : (Number(yr) > Number(hiyr) ? hiyr : yr);
    const newmo = newyr === lowyr && Number(mo) < Number(lowmo) ? lowmo :
        newyr === hiyr && Number(mo) > Number(himo) ? himo : mo;
    return `${newyr}-${newmo}`;
}

const fillRows = (data) => {
    $('#add-new').removeAttr('disabled');
    if (!data.length) {
        const noData = `<tr><td colspan="8" class="no-data muted"><em>Pas de données</em></td></tr>`
        $('table').addClass('stretch');
        $('tbody').empty().append(noData);
        return;
    }
    rows = data.map((row) => {
        const editBtn = `<td><span role="button" class="icon-button secondary outline material-symbols-outlined">edit</span></td>`
        const cells = row.map((val, idx) => {
            switch (idx) {
                case 5:
                    return `<td>${(val === null) ? '<i class="muted">Temps plein</i>' :
                        Number(val) === 100 ? 'Temps plein' : `${val}%`}</td>`;
                case 6:
                    return `<td>\$${val}</td>`
                default:
                    return `<td>${val}</td>`
            }
        });
        return `<tr>${cells.join('')}${editBtn}</tr>`;
    });
    $('table').removeClass('stretch');
    $('tbody').empty().append(rows);
    $('tbody span').on('click', onClickEdit);
};

const onClickEdit = (e) => {
    const btn = $(e.target);
    btn.prop('hidden', true);
    $('table span').not(btn).attr('disabled', true);
    const parentCell = btn.parent();
    const salaryCell = parentCell.siblings().eq(-1);
    const text = salaryCell.text();
    const val = text.slice(1);
    const cancel = $('<span role="button" class="icon-button secondary outline material-symbols-outlined">cancel</span>');
    const confirm = $('<span role="button" class="icon-button secondary outline material-symbols-outlined">check_circle</span>');
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
        const date = $('#month-input').val();
        Route.salary.edit.post(code, date, newVal).finally(() => {
            Route.salary.all.get(date).then((data) => {
                fillRows(data);
            });
        });
    })
    cancel.on('click', onCancel);
    confirm.on('click', () => {
        trigger.trigger('click');
    });
    salaryCell.empty().append(form);
    parentCell.append(confirm, cancel); 
}

const onClickAdd = (e) => {
    console.log(e);
}
