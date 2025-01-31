from flask import Blueprint, request, abort, make_response, jsonify
from itertools import chain, repeat
from datetime import datetime
from math import isnan
from helpers.util import is_valid_code
from app import connection

salary = Blueprint('salary', __name__)

def assert_salary_keys(datestr):
    if not isinstance(DATA := request.get_json(silent=True), dict):
        abort(make_response(jsonify(message='Arguments mal formatés'), 400))

    CODE, SALARY = (DATA.get(key) for key in ('code', 'salary'))
    try:
        if not datestr or not (DATE := datetime.strptime(datestr, '%Y-%m')):
            raise Exception('Date manquante ou mal formatée')
        if not is_valid_code(CODE):
            raise Exception('Code mnémotechnique manquant ou mal formaté')
        if not SALARY or isnan(nbr := float(SALARY)) or nbr < 0:
            raise Exception('Salaire manquant ou mal formaté')
    except ValueError:
        abort(make_response(jsonify(message='Salaire mal formaté'), 400))
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 400))
    return CODE, DATE, SALARY, nbr

@salary.route('/<date>', methods=['GET'])
def salary_get(date):
    try:
        DATE_STR = str(datetime.strptime(date, '%Y-%m').date())
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))

    sql = 'SELECT * FROM salairesDuMois(?) ORDER BY code_mnemotechnique'
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, DATE_STR)

        return [list(row) for row in cur.fetchall()]


@salary.route('/<date>', methods=['PUT'])
def salary_edit(date):
    CODE, DATE, SALARY, nbr = assert_salary_keys(date)
    with connection() as conn:
        cur = conn.cursor()
        if (nbr == 0):
            sql = 'DELETE FROM Salaire WHERE code_employe=? AND date=?'
            cur.execute(sql, CODE, str(DATE.date()))
        else:
            sql = 'UPDATE Salaire SET montant=? WHERE code_employe=? AND date=?'
            cur.execute(sql, SALARY, CODE, str(DATE.date()))

        if cur.rowcount == 0:
            abort(make_response(jsonify(message=f'Aucun salaire associé à l\'employé "{CODE}" le {date}'), 404))

        return jsonify(success=True)


@salary.route('/<date>/options', methods=['GET'])
def salary_options(date):
    try:
        DATE_STR = str(datetime.strptime(date, '%Y-%m').date())
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))
    sql = (
        'SELECT code_mnemotechnique, prenom, nom, numero_avs, fonction, taux_occupation '
        'FROM Employe LEFT JOIN Gardien '
        'ON code_mnemotechnique = code_employe '
        'WHERE code_mnemotechnique NOT IN ('
        'SELECT code_employe FROM Salaire '
        'WHERE DATEPART(year, date) = DATEPART(year, ?) '
        'AND DATEPART(month, date) = DATEPART(month, ?));'
    )
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, DATE_STR, DATE_STR)

        return [list(row) for row in cur.fetchall()]

# TODO: get rid of sql_check (catch reference constraint error)
@salary.route('/<date>', methods=['POST'])
def salary_add(date):
    CODE, DATE, SALARY, nbr = assert_salary_keys(date)
    if nbr <= 0:
        abort(make_response(jsonify(message='Salaire doit être plus grand que zéro'), 400))
    sql_check = "SELECT COUNT(*) AS count FROM Employe WHERE code_mnemotechnique=?; "
    sql = (
        'BEGIN TRAN; '
        'IF EXISTS (SELECT * FROM Salaire WHERE code_employe=? AND date=?) BEGIN '
        'UPDATE Salaire SET montant=? WHERE code_employe=? AND date=?; END '
        'ELSE BEGIN INSERT INTO Salaire(montant, code_employe, date) VALUES (?, ?, ?); END '
        'COMMIT TRAN;'
    )
    DATE_STR = str(DATE.date())
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql_check, CODE)

        if cur.fetchone()[0] <= 0:
            abort(make_response(jsonify(message=f'Aucun employé associé au code "{CODE}"'), 404))
        else:
            cur = conn.cursor()

        cur.execute(sql, (CODE, DATE_STR) + tuple(chain.from_iterable(repeat((SALARY, CODE, DATE_STR), 2))))
        return jsonify(success=True)
