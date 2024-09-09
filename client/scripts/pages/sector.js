import $ from 'jquery';
import { Sector } from '@scripts/common/requests';

$(() => {
    loadSectors();
});

const loadSectors = () => {
    Sector.all.get().then((data) => {
        const sectors = data.map(({name, supervisor, parcels, likes, dislikes}) => {
            const editBtn = `<span role="button" class="icon-button secondary outline material-symbols-outlined" title="Modifier">edit</span>`;
            const parcelEl = buildParcels(parcels);
            const superEl = buildEmployees('Superviseur', [supervisor]);
            const likesEl = buildLikes('Gardiens qui préfèrent', likes);
            const dislikesEl = buildLikes('Gardiens qui n\'apprécient pas', dislikes);
            const grid = buildGrid(`${superEl}<br>${parcelEl}`, likesEl, dislikesEl);
            return `<article><div class="card-header"><h3>${name}</h3>${editBtn}</div><hr>${grid}</article>`;
        });
        $('main').append(sectors);
        $('.card-header span').on('click', onEdit);
    })
}

const onEdit = function() {
    // TODO
    return;
    const name = $(this).parent().find('h3').text();
    console.log(name);
};

const buildWithTag = (tag, label, ...classes) => `<div class="tag-cell"><kbd${classes.length ? ` class="${classes.join(' ')}"` : ''}>${tag}</kbd>${label}</div>`

const buildPairs = (title, list, ...rest) => {
    const header = `<h5>${title}</h5>`;
    const content = list.reduce((prev, [fst, snd]) => {
        return prev + buildWithTag(fst, snd, ...rest);
    }, '');
    return header + content
}

const buildGrid = (...sections) => `<div class="grid">${sections.map((s) => `<div>${s}</div>`).join('')}</div>`

const buildParcels = (parcels) => buildPairs('Parcelles', parcels.map((num) => [num.toString().padStart(3, '0'), `Parcelle #${num}`]), 'secondary');

const buildEmployees = (title, list) => buildPairs(title, list.map(([code, ...names]) => [code, names.join(' ')]));

const buildLikes = (title, likes) => likes.length ? buildEmployees(title, likes) : `<h5>${title}</h5><i class="muted">Aucun</i>`
