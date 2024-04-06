$(() => {
    reloadRows();
});

const reloadRows = () => {
    Route.staff.all.get().then((data) => {
        if (!data.length) {
            $('tbody').empty();
            return;
        }
        rows = data.map((row) => {
            const moreButton =
                `<span role="button" class="icon-button secondary outline material-symbols-outlined">open_in_new</span>`;
            const cells = [...row, moreButton].map((val) => `<td>${val}</td>`);
            return $(`<tr>${cells.join('')}</tr>`);
        });
        $('tbody').empty().append(rows);
        $('tbody span').on('click', function() {
            const code = $(this).closest('tr').children().first().text();
            openDetails(code);
        });
    });
}

const openDetails = (code) => {
    Route.staff.details.get(code).then((data) => {
        console.log(data);
    })
}
