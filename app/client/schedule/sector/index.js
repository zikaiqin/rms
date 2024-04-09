$(() => {
    rebuildPage();
});

const rebuildPage = () => {
    setDate();
    buildOptions().then((sector) => {
        const date = $('#date-picker').val();
        Route.schedule.sector.one.get(date, sector).then(({header, data}) => {
            buildTable(header, data);
        });
    });
}

const reloadRows = () => {
    const sector = $('#entity-picker').val();
    const date = $('#date-picker').val();
    Route.schedule.sector.one.get(date, sector).then(({header, data}) => {
        buildTable(header, data);
    }).catch(({status}) => {
        if (status === 404) rebuildPage();
    });
}

const setDate = () => {
    const date = new Date().toISOString().split('T')[0];
    $('#date-picker').val(date);
}

const buildOptions = async () => new Promise((resolve, reject) => {
    Route.schedule.sector.options.get().then((data) => {
        resolve(data[0]);
        const options = data.map((val) => `<option>${val}</option>`);
        $('#entity-picker').append(options)
    }).catch((e) => reject(e))
});

const buildTable = (header, data) => {
    const head = `<tr><th>Début</th>${
        header.map((pnum) => `<th>Parcelle #${pnum}</th>`)
    }</tr>`;
    const schedule = Object.fromEntries(header.map((pnum) => [pnum, {}]));
    let min = 9, max = 16;
    data.forEach(([time, parcel, code, fname, lname]) => {
        const hour = Number(time.split(':')[0]);
        min = Math.min(min, hour);
        max = Math.max(max, hour);
        schedule[parcel][hour] = [code, fname, lname];
    });
    const hours = Array(max + 1 - min).fill().map((_, i) => i + min);
    const rows = hours.map((hour) => `<tr><th scope="row">${hour.toString().padStart(2, '0')}:00</th>${
        header.map((parcel) => `<td>${buildEmployee(schedule[parcel][hour]) ?? '<kbd class="secondary">N/A</kbd><i class="muted">Non surveillé</i>'}</td>`)
    }</tr>`);
    $('thead').empty().append(head);
    $('tbody').empty().append(rows);
}

const buildEmployee = (employee) => {
    if (!employee || employee.length !== 3) {
        return undefined;
    }
    const [code, fname, lname] = employee;
    return `<kbd>${code}</kbd>${fname} ${lname}`
}
