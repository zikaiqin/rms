import $ from 'jquery';
import { Sector } from '@scripts/common/requests';
import Modal from '@scripts/common/modal';

const sectionData = {
    supervisor: 'super',
    parcels: 'parcel',
    preferences: 'pref',
};

$(() => {
    new Modal('#preference-modal', {
        onClose: function() {
            const modal = $(this.getElement());
            modal.removeAttr('data-sector');
            modal.find('h3 span').remove();
            modal.find('tbody').empty();
            $('#submit-preferences').prop('disabled', true);
        },
    });
    $('#preference-modal table').on('change', function() {
        if ($(this).find('input[data-initial]:not(:checked)').length > 0) {
            $('#submit-preferences').prop('disabled', false);
        } else {
            $('#submit-preferences').prop('disabled', true);
        }
    });
    $('#submit-preferences').on('click', () => {
        const modal = $('#preference-modal');
        const sector = modal.data('sector');
        const changes = [];
        modal.find('input:checked:not(input[data-initial])').each(function() {
            const input = $(this);
            const prefers = input.val();
            const code = input.attr('name');
            changes.push({ code, prefers });
        });
        if (changes.length <= 0) {
            return;
        }
        Sector.preferences.post(sector, changes).then(() => {
            Modal.get('#preference-modal').close();
            reloadSectors();
        });
    })
    reloadSectors();
});

const reloadSectors = () => {
    $('main').empty();
    Sector.all.get().then((data) => {
        const sectors = data.map(({name, supervisor, parcels, likes, dislikes}) => {
            const parcelEl = buildParcels(parcels);
            const superEl = buildEmployees('Superviseur', sectionData.supervisor, [supervisor]);
            const likesEl = buildLikes('Gardiens qui préfèrent', likes);
            const dislikesEl = buildLikes('Gardiens qui n\'apprécient pas', dislikes);
            const grid = buildGrid(`${superEl}<br>${parcelEl}`, likesEl, dislikesEl);
            return attachEditButtons($(`<article><div class="card-header"><h3>${name}</h3></div><hr>${grid}</article>`), name);
        });
        $('main').append(sectors);
    })
};

/**
 * @param {JQuery} jq
 * @returns {JQuery}
 */
const attachEditButtons = (jq, name) => {
    const editBtn = `<span role="button" class="icon-button secondary outline material-symbols-outlined" title="Modifier">edit</span>`;
    jq.find('.section-header').each(function() {
        const div = $(this);
        const data = div.data('section');
        const btn = $(editBtn);
        if (data === sectionData.preferences) {
            btn.on('click', () => {
                Sector.preferences.get(name).then((data) => {
                    const modal = $('#preference-modal');
                    modal.attr('data-sector', name)
                    modal.find('h3').append(`<span> &ndash; ${name}</span>`);
                    const rows = buildPrefRows(data);
                    modal.find('tbody').append(rows);
                    Modal.get('#preference-modal').open();
                });
            })
        }
        div.append(btn);
    });
    return jq;
};

const buildPrefRows = (guards) => {
    const options = [null, true, false];
    return guards.map(([code, fname, lname, pref]) => {
        const guardLabel = buildWithTag(code, `${fname} ${lname}`, 'span');
        const inputs = options.reduce((prev, val) => {
            return prev + `<td><div><input type="radio" name="${code}" value="${val}" ${val === pref ? 'title="Valeur initiale" data-initial checked ' : ''}/></div></td>`;
        }, '');
        return `<tr><td>${guardLabel}</td>${inputs}</tr>`;
    });
};

const buildWithTag = (tag, label, parentEl, ...classes) => `<${parentEl} class="tag-cell"><kbd${classes.length ? ` class="${classes.join(' ')}"` : ''}>${tag}</kbd>${label}</${parentEl}>`;

const buildPairs = (title, data, list, ...rest) => {
    const header = `<div class="section-header" data-section="${data}"><h5>${title}</h5></div>`;
    const content = list.reduce((prev, [fst, snd]) => {
        return prev + buildWithTag(fst, snd, 'div', ...rest);
    }, '');
    return header + content;
};

const buildGrid = (...sections) => `<div class="grid">${sections.map((s) => `<div>${s}</div>`).join('')}</div>`;

const buildParcels = (parcels) => buildPairs('Parcelles', sectionData.parcels, parcels.map((num) => [num.toString().padStart(3, '0'), `Parcelle #${num}`]), 'secondary');

const buildEmployees = (title, data, list) => buildPairs(title, data, list.map(([code, ...names]) => [code, names.join(' ')]));

const buildLikes = (title, likes) => likes.length ? buildEmployees(title, sectionData.preferences, likes) : `<div class="section-header" data-section="${sectionData.preferences}"><h5>${title}</h5></div><div><i class="muted">Aucun</i></div>`;
