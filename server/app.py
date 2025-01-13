from pyodbc import IntegrityError
from flask import Flask, request, abort, make_response, jsonify
from flask_cors import CORS
from itertools import chain, repeat
from functools import partial
from datetime import datetime, timedelta
from math import isnan
import re
from helpers.database import DataBase, get_connection
from helpers.util import is_valid_code, is_valid_parcel, fetch_while_next, sql_test_str

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

connection = partial(get_connection, DataBase(CSTR))

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
    with connection() as conn:
        cur = conn.cursor()
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
    if not is_valid_code(CODE := request.args.get('code')):
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    sql = 'SELECT * FROM Employe LEFT JOIN Gardien ON code_mnemotechnique=code_employe WHERE code_mnemotechnique=?'
    with connection() as conn:
        cur = conn.cursor()
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
    if not is_valid_code(CODE := request.form.get('code')):
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    sql = 'DELETE FROM Employe WHERE code_mnemotechnique=?'
    with connection() as conn:
        try:
            cur = conn.cursor()
            cur.execute(sql, CODE)

        except IntegrityError as err:
            # check if error was a reference constraint violation
            matches = re.search(r'REFERENCE constraint "(.*?)"', err.args[1])
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

# TODO: change SIN type to CHAR(5)
# TODO: limit name, address, birthplace length
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
    KEYS = ('code_mnemotechnique', 'numero_avs', 'prenom', 'nom', 'date_naissance',
            'lieu_naissance', 'adresse', 'fonction', 'service')
    if request.form.get('fonction') == 'Gardien':
        KEYS += ('taux_occupation', )

    values = tuple(request.form.get(key) for key in KEYS)
    missing = tuple(k for (k, v) in zip(KEYS, values) if not v)
    if len(missing) > 0:
        error_msg = 'Attributs manquants:\n' + '\n'.join(('- ' + k) for k in missing)
        abort(make_response(jsonify(message=error_msg), 400))

    if not is_valid_code(request.form['code_mnemotechnique']):
        abort(make_response(jsonify(message='Code mnémotechnique mal formaté'), 400))
    try:
        if 'taux_occupation' in KEYS and isnan(float(request.form['taux_occupation'])):
            raise Exception()
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))
    try:
        datetime.strptime(request.form['date_naissance'], '%Y-%m-%d')
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))

    param_fragment = ', '.join(f'@{key}=?' for key in KEYS)

    sql = f'SET NOCOUNT ON; EXEC insertionEmploye {param_fragment};'
    with connection() as conn:
        try:
            cur = conn.cursor()
            cur.execute(sql, values)
        except IntegrityError as err:
            # check if error was a key violation
            matches = re.search(r'Violation of (PRIMARY|UNIQUE) KEY constraint', err.args[1])
            if (sql_err := matches) and matches.group(0):
                msg = f'Le {'code mnémotechnique' if 'PRIMARY' in sql_err else 'numéro AVS'} doit être unique'
                abort(make_response(jsonify(message=msg), 400))
            
            matches = re.search(r'CHECK constraint "pourcentage"', err.args[1])
            if (sql_err := matches) and matches.group(0):
                msg = "Le taux d'occupation doit être entre 10% et 100%"
                abort(make_response(jsonify(message=msg), 400))

            raise err

        else:
            return jsonify(success=True)

# TODO: implement /staff/edit

@app.route('/sector', methods=['GET'])
def sector():
    with connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT nom_secteur FROM Secteur')

        return [row[0] for row in cur.fetchall()]


@app.route('/sector/details', methods=['GET'])
def sector_details():
    sql_parcels = 'SELECT * FROM Parcelle; '
    sql_temp = (
        'SELECT nom_secteur, {key}, prenom, nom {cols} '
        'FROM {table} JOIN Employe ON {key} = code_mnemotechnique; '
    )
    sql_sectors = sql_temp.format(key='code_chef_secteur', table='Secteur', cols='')
    sql_prefs = sql_temp.format(key='code_gardien', table='Preference', cols=', prefere')
    sql = sql_sectors + sql_parcels + sql_prefs

    with connection() as conn:
        cur = conn.cursor()
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
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql)

        rows = cur.fetchall()
        supervisors = {}

        for [code, fname, lname, sector] in rows:
            s = supervisors.setdefault(code, { 'fname': fname, 'lname': lname, 'sectors': [] })
            if sector:
                s['sectors'].append(sector)

        return [[code, r['fname'], r['lname'], r['sectors']] for [code, r] in supervisors.items()]

# TODO: get rid of sql_check? (low rowcount -> rollback, catch reference constraint error)
@app.route('/sector/supervisor', methods=['POST'])
def supervisor_edit():
    DATA = request.get_json(silent=True)
    if not isinstance(DATA, list) or len(DATA) <= 0:
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    supervisors = set()
    sectors = set()
    for row in DATA:
        if (
            not isinstance(row, dict) or
            not (sector := row.get('sector')) or
            not isinstance(sector , str) or
            not is_valid_code(supervisor := row.get('supervisor'))
        ):
            abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))
        if sector in sectors:
            abort(make_response(jsonify(message='Un seul superviseur par secteur'), 400))
        else:
            sectors.add(sector)
            supervisors.add(supervisor)

    sql_check = sql_test_str(len(supervisors), 'ChefDeSecteur', 'code_employe') + sql_test_str(len(sectors), 'Secteur', 'nom_secteur')

    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql_check, tuple(chain(supervisors, sectors)))

        (invalid_super, invalid_sector) = fetch_while_next(cur)

        if len(invalid_super) > 0 or len(invalid_sector) > 0:
            error_msg = 'Les arguments suivants sont invalides:\n\n'
            super_msg = ('Chefs:\n' + '\n'.join(('- ' + v[0]) for v in invalid_super)) if len(invalid_super) > 0 else ''
            sector_msg = ('Secteurs:\n' + '\n'.join(('- ' + v[0]) for v in invalid_sector)) if len(invalid_sector) > 0 else ''
            abort(make_response(jsonify(message=(error_msg + '\n'.join((super_msg, sector_msg)))), 400))

        sql = 'UPDATE Secteur SET code_chef_secteur=? WHERE nom_secteur=?'
        cur = conn.cursor()
        cur.executemany(sql, [(s['supervisor'], s['sector']) for s in DATA])

        return jsonify(success=True)


@app.route('/sector/preference', methods=['GET'])
def preferences():
    # get '?code=...' from query string
    if not (SECTOR := request.args.get('sector')) or not isinstance(SECTOR, str):
        abort(make_response(jsonify(message='Nom de secteur manquant'), 400))

    sql_check = "SELECT COUNT(*) AS count FROM Secteur WHERE nom_secteur=?; "
    sql = (
        "WITH T AS (SELECT code_mnemotechnique, prenom, nom FROM Employe WHERE fonction='Gardien'), "
        "S AS (SELECT * FROM Preference WHERE nom_secteur=?) "
        "SELECT code_mnemotechnique, prenom, nom, prefere "
        "FROM T LEFT JOIN S ON code_mnemotechnique = code_gardien"
    )
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql_check + sql, SECTOR, SECTOR)

        count = next(gen := fetch_while_next(cur))
        if not count or count[0][0] < 1:
            abort(make_response(jsonify(message=f'Aucun secteur au nom {SECTOR}'), 404))

        return [list(row) for row in next(gen)]

# TODO: get rid of sql_check? (low rowcount -> rollback, catch reference constraint error)
@app.route('/sector/preference', methods=['POST'])
def preferences_edit():
    DATA = request.get_json(silent=True)
    if (
        not isinstance(DATA, dict) or
        not (SECTOR := DATA.get('sector')) or
        not isinstance(SECTOR, str) or
        not isinstance(preferences := DATA.get('preferences'), list) or
        len(preferences) <= 0
    ):
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    guards = set()
    for row in preferences:
        if (
            not isinstance(row, dict) or
            'prefers' not in row or
            not ((pref := row['prefers']) is None or isinstance(pref, bool)) or
            not is_valid_code(row.get('code'))
        ):
            abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))
        if row['code'] in guards:
            abort(make_response(jsonify(message='Une seule préférence par gardien'), 400))
        else:
            guards.add(row['code'])

    sql_check_sector = "SELECT COUNT(*) AS count FROM Secteur WHERE nom_secteur=?; "
    sql_check_guards = sql_test_str(len(guards), 'Gardien', 'code_employe')

    with connection() as conn:
        cur = conn.cursor()
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
        cur = conn.cursor()
        cur.executemany(sql, [(p['prefers'], SECTOR, p['code']) * 3 for p in preferences])

        return jsonify(success=True)


@app.route('/parcel', methods=['GET'])
def parcel():
    sql = (
        'SELECT Secteur.nom_secteur, num_parcelle FROM Secteur LEFT JOIN Parcelle '
        'ON Secteur.nom_secteur = Parcelle.nom_secteur'
    )
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql)

        res = {}
        for [sector, parcel] in cur.fetchall():
            s = res.setdefault(sector, [])
            if parcel is not None:
                s.append(parcel)

        return res

# TODO: Assert sector contains at least one parcel (rollback?)
# TODO: Rollback on low rowcount?
# TODO: get rid of sql_check?? (catch reference constraint error)
@app.route('/parcel', methods=['POST'])
def parcel_edit():
    DATA = request.get_json(silent=True)
    if not isinstance(DATA, list) or len(DATA) <= 0:
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    parcels = set()
    sectors = set()
    for row in DATA:
        if (
            not isinstance(row, dict) or
            not 'sector' in row or
            not ((sector := row['sector']) is None or (isinstance(sector, str) and sector != '')) or
            not is_valid_parcel(parcel := row.get('parcel', None))
        ):
            abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))
        if parcel in parcels:
            abort(make_response(jsonify(message='Une seule modification par secteur'), 400))
        else:
            parcels.add(parcel)
            if sector is not None:
                sectors.add(sector)

    with connection() as conn:
        cur = conn.cursor()

        if len(sectors) > 0:
            sql_check = sql_test_str(len(sectors), 'Secteur', 'nom_secteur')
            cur.execute(sql_check, tuple(sectors))
            invalid_sectors = cur.fetchall()

            if len(invalid_sectors) > 0:
                error_msg = "Les secteurs suivants n'existent pas:\n" + '\n'.join(('- ' + row[0]) for row in invalid_sectors)
                abort(make_response(jsonify(message=error_msg), 400))
            else:
                cur = conn.cursor()

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
    if not (date := request.args.get('date')):
        abort(make_response(jsonify(message='Arguments manquants'), 400))
    try:
        DATE_STR = str(datetime.strptime(date, '%Y-%m').date())
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))

    sql = 'SELECT * FROM salairesDuMois(?) ORDER BY code_mnemotechnique'
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, DATE_STR)

        return [list(row) for row in cur.fetchall()]


def assert_salary_keys():
    try:
        # get code, salary from form data
        CODE, datestr, SALARY = (request.form.get(key) for key in ('code', 'date', 'salary'))
        if not is_valid_code(CODE):
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
    with connection() as conn:
        cur = conn.cursor()
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
    if not (date := request.args.get('date')):
        abort(make_response(jsonify(message='Arguments manquants'), 400))
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
@app.route('/salary/add', methods=['POST'])
def salary_add():
    CODE, DATE, SALARY, nbr, _ = assert_salary_keys()
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


@app.route('/schedule/<date>', methods=['GET'])
def schedule(date):
    try:
        DATE = datetime.strptime(date, '%Y-%m-%d').date()
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))

    sql_schedule = (
        "SELECT FORMAT(dt_debut, 'HH:mm') AS time, code_gardien, num_parcelle "
        "FROM Surveillance "
        "WHERE CONVERT(DATE, dt_debut) = ? "
        "ORDER BY dt_debut ASC; "
    )
    sql_sector = (
        'SELECT Secteur.nom_secteur, num_parcelle FROM Secteur JOIN Parcelle '
        'ON Secteur.nom_secteur = Parcelle.nom_secteur'
    )
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql_schedule + sql_sector, DATE)

        schedule = {}
        for [time, code, parcel] in next(gen := fetch_while_next(cur)):
            schedule.setdefault(parcel, []).append([time, code])

        res = {}
        for [sector, parcel] in next(gen):
            s = res.setdefault(sector, {})
            s[parcel] = schedule[parcel] if parcel in schedule else []
        return res


def assert_schedule_keys(schedule: list):
    for slot in schedule:
        if not isinstance(slot, dict):
            abort(make_response(jsonify(message='Arguments mal formatés'), 400))
        if 'code' not in slot or (
            (CODE := slot['code']) is not None and
            not is_valid_code(CODE)
        ):
            abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))
        if not is_valid_parcel(PARCEL := slot.get('parcel', None)):
            abort(make_response(jsonify(message='Numéro de parcelle manquant ou mal formaté'), 400))
        try:
            START = datetime.strptime(slot.get('time', None), '%Y-%m-%dT%H:%M')
        except:
            abort(make_response(jsonify(message='Dates manquantes ou mal formatées'), 400))
        yield CODE, PARCEL, START, START + timedelta(hours=1)

# could do separate checks for codes and parcels for better error feedback
@app.route('/schedule', methods=['POST'])
def schedule_edit():
    DATA = request.get_json(silent=True)
    if not isinstance(DATA, list) or len(DATA) <= 0:
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    sanitized = tuple(assert_schedule_keys(DATA))
    del_list = tuple(tup[1:] for tup in filter(lambda t: t[0] is None, sanitized))
    ins_list = tuple(filter(lambda t: t[0] is not None, sanitized))

    with connection() as conn:
        cur = conn.cursor()
        if len(del_list) > 0:
            sql_del = 'DELETE FROM Surveillance WHERE num_parcelle=? AND dt_debut=? AND dt_fin=?;'
            cur.executemany(sql_del, del_list)
        if len(ins_list) > 0:
            sql_ins = (
                'MERGE INTO Surveillance AS S '
                'USING (VALUES {values}) AS Ins(code_gardien, num_parcelle, dt_debut, dt_fin) '
                'ON S.num_parcelle = Ins.num_parcelle '
                'AND S.dt_debut = Ins.dt_debut '
                'AND S.dt_fin = Ins.dt_fin '
                'WHEN MATCHED THEN '
                'UPDATE SET S.code_gardien = Ins.code_gardien '
                'WHEN NOT MATCHED BY TARGET THEN '
                'INSERT (code_gardien, num_parcelle, dt_debut, dt_fin) '
                'VALUES (Ins.code_gardien, Ins.num_parcelle, Ins.dt_debut, Ins.dt_fin);'
            ).format(values=', '.join(repeat('(?, ?, ?, ?)', len(ins_list))))
            try:
                cur.execute(sql_ins, tuple(chain.from_iterable(ins_list)))
            except IntegrityError as err:
                cur.rollback()
                print(err.args)
                if 'PRIMARY KEY' in err.args[1]:
                    matches = re.search(r'duplicate key value is \((.*?)\)', err.args[1])
                    err_vals = matches.group(1) if matches else None
                    err_msg = (
                        'Le gardien {} est déjà assigné à une autre surveillance entre {} et {}'.format(*err_vals.split(', '))
                        if err_vals
                        else "Il y a un conflit d'horaire entre un ou plusieurs gardiens"
                    )
                    abort(make_response(jsonify(message=err_msg), 400))
                elif 'CHECK constraint' in err.args[1]:
                    abort(make_response(jsonify(message='Les heures spécifiées sont invalides'), 400))
                elif 'FOREIGN KEY' in err.args[1]:
                    if 'dbo.Gardien' in err.args[1]:
                        abort(make_response(jsonify(message='Un ou plusieurs codes mnémotechniques sont invalides'), 400))
                    elif 'dbo.Parcelle' in err.args[1]:
                        abort(make_response(jsonify(message='Un ou plusieurs numéros de parcelle sont invalides'), 400))
                else:
                    raise err

        return jsonify(success=True)


@app.route('/schedule/sector', methods=['GET'])
def schedule_sector():
    DATE, SECTOR = (request.args.get(key) for key in ('date', 'sector'))
    if not DATE or not SECTOR:
        abort(make_response(jsonify(message='Arguments manquants'), 400))
    try:
        datetime.strptime(DATE, '%Y-%m-%d')
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))

    sql_header = 'SELECT num_parcelle FROM Parcelle WHERE nom_secteur=?; '
    sql = (
        "WITH T AS ("
        "SELECT FORMAT(dt_debut, 'HH:mm') AS time, Parcelle.num_parcelle as num_parcelle, code_gardien "
        "FROM Surveillance JOIN Parcelle "
        "ON Surveillance.num_parcelle = Parcelle.num_parcelle "
        "WHERE CONVERT(DATE, dt_debut) = ? "
        "AND nom_secteur=?) "
        "SELECT time, num_parcelle, code_gardien, prenom, nom "
        "FROM T JOIN Employe "
        "ON T.code_gardien = Employe.code_mnemotechnique"
    )
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql_header + sql, SECTOR, DATE, SECTOR)

        header = next(gen := fetch_while_next(cur))
        if not header:
            abort(make_response(jsonify(message=f'Aucun secteur au nom "{SECTOR}"'), 404))

        res = {
            'header': [row[0] for row in header],
            'data': [list(row) for row in next(gen)]
        }
        return res


@app.route('/schedule/staff', methods=['GET'])
def schedule_staff():
    CODE, START, END = (request.args.get(key) for key in ('code', 'start', 'end'))
    if not all((CODE, START, END, )):
        abort(make_response(jsonify(message='Arguments manquants'), 400))
    if not is_valid_code(CODE):
        abort(make_response(jsonify(message='Code mal formaté'), 400))
    try:
        start_date, end_date = (datetime.strptime(arg, '%Y-%m-%d') for arg in (START, END))
    except:
        abort(make_response(jsonify(message='Une ou plusieurs dates sont mal formatées'), 400))
    if end_date <= start_date:
        abort(make_response(jsonify(message='La date de début doit être après la date de fin'), 400))

    sql_check = "SELECT COUNT(*) AS count FROM Gardien WHERE code_employe=?; "
    sql = (
        "SELECT FORMAT(dt_debut, 'yyyy-MM-dd\"T\"HH:mm') AS time, Parcelle.num_parcelle as num_parcelle, nom_secteur "
        "FROM Surveillance JOIN Parcelle "
        "ON Surveillance.num_parcelle = Parcelle.num_parcelle "
        "WHERE code_gardien=? "
        "AND dt_debut BETWEEN ? AND ?"
    )
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql_check + sql, CODE, CODE, START, END)

        count = next(gen := fetch_while_next(cur))
        if not count or count[0][0] < 1:
            abort(make_response(jsonify(message=f'Aucun gardien associé au code {CODE}'), 404))
        
        return [list(row) for row in next(gen)]
