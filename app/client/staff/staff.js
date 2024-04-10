$(() => {
    reloadRows();

    const { open: openEdit } = new Modal('#edit-modal', {
        onClose: () => { resetEditForm() },
    });
    $('#add-new').on('click', () => openEdit());

    new Modal('#details-modal', {
        onClose: () => { $('#details-form').empty() },
    });
    new Modal('#delete-modal');
});

const reloadRows = () => {
    Route.staff.all.get().then((data) => {
        if (!data.length) {
            const noData = `<tr><td colspan="8" class="no-data muted"><em>Pas de données</em></td></tr>`
            $('table').addClass('stretch');
            $('tbody').empty().append(noData);
            return;
        }
        rows = data.map((row) => {
            const moreButton =
                `<span role="button" class="icon-button secondary outline material-symbols-outlined" title="Voir détails">open_in_new</span>`;
            const cells = [...row, moreButton].map((val) => `<td>${val}</td>`);
            return $(`<tr>${cells.join('')}</tr>`);
        });
        $('table').removeClass('stretch');
        $('tbody').empty().append(rows);
        $('tbody span').on('click', function() {
            const code = $(this).closest('tr').children().first().text();
            openDetailsModal(code);
        });
    });
};

const submitDetails = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {};
    data.forEach((val, key) => { payload[key] = val; })
    Route.staff.add.post(payload).then(() => {
        reloadRows();
        Modal.get('#edit-modal').close();
    });
};

const onServiceChange = () => {
    hideGuardFieldset();
    const service = $('#edit-form select[name="service"] :selected').data('key');
    const def = '<option selected disabled value="">Selectionnez une fonction</option>';
    let options;
    switch (service) {
        case 'admin':
            options = ['Secrétaire', 'Comptable', 'Chef du personnel', 'Directeur'].map((text) => `<option>${text}</option>`);
            break;
        case 'surv':
            options = ['Gardien', 'Chef de secteur'].map((text) => `<option>${text}</option>`);
            break;
        case 'med':
            options = ['Vétérinaire', 'Infirmier'].map((text) => `<option>${text}</option>`);
            break;
        default:
            resetFunctionSelect();
            return;
    }
    $('#edit-form select[name="fonction"]').prop('disabled', false).empty().append(def, ...options);
};

const onFunctionChange = () => {
    const fonc = $('#edit-form select[name="fonction"] :selected').text().trim();
    if (fonc === 'Gardien') {
        showGuardFieldset();
    } else { 
        hideGuardFieldset();
    }
}

const triggerSubmit = () => { $('#edit-form input[type="submit"]').trigger('click'); };

const resetEditForm = () => {
    $('#edit-form').trigger('reset');
    resetFunctionSelect();
    hideGuardFieldset();
};

const resetFunctionSelect = () => {
    $('#edit-form select[name="fonction"]').prop('disabled', true).empty().append(
        '<option selected disabled value="">Selectionnez d\'abord le service</option>'
    );
    hideGuardFieldset();
}

const showGuardFieldset = () => {
    $('#edit-form fieldset').prop('hidden', false);
    $('#edit-form fieldset input').prop('required', true);
}
const hideGuardFieldset = () => {
    $('#edit-form fieldset input').prop('required', false).val('');
    $('#edit-form fieldset').prop('hidden', true);
}

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
    Route.staff.delete.post(code).then(() => {
        reloadRows();
        Modal.get('#delete-modal').close().then(() => {
            Modal.get('#details-modal').close();
        });
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
            return field;
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
    grade: 'Grade',
    taux_occupation: 'Taux d\'occupation',
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
);
