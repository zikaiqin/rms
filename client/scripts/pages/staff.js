import $ from 'jquery';
import { Staff } from '@scripts/common/requests.js';
import { Modal } from '@scripts/common/components.js';

const roleMap = {
    'Administratif': [
        'Secrétaire',
        'Comptable',
        'Chef du personnel',
        'Directeur',
    ],
    'Surveillance': [
        'Gardien',
        'Chef de secteur',
    ],
    'Médical': [
        'Vétérinaire',
        'Infirmier',
    ]
};
const roleList = Object.values(roleMap).flat();
const deptList = Object.keys(roleMap);
const deptMap = Object.fromEntries(
    Object.entries(roleMap)
        .map(([dept, roles]) => roles.map((role) => [role, dept]))
        .flat(),
);

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

$(() => {
    buildOptions();
    reloadRows();

    const { open: openEdit } = new Modal('#edit-modal', {
        onClose: () => { resetEditForm() },
    });
    $('#add-new').on('click', () => openEdit());

    new Modal('#details-modal', {
        onClose: () => {
            $('#details-form').empty();
            $('#details-modal h3').empty();
        },
    });
    new Modal('#delete-modal');

    attachListeners();
});

const attachListeners = () => {
    $('#refresh').on('click', reloadRows);
    $('#edit-form').on('submit', submitDetails);
    $('#dept-picker').on('change', onDeptChange);
    $('#role-picker').on('change', onRoleChange);
    $('#rate-picker').on('input', onRateChange);
    $('#submit-new').on('click', triggerSubmit);
    $('#delete').on('click', openDeleteModal);
    $('#confirm-delete').on('click', confirmDelete);
}

const buildOptions = () => {
    $('#dept-picker').append(
        deptList.map((dept, index) => `<option data-key="${index}">${dept}</option>`),
    );
    $('#role-picker').append(
        roleList.map((role, index) => `<option data-key="${index}">${role}</option>`),
    );
}

const reloadRows = () => {
    Staff.all.get().then((data) => {
        if (!data.length) {
            const noData = `<tr><td colspan="6" class="no-data muted"><em>Pas de données</em></td></tr>`
            $('table').addClass('stretch');
            $('tbody').empty().append(noData);
            return;
        }
        const rows = data.map((row) => {
            const moreButton =
                `<span role="button" class="icon-button secondary outline material-symbols-outlined" value="${row[0]}" title="Voir détails">more_horiz</span>`;
            const cells = [...row, moreButton].map((val) => `<td>${val}</td>`);
            return $(`<tr>${cells.join('')}</tr>`);
        });
        $('table').removeClass('stretch');
        $('tbody').empty().append(rows);
        $('tbody span').on('click', function() {
            const code = $(this).attr('value');
            openDetailsModal(code);
        });
    });
};

const submitDetails = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {};
    data.forEach((val, key) => { payload[key] = val; })
    Staff.add.post(payload).then(() => {
        reloadRows();
        Modal.get('#edit-modal').close();
    });
};

const onRoleChange = () => {
    const key = $('#role-picker :selected').data('key');
    if (key === undefined) {
        return;
    }
    $('#role-picker').children().removeClass('suggest');
    const role = roleList[key];
    const dept = deptMap[role];
    const deptKey = $('#dept-picker :selected').data('key');
    if (deptKey === undefined || dept !== deptList[deptKey]) {
        $('#dept-picker').val(dept);
    }
    if (role === 'Gardien') {
        showGuardFieldset();
    } else {
        hideGuardFieldset();
    }
}

const onDeptChange = () => {
    const key = $('#dept-picker :selected').data('key');
    const dept = deptList[key];
    const roleKey = $('#role-picker :selected').data('key');
    if (roleKey < 0 || dept !== deptMap[roleList[roleKey]]) {
        hideGuardFieldset();
        $('#role-picker').val('')
            .children()
            .removeClass('suggest')
            .filter((_, el) => {
                const optKey = $(el).data('key');
                return (optKey >= 0) && (dept === deptMap[roleList[optKey]]);
            })
            .addClass('suggest');
    }
};
const onRateChange = () => {
    const input = $('#rate-picker');
    const indicator = input.parent().find('.indicator');
    indicator.text(input.val());
};

const triggerSubmit = () => { $('#edit-form input[type="submit"]').trigger('click'); };

const resetEditForm = () => {
    $('#edit-form').trigger('reset');
    hideGuardFieldset();
};

const showGuardFieldset = () => {
    $('#edit-form fieldset').prop('hidden', false);
    $('#edit-form fieldset input').prop('required', true);
}
const hideGuardFieldset = () => {
    const fieldset = $('#edit-form fieldset');
    fieldset.find('input').prop('required', false);
    fieldset.find('input:not(#rate-picker)').val('');
    fieldset.find('#rate-picker').val(100);
    fieldset.find('.indicator').text(100);
    fieldset.prop('hidden', true);
}

const openDetailsModal = (code) => {
    Staff.details.get(code).then((data) => {
        $('#details-modal h3').append(
            `<span class="tag-cell">\
                <kbd>${data.code_mnemotechnique}</kbd>\
                ${data.prenom} ${data.nom_marital ? data.nom_marital + ` (${data.nom})` : data.nom}\
            <span>`,
        );
        Modal.get('#details-modal').open(fillModalFields(data));
    });
};

const openDeleteModal = () => {
    Modal.get('#delete-modal').open();
};

const confirmDelete = () => {
    const code = $('#details-form input[name="code_mnemotechnique"]').val();
    Staff.delete.post(code).then(() => {
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

const convert = new Proxy(
    {
        taux_occupation: (v) => `${v}%`,
        date_naissance: (v) => (new Date(v)).toISOString().split('T')[0],
    },
    {
        get(target, prop) { return target[prop] ?? ((v) => v) },
    },
);
