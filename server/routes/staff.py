from pyodbc import IntegrityError
from flask import Blueprint, request, abort, make_response, jsonify
from datetime import datetime
from math import isnan
import re
from helpers.util import is_valid_code
from app import connection

staff = Blueprint('staff', __name__)

@staff.route('', methods=['GET'])
def staff_get():
    """
    Params:
        - role: filter employees by role

    Returns: a list of partial details of all employees
    """
    ROLE = request.args['role'] if 'role' in request.args else None
    sql = (
        'SELECT code_mnemotechnique, prenom, nom' +
        (' ' if ROLE else ', fonction, service ') +
        'FROM Employe ' +
        ('WHERE fonction=?' if ROLE else '')
    )
    with connection() as conn:
        cur = conn.cursor()
        if ROLE:
            cur.execute(sql, ROLE)
        else:
            cur.execute(sql)
            
        return [list(row) for row in cur.fetchall()]


@staff.route('<code>', methods=['GET'])
def staff_details(code):
    """
    Path:
        - code: code of the employee whose information we're requesting

    Status code:
        - 200 if successful
        - 400 if code is malformed or missing
        - 404 if no employee matches the code

    Returns: a dict with all the attributes of the employee
    """
    if not is_valid_code(code):
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    sql = 'SELECT * FROM Employe LEFT JOIN Gardien ON code_mnemotechnique=code_employe WHERE code_mnemotechnique=?'
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, code)

        # if the query did not return any rows, send 404
        row = cur.fetchone()
        if not row:
            abort(make_response(jsonify(message=f'Aucun employé associé au code "{code}"'), 404))

        # names of each column/attribute
        keys = [col[0] for col in cur.description]

        # return a dictionary of all attributes
        res = dict(zip(keys, row))
        del res['code_employe']
        return res


@staff.route('<code>', methods=['DELETE'])
def staff_delete(code):
    """
    Path:
        - code: code of the employee to be deleted

    Status code:
        - 200 if successful
        - 400 if code is malformed or missing
        - 404 if none deleted (code not found)
        - 409 if the employee supervises one or more sectors
    """
    if not is_valid_code(code):
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    sql = 'DELETE FROM Employe WHERE code_mnemotechnique=?'
    with connection() as conn:
        try:
            cur = conn.cursor()
            cur.execute(sql, code)

        except IntegrityError as err:
            # check if error was a reference constraint violation
            matches = re.search(r'REFERENCE constraint "(.*?)"', err.args[1])
            sql_err = matches.group(0) if matches else ''

            # if trying to delete a sector supervisor, send 409; otherwise, re-raise
            if '"est_chef"' in sql_err:
                msg = f'L\'employé associé au code "{code}" ne peut pas être supprimé, car il supervise un ou plusieurs secteurs'
                abort(make_response(jsonify(message=msg), 409))
            raise err
        else:
            # if the query did not change any rows (code belongs to no one), send 404
            if cur.rowcount == 0:
                abort(make_response(jsonify(message=f'Aucun employé associé au code "{code}"'), 404))

            return jsonify(success=True)

# TODO: change SIN type to CHAR(5)
# TODO: limit name, address, birthplace length
@staff.route('', methods=['POST'])
def staff_add():
    """
    Body: see KEYS

    Status code:
        - 200 if successful
        - 400 if missing properties or fails unique check
    """
    # body properties
    KEYS = ('code_mnemotechnique', 'numero_avs', 'prenom', 'nom', 'date_naissance',
            'lieu_naissance', 'adresse', 'fonction', 'service')

    if not isinstance(DATA := request.get_json(silent=True), dict):
        abort(make_response(jsonify(message='Arguments mal formatés'), 400))

    if DATA.get('fonction') == 'Gardien':
        KEYS += ('taux_occupation', )

    if any(((missing := key) not in DATA) for key in KEYS):
        abort(make_response(jsonify(message=f'Attribut manquant: {missing}'), 400))

    if not is_valid_code(DATA['code_mnemotechnique']):
        abort(make_response(jsonify(message='Code mnémotechnique mal formaté'), 400))
    try:
        if 'taux_occupation' in KEYS and isnan(float(DATA['taux_occupation'])):
            raise Exception()
    except:
        abort(make_response(jsonify(message="Taux d'occupation mal formaté"), 400))
    try:
        datetime.strptime(DATA['date_naissance'], '%Y-%m-%d')
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))

    param_str = ', '.join(f'@{key}=?' for key in KEYS)

    sql = f'SET NOCOUNT ON; EXEC insertionEmploye {param_str};'
    with connection() as conn:
        try:
            cur = conn.cursor()
            cur.execute(sql, tuple(DATA[key] for key in KEYS))
        except IntegrityError as err:
            # check if error was a key violation
            matches = re.search(r'Violation of (PRIMARY|UNIQUE) KEY constraint', err.args[1])
            if matches and (sql_err := matches.group()):
                msg = f'Le {'code mnémotechnique' if 'PRIMARY' in sql_err else 'numéro AVS'} doit être unique'
                abort(make_response(jsonify(message=msg), 400))
            
            matches = re.search(r'CHECK constraint "pourcentage"', err.args[1])
            if matches:
                msg = "Le taux d'occupation doit être entre 10% et 100%"
                abort(make_response(jsonify(message=msg), 400))

            raise err

        else:
            return jsonify(success=True)

# TODO: implement /staff/edit