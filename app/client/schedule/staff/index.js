$(() => {
    setDate();
    buildOptions();
});

const setDate = () => {
    const week = `${moment().year()}-W${moment().week()}`;
    $('#date-picker').val(week);
}

const buildOptions = async () => new Promise((resolve, reject) => {
    Route.schedule.staff.options.get().then((data) => {
        resolve(data[0]);
        const options = data.map((val) => `<option>${val}</option>`);
        $('#entity-picker').append(options)
    }).catch((e) => reject(e))
});
