$(() => {
    loadSectors();
});

const loadSectors = () => {
    Route.sector.all.get().then((data) => {
        const sectors = data.map(({name, supervisor, parcels, likes, dislikes}) => {
            const parcelEl = buildParcels(parcels);
            const superEl = buildEmployees('Superviseur', [supervisor]);
            const likesEl = buildLikes('Gardiens qui préfèrent', likes);
            const dislikesEl = buildLikes('Gardiens qui n\'apprécient pas', dislikes);
            const grid = buildGrid(`${superEl}<br>${parcelEl}`, likesEl, dislikesEl);
            return `<article><h3>${name}</h3><hr>${grid}</article>`;
        });
        $('main').append(sectors);
    })
}

const buildWithTag = (tag, label, ...classes) => `<div class="tag-row"><kbd${classes.length ? ` class="${classes.join(' ')}"` : ''}>${tag}</kbd>${label}</div>`

const buildPairs = (title, list, ...rest) => {
    const header = `<h5>${title}</h5>`;
    content = list.reduce((prev, [fst, snd]) => {
        return prev + buildWithTag(fst, snd, ...rest);
    }, '');
    return header + content
}

const buildGrid = (...sections) => `<div class="grid">${sections.map((s) => `<div>${s}</div>`).join('')}</div>`

const buildParcels = (parcels) => buildPairs('Parcelles', parcels.map((num) => [num.toString().padStart(3, '0'), `Parcelle #${num}`]), 'secondary');

const buildEmployees = (title, list) => buildPairs(title, list.map(([code, ...names]) => [code, names.join(' ')]));

const buildLikes = (title, likes) => likes.length ? buildEmployees(title, likes) : `<h5>${title}</h5><i class="muted">Aucun</i>`
