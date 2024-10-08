from pyodbc import IntegrityError
from flask import Flask, request, abort, make_response, jsonify
from flask_cors import CORS
from collections import Counter
from contextlib import contextmanager
from itertools import chain, repeat
from datetime import datetime
from math import inf, floor, isnan
from random import random
import re
import heapq
from database import DataBase

DRIVER = 'ODBC Driver 18 for SQL Server'
HOST_NAME = 'localhost'
DB_NAME = 'ProjetSession'
CSTR = (
    f'Driver={DRIVER};'
    f'Server={HOST_NAME};'
    f'Database={DB_NAME};'
    'Encrypt=yes;'
    'TrustServerCertificate=yes;'
    'Trusted_Connection=yes;'
)

DATABASE = DataBase(CSTR)

@contextmanager
def get_connection():
    connection = DATABASE.connect()
    try:
        yield connection
    except Exception as e:
        connection.rollback()
        raise e
    else:
        connection.commit()
    finally:
        connection.close()

def fetch_while_next(cursor):
    yield cursor.fetchall()
    while cursor.nextset():
        yield cursor.fetchall()

def sql_test_str(values_len, table_name, column_name):
    SQL = (
        'SELECT Test.val AS invalid '
        'FROM (VALUES {values}) AS Test(val) '
        'LEFT JOIN {table} AS T ON Test.val = T.{column} '
        'WHERE T.{column} IS NULL; '
    )
    return SQL.format(values=', '.join(repeat('(?)', values_len)), table=table_name, column=column_name)

app = Flask(__name__)
CORS(app)

@app.route('/staff', methods=['GET'])
def staff():
    """
    Staff endpoint

    Returns data: a list of partial details of all employees
    """
    ROLE = request.args['role'] if 'role' in request.args else None
    sql = (
        'SELECT code_mnemotechnique, prenom, nom' +
        (' ' if ROLE else ', fonction, service ') +
        'FROM Employe ' +
        ('WHERE fonction=?' if ROLE else '')
    )
    with get_connection() as connection:
        cur = connection.cursor()
        if ROLE:
            cur.execute(sql, ROLE)
        else:
            cur.execute(sql)
            
        return [list(row) for row in cur.fetchall()]


@app.route('/staff/details', methods=['GET'])
def staff_details():
    """
    Staff details endpoint

    Query parameters:
        - code: code of the employee to be doxed

    Returns status code:
        - 200 if successful
        - 400 if code is malformed or missing
        - 404 if no employee matches the code

    Returns data: a dict with all the attributes of the employee
    """
    # get '?code=...' from query string
    if 'code' not in request.args or len(CODE := request.args['code']) != 3:
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    sql = 'SELECT * FROM Employe LEFT JOIN Gardien ON code_mnemotechnique=code_employe WHERE code_mnemotechnique=?'
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql, CODE)

        # if the query did not return any rows, send 404
        row = cur.fetchone()
        if not row:
            abort(make_response(jsonify(message=f'Aucun employé associé au code "{CODE}"'), 404))

        # names of each column/attribute
        keys = [col[0] for col in cur.description]

        # return a dictionary of all attributes
        res = dict(zip(keys, row))
        del res['code_employe']
        return res


@app.route('/staff/delete', methods=['POST'])
def staff_delete():
    """
    Staff delete endpoint

    Form data properties:
        - code: code of the employee to be deleted

    Returns status code:
        - 200 if successful
        - 400 if code is malformed or missing
        - 404 if none deleted (code not found)
        - 409 if the employee supervises one or more sectors
    """
    # get code from form data
    if 'code' not in request.form or len(CODE := request.form['code']) != 3:
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    sql = 'DELETE FROM Employe WHERE code_mnemotechnique=?'
    with get_connection() as connection:
        try:
            cur = connection.cursor()
            cur.execute(sql, CODE)

        except IntegrityError as err:
            # check if error was a reference constraint violation
            matches = re.search(r'REFERENCE constraint ".*"', err.args[1])
            sql_err = matches.group(0) if matches else ''

            # if trying to delete a sector supervisor, send 409; otherwise, re-raise
            if '"est_chef"' in sql_err:
                msg = f'L\'employé associé au code "{CODE}" ne peut pas être supprimé, car il supervise un ou plusieurs secteurs'
                abort(make_response(jsonify(message=msg), 409))

            raise err

        else:
            # if the query did not change any rows (code belongs to no one), send 404
            if cur.rowcount == 0:
                abort(make_response(jsonify(message=f'Aucun employé associé au code "{CODE}"'), 404))

            return jsonify(success=True)


@app.route('/staff/add', methods=['POST'])
def staff_add():
    """
    Staff add endpoint

    Form data properties: see KEYS

    Returns status code:
        - 200 if successful
        - 400 if missing properties or fails unique check
    """
    # request form data must contain all of these properties
    KEYS = ['code_mnemotechnique', 'numero_avs', 'prenom', 'nom', 'date_naissance',
            'lieu_naissance', 'adresse', 'fonction', 'service', 'grade', 'taux_occupation']
    if 'fonction' not in request.form or request.form['fonction'] != 'Gardien':
        KEYS = KEYS[:-2]

    values = tuple(val if key in request.form and (val := request.form[key]) != '' else None for key in KEYS)
    missing = {k for (k, v) in zip(KEYS, values) if v == None}
    if len(missing) > 0:
        error_msg = 'Attributs manquants:\n' + '\n'.join(('- ' + k) for k in missing)
        abort(make_response(jsonify(message=error_msg), 400))

    param_fragment = ', '.join(f'@{key}=?' for key in KEYS)

    sql = f'SET NOCOUNT ON; EXEC insertionEmploye {param_fragment};'
    with get_connection() as connection:
        try:
            cur = connection.cursor()
            cur.execute(sql, values)
        except IntegrityError as err:
    
            # check if missing values
            matches = re.search(r'(?<=Cannot insert the value NULL into column \').*(?=\', table \'.*\')', err.args[1])
            if col_name := matches and matches.group(0):
                abort(make_response(jsonify(message=f'Attribut "{col_name}" manquant'), 400))

            # check if error was a key violation
            matches = re.search(r'Violation of (PRIMARY|UNIQUE) KEY constraint', err.args[1])
            if sql_err := matches and matches.group(0):
                msg = f'Le {'code mnémotechnique' if 'PRIMARY' in sql_err else 'numéro AVS'} doit être unique'
                abort(make_response(jsonify(message=msg), 400))
            
            matches = re.search(r'CHECK constraint "pourcentage"', err.args[1])
            if sql_err := matches and matches.group(0):
                msg = "Le taux d'occupation doit être entre 10% et 100%"
                abort(make_response(jsonify(message=msg), 400))

            raise err

        else:
            return jsonify(success=True)


@app.route('/sector', methods=['GET'])
def sector():
    sql_parcels = 'SELECT * FROM Parcelle; '
    sql_temp = (
        'SELECT nom_secteur, {key}, prenom, nom {cols} '
        'FROM {table} JOIN Employe ON {key} = code_mnemotechnique; '
    )
    sql_sectors = sql_temp.format(key='code_chef_secteur', table='Secteur', cols='')
    sql_prefs = sql_temp.format(key='code_gardien', table='Preference', cols=', prefere')
    sql = sql_sectors + sql_parcels + sql_prefs

    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql)

        (sectors, parcels, prefs) = fetch_while_next(cur)

        res = {sector: {'supervisor': list(rest), 'parcels': [], 'likes': [], 'dislikes': []} for sector, *rest in sectors}

        for num, sector in parcels:
            res[sector]['parcels'].append(num)

        for sector, *rest in prefs:
            pref = 'likes' if rest[-1] else 'dislikes'
            res[sector][pref].append(list(rest)[:-1])

        return jsonify([{'name': key, **val} for key, val in res.items()])


@app.route('/sector/supervisor', methods=['GET'])
def supervisor():
    sql = (
        "WITH T AS (SELECT code_mnemotechnique, prenom, nom FROM Employe WHERE fonction='Chef de secteur') "
        "SELECT code_mnemotechnique, prenom, nom, nom_secteur "
        "FROM T LEFT JOIN Secteur ON code_mnemotechnique = code_chef_secteur"
    )
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql)

        rows = cur.fetchall()
        supervisors = {}

        for [code, fname, lname, sector] in rows:
            s = supervisors.setdefault(code, { 'fname': fname, 'lname': lname, 'sectors': [] })
            if sector:
                s['sectors'].append(sector)

        return [[code, r['fname'], r['lname'], r['sectors']] for [code, r] in supervisors.items()]


@app.route('/sector/supervisor', methods=['POST'])
def supervisor_edit():
    try:
        DATA = request.get_json()
        if not DATA or not isinstance(DATA, list) or len(DATA) <= 0:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    supervisors = set()
    sectors = set()
    for row in DATA:
        if (
            'sector' not in row or
            'supervisor' not in row or
            not (sector := row['sector']) or
            not isinstance(sector, str) or
            not isinstance(supervisor := row['supervisor'], str) or
            len(supervisor) != 3
        ):
            abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))
        if sector in sectors:
            abort(make_response(jsonify(message='Un seul superviseur par secteur'), 400))
        else:
            sectors.add(sector)
            supervisors.add(supervisor)

    sql_check = sql_test_str(len(supervisors), 'ChefDeSecteur', 'code_employe') + sql_test_str(len(sectors), 'Secteur', 'nom_secteur')

    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql_check, tuple(chain(supervisors, sectors)))

        (invalid_super, invalid_sector) = fetch_while_next(cur)

        if len(invalid_super) > 0 or len(invalid_sector) > 0:
            error_msg = 'Les arguments suivants sont invalides:\n\n'
            super_msg = ('Chefs:\n' + '\n'.join(('- ' + v[0]) for v in invalid_super)) if len(invalid_super) > 0 else ''
            sector_msg = ('Secteurs:\n' + '\n'.join(('- ' + v[0]) for v in invalid_sector)) if len(invalid_sector) > 0 else ''
            abort(make_response(jsonify(message=(error_msg + '\n'.join((super_msg, sector_msg)))), 400))

        sql = 'UPDATE Secteur SET code_chef_secteur=? WHERE nom_secteur=?'
        cur = connection.cursor()
        cur.executemany(sql, [(s['supervisor'], s['sector']) for s in DATA])

        return jsonify(success=True)


@app.route('/sector/preference', methods=['GET'])
def preferences():
    # get '?code=...' from query string
    if 'sector' not in request.args or not (SECTOR := request.args['sector']) or len(SECTOR) <= 0:
        abort(make_response(jsonify(message='Nom de secteur manquant'), 400))

    sql_check = "SELECT COUNT(*) AS count FROM Secteur WHERE nom_secteur=?; "
    sql = (
        "WITH T AS (SELECT code_mnemotechnique, prenom, nom FROM Employe WHERE fonction='Gardien'), "
        "S AS (SELECT * FROM Preference WHERE nom_secteur=?) "
        "SELECT code_mnemotechnique, prenom, nom, prefere "
        "FROM T LEFT JOIN S ON code_mnemotechnique = code_gardien"
    )
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql_check + sql, SECTOR, SECTOR)

        count = next(gen := fetch_while_next(cur))
        if not count or count[0][0] < 1:
            abort(make_response(jsonify(message=f'Aucun secteur au nom {SECTOR}'), 404))

        return [list(row) for row in next(gen)]


@app.route('/sector/preference', methods=['POST'])
def preferences_edit():
    try:
        DATA = request.get_json()
        if (
            not DATA or
            'sector' not in DATA or
            'preferences' not in DATA or
            not (SECTOR := DATA['sector']) or
            not isinstance(SECTOR, str) or
            not isinstance(preferences := DATA['preferences'], list) or
            len(DATA['preferences']) <= 0
        ):
            raise Exception()
    except:
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    guards = set()
    for row in preferences:
        if (
            'code' not in row or
            'prefers' not in row or
            not (isinstance(pref := row['prefers'], bool) or pref is None) or
            not isinstance(code := row['code'], str) or
            len(code) != 3
        ):
            abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))
        if row['code'] in guards:
            abort(make_response(jsonify(message='Une seule préférence par gardien'), 400))
        else:
            guards.add(row['code'])

    sql_check_sector = "SELECT COUNT(*) AS count FROM Secteur WHERE nom_secteur=?; "
    sql_check_guards = sql_test_str(len(guards), 'Gardien', 'code_employe')

    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql_check_sector + sql_check_guards, (SECTOR,) + tuple(guards))
        (sector_count, invalid_guards) = fetch_while_next(cur)

        if not sector_count or sector_count[0][0] < 1:
            abort(make_response(jsonify(message=f'Aucun secteur au nom {SECTOR}'), 404))

        if len(invalid_guards) > 0:
            error_msg = "Les codes suivants n'appartiennent à aucun gardien:\n" + ', '.join(('- ' + row[0]) for row in invalid_guards)
            abort(make_response(jsonify(message=error_msg), 400))

        sql = (
            'BEGIN TRAN; '
            'IF (? IS NULL) BEGIN '
            'DELETE FROM Preference WHERE nom_secteur=? AND code_gardien=?; END; '
            'ELSE BEGIN '
            'UPDATE Preference SET prefere=? WHERE nom_secteur=? AND code_gardien=?; '
            'IF (@@ROWCOUNT = 0) BEGIN '
            'INSERT INTO Preference(prefere, nom_secteur, code_gardien) VALUES (?, ?, ?); END; '
            'END; '
            'COMMIT TRAN;'
        )
        cur = connection.cursor()
        cur.executemany(sql, [(p['prefers'], SECTOR, p['code']) * 3 for p in preferences])

        return jsonify(success=True)


@app.route('/parcel', methods=['GET'])
def parcel():
    sql = (
        'SELECT Secteur.nom_secteur, num_parcelle FROM Secteur LEFT JOIN Parcelle '
        'ON Secteur.nom_secteur = Parcelle.nom_secteur'
    )
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql)

        res = {}
        for [sector, parcel] in cur.fetchall():
            s = res.setdefault(sector, [])
            if parcel is not None:
                s.append(parcel)

        return res


@app.route('/parcel', methods=['POST'])
def parcel_edit():
    try:
        DATA = request.get_json()
        if not DATA or not isinstance(DATA, list) or len(DATA) <= 0:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    parcels = set()
    sectors = set()
    for row in DATA:
        if (
            'parcel' not in row or
            'sector' not in row or
            not ((sector := row['sector']) is None or (isinstance(sector, str) and sector != '')) or
            not isinstance(parcel := row['parcel'], int) or
            not (0 < parcel and parcel < 100)
        ):
            abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))
        if parcel in parcels:
            abort(make_response(jsonify(message='Une seule modification par secteur'), 400))
        else:
            parcels.add(parcel)
            if sector is not None:
                sectors.add(sector)

    with get_connection() as connection:
        cur = connection.cursor()

        if len(sectors) > 0:
            sql_check = sql_test_str(len(sectors), 'Secteur', 'nom_secteur')
            cur.execute(sql_check, tuple(sectors))
            invalid_sectors = cur.fetchall()

            if len(invalid_sectors) > 0:
                error_msg = "Les secteurs suivants n'existent pas:\n" + '\n'.join(('- ' + row[0]) for row in invalid_sectors)
                abort(make_response(jsonify(message=error_msg), 400))
            else:
                cur = connection.cursor()

        sql = (
            'BEGIN TRAN; '
            'IF (? IS NULL) BEGIN '
            'DELETE FROM Parcelle WHERE num_parcelle=?; END; '
            'ELSE BEGIN '
            'UPDATE Parcelle SET nom_secteur=? WHERE num_parcelle=?; '
            'IF (@@ROWCOUNT = 0) BEGIN '
            'INSERT INTO Parcelle(nom_secteur, num_parcelle) VALUES (?, ?); END; '
            'END; '
            'COMMIT TRAN;'
        )
        cur.executemany(sql, [(p['sector'], p['parcel']) * 3 for p in DATA])

        return jsonify(success=True)


@app.route('/salary', methods=['GET'])
def salary():
    # get '?date=...' from query string
    if 'date' not in request.args or not (DATE := datetime.strptime(request.args['date'], '%Y-%m')):
        abort(make_response(jsonify(message='Date mal formatée'), 400))

    sql = 'SELECT * FROM salairesDuMois(?) ORDER BY code_mnemotechnique'

    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql, str(DATE.date()))

        return [list(row) for row in cur.fetchall()]


def assert_salary_keys():
    try:
        # get code, salary from form data
        keys = ['code', 'date', 'salary']
        CODE, datestr, SALARY = (request.form[key] for key in keys)
        if not CODE or len(CODE) != 3:
            raise Exception('Code mnémotechnique manquant ou mal formaté')
        if not datestr or not (DATE := datetime.strptime(datestr, '%Y-%m')):
            raise Exception('Date manquante ou mal formatée')
        if not SALARY or isnan(nbr := float(SALARY)) or nbr < 0:
            raise Exception('Salaire manquant ou mal formaté')
    except ValueError:
        abort(make_response(jsonify(message='Salaire mal formaté'), 400))
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 400))
    return CODE, DATE, SALARY, nbr, datestr

@app.route('/salary/edit', methods=['POST'])
def salary_edit():
    CODE, DATE, SALARY, nbr, datestr = assert_salary_keys()
    with get_connection() as connection:
        cur = connection.cursor()
        if (nbr == 0):
            sql = 'DELETE FROM Salaire WHERE code_employe=? AND date=?'
            cur.execute(sql, CODE, str(DATE.date()))
        else:
            sql = 'UPDATE Salaire SET montant=? WHERE code_employe=? AND date=?'
            cur.execute(sql, SALARY, CODE, str(DATE.date()))

        if cur.rowcount == 0:
            abort(make_response(jsonify(message=f'Aucun salaire associé à l\'employé "{CODE}" le {datestr}'), 404))

        return jsonify(success=True)


@app.route('/salary/options', methods=['GET'])
def salary_options():
    # get '?date=...' from query string
    if 'date' not in request.args or not (DATE := datetime.strptime(request.args['date'], '%Y-%m')):
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
    DATE_STR = str(DATE.date())
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql, DATE_STR, DATE_STR)

        return [list(row) for row in cur.fetchall()]


@app.route('/salary/add', methods=['POST'])
def salary_add():
    CODE, DATE, SALARY, nbr, _ = assert_salary_keys()
    if nbr == 0:
        abort(make_response(jsonify(message='Salaire doit être plus grand que zéro'), 400))
    sql = (
        'BEGIN TRAN; '
        'IF EXISTS (SELECT * FROM Salaire WHERE code_employe=? AND date=?) BEGIN '
        'UPDATE Salaire SET montant=? WHERE code_employe=? AND date=?; END '
        'ELSE BEGIN INSERT INTO Salaire(date, montant, code_employe) VALUES (?, ?, ?); END '
        'COMMIT TRAN;'
    )
    DATE_STR = str(DATE.date())
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql, CODE, DATE_STR, SALARY, CODE, DATE_STR, DATE_STR, SALARY, CODE)

        if cur.rowcount == 0:
            abort(500)

        return jsonify(success=True)


@app.route('/schedule/<view>/options', methods=['GET'])
def schedule_options(view):
    match view:
        case 'sector':
            sql ='SELECT DISTINCT nom_secteur FROM Parcelle'
        case 'staff':
            sql = "SELECT code_mnemotechnique, prenom, nom FROM Employe WHERE fonction='Gardien'"
        case _:
            abort(404)
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql)

        return [(row[0] if view == 'sector' else list(row)) for row in cur.fetchall()]


@app.route('/schedule/sector', methods=['GET'])
def schedule_sector():
    try:
        date, sector = request.args['date'], request.args['sector']
        if not date or not sector:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Arguments manquants'), 400))

    sql_header = 'SELECT num_parcelle FROM Parcelle WHERE nom_secteur=?; '
    sql = (
        "WITH T AS ("
        "SELECT FORMAT(dt_debut, 'hh:mm') AS time, Parcelle.num_parcelle as num_parcelle, code_gardien "
        "FROM Surveillance JOIN Parcelle "
        "ON Surveillance.num_parcelle = Parcelle.num_parcelle "
        "WHERE CONVERT(DATE, dt_debut) = ? "
        "AND nom_secteur=?) "
        "SELECT time, num_parcelle, code_gardien, prenom, nom "
        "FROM T JOIN Employe "
        "ON T.code_gardien = Employe.code_mnemotechnique"
    )
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql_header + sql, sector, date, sector)

        header = next(gen := fetch_while_next(cur))
        if not header:
            abort(make_response(jsonify(message='Ce secteur n\'a pas de parcelles'), 404))

        res = {
            'header': [row[0] for row in header],
            'data': [list(row) for row in next(gen)]
        }
        return res


@app.route('/schedule/staff', methods=['GET'])
def schedule_staff():
    try:
        keys = ['code', 'start', 'end']
        code, start, end = (request.args[key] for key in keys)
        if not code or not start or not end:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Arguments manquants'), 400))

    sql_check = "SELECT COUNT(*) AS count FROM Gardien WHERE code_employe=?; "
    sql = (
        "SELECT CONVERT(VARCHAR(20), dt_debut, 120) AS dt_debut, Parcelle.num_parcelle as num_parcelle, nom_secteur "
        "FROM Surveillance JOIN Parcelle "
        "ON Surveillance.num_parcelle = Parcelle.num_parcelle "
        "WHERE code_gardien=? "
        "AND dt_debut BETWEEN ? AND ?"
    )
    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql_check + sql, code, code, start, end)

        count = next(gen := fetch_while_next(cur))
        if not count or count[0][0] < 1:
            abort(make_response(jsonify(message=f'Aucun gardien associé au code {code}'), 404))
        
        return [list(row) for row in next(gen)]


@app.route('/schedule/generate/week', methods=['POST'])
def schedule_generate_week():
    try:
        MONDAY = datetime.strptime(request.form['week'] + '-1', '%Y-W%W-%w') if 'week' in request.form else None
        if not MONDAY:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    sql_rates = "SELECT code_employe, taux_occupation FROM Gardien JOIN Employe on code_employe=code_mnemotechnique; "
    sql_parcels = "SELECT num_parcelle, nom_secteur FROM Parcelle; "
    sql_prefs = "SELECT nom_secteur, code_gardien, prefere FROM Preference; "

    WORK_DAY = 8
    WORK_WEEK = 40

    with get_connection() as connection:
        cur = connection.cursor()
        cur.execute(sql_rates + sql_parcels + sql_prefs)

        (rates, parcels, prefs) = fetch_while_next(cur)

    # unhinged
    prefs_map = {}
    for (sector, guard, prefers) in prefs:
        s: dict[str, set] = prefs_map.setdefault(sector, {'likes': set(), 'dislikes': set()})
        if prefers:
            s['likes'].add(guard)
        else:
            s['dislikes'].add(guard)

    sectors = Counter()
    for (_, sector) in parcels:
        sectors[sector] += WORK_DAY

    guards = [(-inf, -floor(WORK_WEEK * float(rate) / 100), 0, random(), code) for (code, rate) in rates]
    heapq.heapify(guards)

    days = [None] * 7

    for i in range(len(days)):
        day_data = dict((k, Counter()) for k in sectors)
        to_fill = set(prefs_map.keys())
        sector_hours = Counter()
        guard_hours = Counter()
        discard = []

        while len(guards) > 0 and len(to_fill) > 0:
            (_, target, actual, _, code) = heapq.heappop(guards)
            if target + actual == 0:
                continue

            comp = []
            for s in to_fill:
                pref = prefs_map[s]
                multiplier = len(pref['dislikes']) / likes if (likes := len(pref['likes'])) > 0 else inf
                if code in pref['likes']:
                    multiplier = 1 / multiplier if multiplier > 0 else inf
                comp.append((-multiplier * (sectors[s] / cur_count) if (cur_count := sector_hours[s]) > 0 else -inf, -sectors[s], s))

            (_, _, sector) = min(comp)
            hours = min(WORK_DAY, -(actual + target), sectors[sector] - sector_hours[sector])

            day_data[sector][code] += hours
            sector_hours[sector] += hours

            if sector_hours[sector] >= sectors[sector]:
                to_fill.remove(sector)

            guard_hours[code] += hours
            new_actual = actual + hours
            new_ratio = target / new_actual if new_actual > 0 else inf

            if guard_hours[code] >= WORK_DAY:
                discard.append((new_ratio, target, new_actual, random(), code))
            else:
                heapq.heappush(guards, (new_ratio, target, new_actual, random(), code))

        guards.extend(discard)
        heapq.heapify(guards)
        days[i] = day_data

    count = Counter()
    for d in days:
        for di in d.values():
            for code, hours in di.items():
                count[code] += hours

    return {
        'res': days,
        'test': [{'code': code, 'expected': floor(WORK_WEEK * float(rate) / 100), 'actual': count[code]} for (code, rate) in rates],
    }
