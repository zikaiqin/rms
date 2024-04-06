$(() => {
    const {open: openDetails} = new Modal('#details-modal', {
        onClose: () => { $('#details-form').empty() },
    });

    const {open: openDelete} = new Modal('#delete-modal');
    // $('#add-new').on('click', () => openDelete());

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
            openDetailsModal(code);
        });
    });
};

const openDetailsModal = (code) => {
    Route.staff.details.get(code).then((data) => {
        Modal.get('#details-modal').open(fillModalFields(data));
    });
};

const openDeleteModal = () => {
    Modal.get('#delete-modal').open();
};

const confirmDelete = () => {
    const code = $('#details-form input[name="code_mnemotechnique"]').val();
    Route.staff.delete.post(code).then(async () => {
        await Modal.get('#delete-modal').close();
        await Modal.get('#details-modal').close();
        reloadRows();
    }).catch(() => {
        Modal.get('#delete-modal').close();
    });
};

const fillModalFields = (data) => {
    const formEl = $('#details-form');
    const fields = Object.entries(staffFieldLabels)
        .filter(([key, _]) => data[key] !== null)
        .map(([key, label]) => {
            const value = data[key];
            const field =
                `<label>${label}<input name="${key}" value="${convert[key](value)}" readonly ${key === 'prenom' ? 'autofocus' : ''}/></label>`;
            return $(field);
        });
    formEl.append(fields);
};

const staffFieldLabels = {
    prenom: 'Prénom',
    nom_marital: 'Nom marital',
    nom: 'Nom',
    code_mnemotechnique: 'Code mnémotechnique',
    service: 'Service',
    fonction: 'Fonction',
    taux_occupation: 'Taux d\'occupation',
    grade: 'Grade',
    adresse: 'Adresse',
    date_naissance: 'Date de naissance',
    lieu_naissance: 'Lieu de naissance',
    numero_avs: 'Numéro AVS',
};

const convert = new Proxy(
    {
        taux_occupation: (v) => `${v}%`,
        date_naissance: (v) => (new Date(v)).toISOString().split('T')[0],
    },
    {
        get(target, prop) { return target[prop] ?? ((v) => v) },
    },
)
