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
    if (!data.length) {
        const noData = `<tr><td colspan="8" class="no-data muted"><em>Pas de données</em></td></tr>`
        $('table').addClass('stretch');
        $('tbody').empty().append(noData);
        return;
    }
    rows = data.map((row) => {
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
        return $(`<tr>${cells.join('')}</tr>`);
    });
    $('table').removeClass('stretch');
    $('tbody').empty().append(rows);
};
