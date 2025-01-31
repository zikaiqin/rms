from os import environ
from dotenv import load_dotenv
from pyodbc import IntegrityError
from flask import Flask, request, abort, make_response, jsonify
from itertools import chain, repeat
from functools import partial
import re
from helpers.database import DataBase, get_connection
from helpers.util import is_valid_code, is_valid_parcel, fetch_while_next, sql_test_str

load_dotenv()
CSTR = environ['DB_CONNECTION']

connection = partial(get_connection, DataBase(CSTR))

app = Flask(__name__)

from routes.staff import staff as staff_route
app.register_blueprint(staff_route, url_prefix='/staff')

from routes.schedule import schedule as schedule_route
app.register_blueprint(schedule_route, url_prefix='/schedule')

from routes.salary import salary as salary_route
app.register_blueprint(salary_route, url_prefix='/salary')

@app.route('/sector', methods=['GET'])
def sector():
    with connection() as conn:
        cur = conn.cursor()
        cur.execute('SELECT nom_secteur FROM Secteur')

        return [row[0] for row in cur.fetchall()]


def parse_parcel_transfer(parcels):
    for parcel in parcels:
        if (
            not isinstance(parcel, dict) or
            not isinstance((number := parcel.get('parcel')), int) or
            (number <= 0 or number >= 100) or
            not isinstance((sector := parcel.get('sector')), str) or
            len(sector) <= 0
        ):
            raise Exception('Arguments mal formatés')
        yield number, sector

# TODO: check if the transferred parcels are actually in the sector to delete
@app.route('/sector/<name>', methods=['DELETE'])
def sector_delete(name):
    transfer = None
    if (DATA := request.get_json(silent=True)) is not None:
        if not isinstance(DATA, list):
            abort(make_response(jsonify(message='Arguments mal formatés'), 400))
        try:
            transfer = tuple(chain.from_iterable(parse_parcel_transfer(DATA)))
        except Exception as e:
            abort(make_response(jsonify(message=str(e)), 400))

    sql_delete = 'DELETE FROM Secteur WHERE nom_secteur=?;'
    with connection() as conn:
        if transfer:
            sql_transfer = (
                'MERGE INTO Parcelle AS P '
                'USING (VALUES {values}) AS T(num_parcelle, nom_secteur) '
                'ON P.num_parcelle = T.num_parcelle '
                'WHEN MATCHED THEN '
                'UPDATE SET P.nom_secteur = T.nom_secteur;'
            ).format(values=', '.join(repeat('(?, ?)', len(DATA))))
            try:
                cur = conn.cursor()
                cur.execute(sql_transfer, transfer)
            except IntegrityError as err:
                conn.rollback()
                if 'FOREIGN KEY' in err.args[1]:
                    abort(make_response(jsonify(message="Le nom d'un ou plusieurs secteurs est incorrect"), 400))
                else:
                    raise err

        cur = conn.cursor()
        cur.execute(sql_delete, name)

        if cur.rowcount == 0:
            conn.rollback()
            abort(make_response(jsonify(message=f'Aucun secteur au nom "{name}"'), 404))

    return jsonify(success=True)


@app.route('/sector', methods=['POST'])
def sector_add():
    if not isinstance(DATA := request.get_json(silent=True), dict):
        abort(make_response(jsonify(message='Arguments mal formatés'), 400))

    if not isinstance(name := DATA.get('name'), str) or len(name) > 50 or not re.search(r'^[A-Za-z\s]+$', name):
        abort(make_response(jsonify(message='Nom secteur manquant ou mal formaté'), 400))

    if not is_valid_code(code := DATA.get('supervisor')):
        abort(make_response(jsonify(message='Code superviseur manquant ou mal formaté'), 400))
    
    sql_parcels = 'SELECT num_parcelle FROM Parcelle ORDER BY num_parcelle ASC; '
    sql_insert_sector = 'INSERT INTO Secteur VALUES (?, ?); '
    sql_insert_parcel = 'INSERT INTO Parcelle VALUES (?, ?); '
    with connection() as conn:
        cur = conn.cursor()
        cur.execute(sql_parcels)

        parcel = 1
        for p, *_ in cur.fetchall():
            if p == parcel:
                parcel += 1
            else:
                break
        try:
            cur = conn.cursor()
            cur.execute(sql_insert_sector + sql_insert_parcel, (name, code, parcel, name,))
        except IntegrityError as err:
            cur.rollback()
            if '"est_chef"' in err.args[1]:
                abort(make_response(jsonify(message=f'Le code {code} ne correspond à aucun chef de secteur'), 400))
            elif 'PRIMARY KEY' in err.args[1]:
                abort(make_response(jsonify(message=f'Il existe déjà un secteur au nom "{name}"'), 409))
            else:
                raise err
        else:
            return jsonify(success=True)


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


@app.route('/supervisor', methods=['GET'])
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
@app.route('/supervisor', methods=['POST'])
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
            not is_valid_parcel(parcel := row.get('parcel'))
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
