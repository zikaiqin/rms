import $ from 'jquery';
import { Sector, Staff } from '@scripts/common/requests';
import { Modal, TagPicker } from '@scripts/common/components';

const sectionData = {
    supervisor: 'super',
    parcels: 'parcel',
    preferences: 'pref',
};
const editTitle = {
    super: 'Superviseur',
    parcel: 'Parcelles',
    pref: 'Préférences',
};
const btnIcons = {
    delete: 'delete',
    reset: 'replay',
    cancel: 'close',
};
const btnTitles = {
    delete: 'Supprimer',
    reset: 'Réinitialiser',
    cancel: 'Annuler',
};
const magic = 99;
const numSet = new Set(Array.from({ length: magic + 1 }, (_, i) => i).slice(1));

$(() => {
    new Modal('#preference-modal', {
        onClose: function() {
            const modal = $(this.getElement());
            modal.removeData('sector');
            modal.find('h3 span').remove();
            modal.find('tbody').empty();
            $('#submit-preference').prop('disabled', true);
        },
    });
    new Modal('#supervisor-modal', {
        onClose: function() {
            const modal = $(this.getElement());
            modal.find('tbody').empty();
            $('#submit-supervisor').prop('disabled', true);
        },
    });
    new Modal('#parcel-modal', {
        onClose: function() {
            const modal = $(this.getElement());
            modal.removeData('sector, options');
            modal.find('span.warning, tbody tr').remove();
            $('#submit-parcel').prop('disabled', true);
        },
    });
    new Modal('#sector-modal', {
        onClose: function() {
            const modal = $(this.getElement());
            modal.find('input[name="sector-name"]').removeAttr('aria-invalid').val('');
            $('#submit-sector').prop('disabled', true);
        },
    });
    reloadSectors();
    attachListeners();
});

const attachListeners = () => {
    // Enable/disable submit for pref, super modal
    ['preference', 'supervisor'].forEach((name) => {
        const evName = name === 'preference' ? 'change' : 'picker.change';
        $(`#${name}-modal table`).on(evName, function() { onModalChange.call(this, name) });
    });
    $('#submit-preference').on('click', onSubmitPreference);
    $('#submit-supervisor').on('click', onSubmitSupervisor);
    $('#submit-parcel').on('click', onSubmitParcel);
    $('#submit-sector').on('click', onSubmitSector);
    $('#parcel-modal thead span').on('click', onAddParcel);
    $('#sector-modal input[name="sector-name"]').on('input', onChangeSectorName);
    $('#add-sector').on('click', onAddSector);
};

const reloadSectors = () => {
    $('#sectors').empty();
    Sector.all.get().then((data) => {
        const sectors = data.map(({name, supervisor, parcels, likes, dislikes}) => {
            const parcelEl = buildParcels(parcels);
            const superEl = buildEmployees('Superviseur', sectionData.supervisor, [supervisor]);
            const likesEl = buildLikes('Gardiens qui préfèrent', likes);
            const dislikesEl = buildLikes('Gardiens qui n\'apprécient pas', dislikes);
            const grid = buildGrid(`${superEl}<br>${parcelEl}`, likesEl, dislikesEl);
            return attachCardButtons($(`<article><div class="card-header"><h3>${name}</h3></div><hr>${grid}</article>`), name);
        });
        $('#sectors').append(sectors);
    })
};

/**
 * @param {JQuery} jq
 * @returns {JQuery}
 */
const attachCardButtons = (jq, name) => {
    // edit buttons
    jq.find('.section-header').each(function() {
        const div = $(this);
        const data = div.data('section');
        const editBtn = $(
            `<span role="button" class="icon-button secondary outline material-symbols-outlined" title="Modifier ${editTitle[data]}">edit</span>`
        );
        switch (data) {
            case sectionData.preferences:
                editBtn.on('click', () => {
                    Sector.preference.get(name).then((data) => {
                        buildPrefTable(data, name);
                        Modal.get('#preference-modal').open();
                    });
                });
                break;
            case sectionData.supervisor:
                editBtn.on('click', () => {
                    Sector.supervisor.get().then((data) => {
                        buildSuperTable(data, name);
                        Modal.get('#supervisor-modal').open();
                    });
                });
                break;
            case sectionData.parcels:
                editBtn.on('click', () => {
                    Sector.parcel.get().then((data) => {
                        buildParcelTable(data, name);
                        Modal.get('#parcel-modal').open();
                    });
                });
                break;
        }
        div.append(editBtn);
    });
    return jq;
};

const buildPrefTable = (data, sector) => {
    const modal = $('#preference-modal');
    modal.data('sector', sector);
    modal.find('h3').append(`<span> &ndash; ${sector}</span>`);
    const rows = buildPrefRows(data);
    modal.find('tbody').append(rows);
};

const buildPrefRows = (guards) => {
    const options = [null, true, false];
    return guards.map(([code, fname, lname, pref]) => {
        const guardLabel = buildWithTag(code, `${fname} ${lname}`, 'span');
        const inputs = options.reduce((prev, val) => {
            return prev + `<td><div><input type="radio" name="${code}" value="${val}" ${val === pref ? 'title="Valeur initiale" checked' : ''}/></div></td>`;
        }, '');
        return `<tr><td>${guardLabel}</td>${inputs}</tr>`;
    });
};

const buildSuperTable = (data, name) => {
    const supervisors = [];
    const sectors = [];
    data.forEach(([code, fname, lname, s], idx) => {
        s.forEach((sector) => sectors.push([sector, idx]));
        supervisors.push([code, `${fname} ${lname}`]);
    });
    const table = $('#supervisor-modal table');
    const rows = sectors.sort().map(([sector, idx]) => {
        const row = $(`<tr><th scope="row"><span>${sector}</span></th><td><details></details></td></tr>`);
        new TagPicker(
            supervisors,
            row.find('details'),
            {
                initial: idx,
                title: `Superviseur du secteur ${sector}`,
                name: sector,
                autofocus: sector === name,
            },
        );
        return row;
    });
    table.find('tbody').append(rows);
};

const buildParcelTable = (data, currentSector) => {
    $('#parcel-modal').data({
        sector: currentSector,
        parcels: new Set(Object.values(data).flat()),
        options: Object.keys(data),
    });
    const table = $('#parcel-modal table');
    const sectors = Object.fromEntries(Object.entries(data).map(([name, parcels]) => [name, parcels.length]));
    const rows = Object.entries(data).flatMap(
        ([sector, parcels]) => parcels.map((number) => [number, sector]),
    ).sort(([a], [b]) => a - b).map(([number, sector]) => buildParcelRow(number, sector, Object.keys(sectors)));
    if (rows.length >= magic) {
        table.find('thead span').attr('disabled', true);
    } else {
        table.find('thead span').removeAttr('disabled');
    }
    table.append(rows);
    table.find('span[data-action="delete"]').on('click', onDeleteParcel);
    table.find('span[data-action="reset"]').on('click', onResetParcel);
    table.find('select').on('change', onChangeParcel);
};

const buildParcelRow = (parcel, sector, options) => {
    const select = `<select title="${sector}">${options.map(
        (name) => `<option value="${name}" ${name === sector ? 'selected' : ''}>${name}</option>`,
    )}</select>`;
    const buttons = [['delete'], ['reset', true]].map((args) => buildButton(...args)).join('');
    const row =
        `<tr>\
            <td class="index" data-index="${parcel}"><span data-placement="right">${parcel}</span></td>\
            <td class="notice"></td>\
            <td class="indicator"></td>\
            <td>${select}</td>\
            <td><div class="icon-button-container">${buttons}</div></td>\
        </tr>`;
    return row;
};

const buildButton = (action, disabled = false) => `<span\
    class="icon-button secondary outline material-symbols-outlined"\
    role="button"\
    title="${btnTitles[action]}"\
    data-action="${action}"\
    ${disabled ? ' disabled="true"' : ''}>${
        btnIcons[action]
    }</span>`;

const buildWithTag = (tag, label, parentEl, ...classes) =>
    `<${parentEl} class="tag-cell"><kbd${classes.length ? ` class="${classes.join(' ')}"` : ''}>${tag}</kbd>${label}</${parentEl}>`;

const buildPairs = (title, data, list, ...rest) => {
    const header = `<div class="section-header" data-section="${data}"><h5>${title}</h5></div>`;
    const content = list.reduce((prev, [fst, snd]) => {
        return prev + buildWithTag(fst, snd, 'div', ...rest);
    }, '');
    return header + content;
};

const buildGrid = (...sections) => `<div class="grid">${sections.map((s) => `<div>${s}</div>`).join('')}</div>`;

const buildParcels = (parcels) => buildPairs(
    'Parcelles',
    sectionData.parcels,
    parcels.map((num) => [num.toString().padStart(3, '0'), `Parcelle #${num}`]),
    'secondary',
);

const buildEmployees = (title, data, list) => buildPairs(title, data, list.map(([code, ...names]) => [code, names.join(' ')]));

const buildLikes = (title, likes) => likes.length ?
    buildEmployees(title, sectionData.preferences, likes) :
    `<div class="section-header" data-section="${sectionData.preferences}"><h5>${title}</h5></div><div><i class="muted">Aucun</i></div>`;

const onDeleteParcel = function() {
    const target = $(this);
    target.attr('disabled', true);
    const row = target.closest('tr');
    row.find('.notice, .indicator').empty();
    const select = row.find('select');
    const initial = select.find('option[selected]').val();
    select.val(initial).prop('disabled', true);
    row.find('span[data-action="reset"]').removeAttr('disabled');
    row.find('.notice').text('Supprimé');
    row.removeAttr('class').addClass('deleted');
    onParcelFormChange();
};

const onResetParcel = function() {
    const target = $(this);
    target.attr('disabled', true);
    const row = target.closest('tr');
    row.find('.notice, .indicator').empty();
    const select = row.find('select');
    const initial = select.find('option[selected]').val();
    select.val(initial).prop('disabled', false);
    row.removeAttr('class').find('span[data-action="delete"]').removeAttr('disabled');
    onParcelFormChange();
};

const onChangeParcel = function() {
    const target = $(this);
    target.attr('title', target.val());
    const row = target.closest('tr');
    row.find('.notice, .indicator').empty();
    const resetButton = row.find('span[data-action="reset"]');
    if (target.find(':selected').is('[selected]')) {
        resetButton.attr('disabled', true);
        row.removeAttr('class');
    } else {
        resetButton.removeAttr('disabled');
        row.addClass('modified');
        row.find('.notice').text(target.find('[selected]').val());
        row.find('.indicator').append('<span class="material-symbols-outlined">east</span>');
    }
    onParcelFormChange();
};

const onCancelInsert = function() {
    const row = $(this).closest('tr');
    const parcel = row.find('input').attr('data-prev');
    const {parcels} = $('#parcel-modal').data();
    if (parcel) {
        parcels.delete(Number(parcel));
    }
    row.remove();
    onParcelFormChange();
};

const onResetInsert = function() {
    const target = $(this);
    target.attr('disabled', true);

    const row = target.closest('tr');
    row.removeAttr('aria-invalid');

    const input = row.find('.index input');
    input.val(input.prop('defaultValue'))[0].checkValidity();
    input.attr('aria-invalid', false);

    const select = row.find('select');
    select.val(select.find('option[selected]').val());

    onParcelFormChange();
};

const onChangeInsertSelect = function() {
    const select = $(this);
    select.attr('title', select.val());
    const row = select.closest('tr');
    const input = row.find('.index input');
    const resetButton = row.find('span[data-action="reset"]');
    if (select.find(':selected').is('[selected]') && input.val() === input.prop('defaultValue')) {
        resetButton.attr('disabled', true);
    } else {
        resetButton.removeAttr('disabled');
    }
    onParcelFormChange();
};

const onChangeInsertInput = function() {
    const input = $(this);
    input[0].setCustomValidity('');
    const row = input.closest('tr');
    const select = row.find('select');
    const resetButton = row.find('span[data-action="reset"]');
    if (select.find(':selected').is('[selected]') && input.val() === input.prop('defaultValue')) {
        resetButton.attr('disabled', true);
    } else {
        resetButton.removeAttr('disabled');
    }
    const parcels = $('#parcel-modal').data('parcels');
    let oldVal = input.attr('data-prev');
    if (oldVal && parcels.has((oldVal = Number(oldVal)))) {
        parcels.delete(oldVal);
    }
    input.removeAttr('data-prev');
    let val = input.val();
    if (input.prop('validity').valid && val) {
        if (parcels.has((val = Number(val)))) {
            input[0].setCustomValidity(`Le numéro ${val} n'est pas disponible`);
        } else {
            input.attr('data-prev', val);
            parcels.add(val);
        }
    }
    if (input[0].reportValidity()) {
        row.removeAttr('aria-invalid');
        input.attr('aria-invalid', false);
    } else {
        row.attr('aria-invalid', true);
        input.attr('aria-invalid', true);
    }
    onParcelFormChange();
};

const onAddParcel = () => {
    const modal = $('#parcel-modal');
    const {sector, parcels, options} = modal.data();

    const parcel = Math.min(...numSet.difference(parcels));
    parcels.add(parcel);

    const row = $(
        `<tr class="inserted">\
            <td class="index"></td>\
            <td class="notice">Ajouté</td>\
            <td class="indicator"></td>\
            <td></td>\
            <td><div class="icon-button-container"></div></td>\
        </tr>`
    );
    const input =
        $(`<input type="number" min="1" max="${magic}" placeholder="${parcel}" value="${parcel}" data-prev="${parcel}" aria-invalid="false" required />`);
    input.on('input', onChangeInsertInput);

    const select = $(`<select title="${sector}">${options.map(
        (name) => `<option value="${name}" ${name === sector ? 'selected' : ''}>${name}</option>`,
    )}</select>`);
    select.on('change', onChangeInsertSelect);

    const [cancelButton, resetButton] = [['cancel'], ['reset', true]].map((args) => $(buildButton(...args)));
    cancelButton.on('click', onCancelInsert);
    resetButton.on('click', onResetInsert);

    row.find('.index').append(input);
    row.find('.indicator + td').append(select);
    row.find('.icon-button-container').append(cancelButton, resetButton);
    modal.find('table').append(row);
    input.trigger('focus');
    onParcelFormChange();
};

const onParcelFormChange = () => {
    const modal = $('#parcel-modal');
    modal.find('[aria-invalid="true"]:not(.inserted, .inserted [aria-invalid])').removeAttr('aria-invalid');
    modal.find('.index span[data-tooltip]').removeAttr('data-tooltip');
    modal.find('span.warning').remove();
    if (modal.find('select').length >= magic) {
        modal.find('thead span').attr('disabled', true);
    } else {
        modal.find('thead span').removeAttr('disabled');
    }
    const editCount = modal.find('tr:is(.inserted, .deleted, .modified)').length;
    if (editCount <= 0) {
        $('#submit-parcel').prop('disabled', true);
        return;
    }
    const sectors = Object.fromEntries(modal.data('options').map((key) => [key, 0]));
    modal.find('select:not(.deleted select, [aria-invalid] select)').each((_, el) => {
        const sector = $(el).val();
        sectors[sector]++;
    });
    const invalid = [];
    Object.entries(sectors).forEach(([sector, count]) => {
        if (count <= 0) {
            invalid.push(sector);
            modal.find(`:is(tr, select):not(.inserted, .inserted select):has([selected][value="${sector}"])`).attr('aria-invalid', true)
                .filter('tr').find('.index span').attr('data-tooltip', `Secteur ${sector} n'a pas de parcelles`);
        }
    });
    const emptyWarning = invalid.length > 0;
    const invalidWarning = modal.find('.inserted[aria-invalid]').length > 0;
    $('#submit-parcel').prop('disabled', emptyWarning || invalidWarning);
    if (emptyWarning) {
        const message = invalid.length > 1 ?
            `Secteurs ${invalid.slice(0, -1).join(', ')} et ${invalid.at(-1)} n'ont pas de parcelles` :
            `Secteur ${invalid[0]} n'a pas de parcelles`;
        const symbol =
            `<span class="material-symbols-outlined warning" data-tooltip="${message}" data-placement="bottom">warning</span>`;
            modal.find('thead [data-col="sector"] .icon-row').append(symbol);
    }
    if (invalidWarning) {
        const message = "Un ou plusieurs secteurs à ajouter ont un numéro invalide";
        const symbol =
            `<span class="material-symbols-outlined warning" data-tooltip="${message}" data-placement="right">warning</span>`;
        modal.find('thead [data-col="parcel"] .icon-row').append(symbol);
    }
};

const onModalChange = function(name) {
    if ($(this).find('input[checked]:not(:checked)').length > 0) {
        $(`#submit-${name}`).prop('disabled', false);
    } else {
        $(`#submit-${name}`).prop('disabled', true);
    }
};

const onSubmitPreference = () => {
    const modal = $('#preference-modal');
    const sector = modal.data('sector');
    const changes = [];
    modal.find('input:checked:not([checked])').each(function() {
        const input = $(this);
        const prefers = JSON.parse(input.val());
        const code = input.attr('name');
        changes.push({ code, prefers });
    });
    if (changes.length <= 0) {
        return;
    }
    Sector.preference.post(sector, changes).then(() => {
        Modal.get('#preference-modal').close();
        reloadSectors();
    });
};

const onSubmitSupervisor = () => {
    const modal = $('#supervisor-modal');
    const changes = [];
    modal.find('input:checked:not([checked])').each(function() {
        const input = $(this);
        const supervisor = input.val();
        const sector = input.attr('name');
        changes.push({ sector, supervisor });
    });
    if (changes.length <= 0) {
        return;
    }
    Sector.supervisor.post(changes).then(() => {
        Modal.get('#supervisor-modal').close();
        reloadSectors();
    });
};

const onSubmitParcel = () => {
    const modal = $('#parcel-modal');
    const changes = [];
    modal.find('.deleted .index').each(function() {
        const parcel = Number($(this).attr('data-index'));
        changes.push({ parcel, sector: null });
    });
    modal.find('.modified').each(function() {
        const row = $(this);
        const parcel = Number(row.find('.index').attr('data-index'));
        const sector = row.find('select').val();
        changes.push({ parcel, sector });
    });
    modal.find('.inserted').each(function() {
        const row = $(this);
        const parcel = Number(row.find('input').val());
        const sector = row.find('select').val();
        changes.push({ parcel, sector });
    });
    if (changes.length <= 0) {
        return;
    }
    Sector.parcel.post(changes).then(() => {
        Modal.get('#parcel-modal').close();
        reloadSectors();
    });
};

const onAddSector = () => {
    Modal.get('#sector-modal').open(function() {
        const modal = $(this.getElement());
        Staff.listAll('Chef de secteur').then((supervisors) => {
            new TagPicker(
                supervisors.map(([fst, ...rest]) => [fst, rest.join(' ')]),
                modal.find('details'),
                { name: 'supervisor' },
            );
        });
    });
};

const onSubmitSector = () => {
    const modal = $('#sector-modal');
    const name = modal.find('input[name="sector-name"]').val();
    const supervisor = modal.find('input[checked]').val();
    Sector.add(name, supervisor).then(() => {
        Modal.get('#sector-modal').close();
        reloadSectors();
    });
};

const onChangeSectorName = (e) => {
    const valid = e.target.validity.valid;
    if (valid) {
        $('#submit-sector').removeAttr('disabled');
    } else {
        $('#submit-sector').attr('disabled', true);
    }
    if (!valid && e.target.value) {
        $(e.target).attr('aria-invalid', true);
    } else {
        $(e.target).removeAttr('aria-invalid');
    }
};
