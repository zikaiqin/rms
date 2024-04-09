import pyodbc
from flask import Flask, request, abort, make_response, jsonify
from flask_cors import CORS
from datetime import datetime
import re

DRIVER = 'ODBC Driver 18 for SQL Server'
HOST_NAME = 'localhost'
DB_NAME = 'ProjetSession'
conn_str = (
    f'Driver={DRIVER};'
    f'Server={HOST_NAME};'
    f'Database={DB_NAME};'
    'Encrypt=yes;'
    'TrustServerCertificate=yes;'
    'Trusted_Connection=yes;'
)
cnxn = pyodbc.connect(conn_str)
app = Flask(__name__)
CORS(app)

def fetch_while_next(c):
    yield c.fetchall()
    while c.nextset():
        yield c.fetchall()

@app.route('/staff', methods=['GET'])
def staff():
    """
    Staff endpoint

    Returns data: a list of partial details of all employees
    """
    sql = 'SELECT code_mnemotechnique, prenom, COALESCE(nom_marital, nom) AS nom, fonction, service FROM Employe'
    try:
        cur = cnxn.cursor()
        cur.execute(sql)
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 500))
        
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
    try:
        # get '?code=...' from query string
        CODE = request.args['code']
        if not CODE or len(CODE) != 3:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    sql = 'SELECT * FROM Employe LEFT JOIN Gardien ON code_mnemotechnique=code_employe WHERE code_mnemotechnique=?'
    try:
        cur = cnxn.cursor()
        cur.execute(sql, CODE)
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 500))

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
    try:
        # get code from form data
        CODE = request.form['code']
        if not CODE or len(CODE) != 3:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    sql = 'DELETE FROM Employe WHERE code_mnemotechnique=?'
    try:
        cur = cnxn.cursor()
        cur.execute(sql, CODE)
    except pyodbc.IntegrityError as err:

        # check if error was a reference constraint violation
        matches = re.search(r'REFERENCE constraint ".*"', err.args[1])
        sql_err = matches.group(0) if matches else ''

        # if trying to delete a sector supervisor, send 409; otherwise, re-raise
        if '"est_chef"' in sql_err:
            msg = f'L\'employé associé au code "{CODE}" ne peut pas être supprimé, car il supervise un ou plusieurs secteurs'
            abort(make_response(jsonify(message=msg), 409))
        else:
            abort(make_response(jsonify(message=err.args[1]), 500))
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 500))

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
    KEYS = ['code_mnemotechnique', 'numero_avs', 'prenom', 'nom', 'nom_marital', 'date_naissance',
            'lieu_naissance', 'adresse', 'fonction', 'service', 'grade', 'taux_occupation']
    param_fragment = ', '.join(f'@{key}=?' for key in KEYS)
    try:
        def raise_if_missing(k):
            if k in request.form: return True
            else: raise Exception(f'Attribut "{k}" manquant')
        values = tuple((val if (val := request.form[key]) != '' else None) for key in KEYS if raise_if_missing(key))
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 400))

    sql = f'SET NOCOUNT ON; EXEC insertionEmploye {param_fragment};'
    try:
        cur = cnxn.cursor()
        cur.execute(sql, values)
    except pyodbc.IntegrityError as err:
 
        # check if missing values
        matches = re.search(r'(?<=Cannot insert the value NULL into column \').*(?=\', table \'.*\')', err.args[1])
        if col_name := matches and matches.group(0):
            abort(make_response(jsonify(message=f'Attribut "{col_name}" manquant'), 400))

        # check if error was a key violation
        matches = re.search(r'Violation of (PRIMARY|UNIQUE) KEY constraint', err.args[1])
        if sql_err := matches and matches.group(0):
            msg = f'Le {'code mnémotechnique' if 'PRIMARY' in sql_err else 'numéro AVS'} doit être unique'
            abort(make_response(jsonify(message=msg), 400))
        else:
            abort(make_response(jsonify(message=err.args[1]), 500))
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 500))

    return jsonify(success=True)


@app.route('/sector', methods=['GET'])
def sector_get():
    sql_parcels = 'SELECT * FROM Parcelle; '
    sql_temp = (
        'SELECT nom_secteur, {key}, prenom, COALESCE(nom_marital, nom) AS nom '
        'FROM {table} JOIN Employe ON {key} = code_mnemotechnique; '
    )
    sql_sectors = sql_temp.format(key='code_chef_secteur', table='Secteur')
    sql_likes = sql_temp.format(key='code_gardien', table='Preference')
    sql_dislikes = sql_temp.format(key='code_gardien', table='Aversion')
    sql = sql_sectors + sql_parcels + sql_likes + sql_dislikes

    try:
        cur = cnxn.cursor()
        cur.execute(sql)
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 500))

    (sectors, parcels, likes, dislikes) = fetch_while_next(cur)

    res = {sector: {'supervisor': list(rest), 'parcels': [], 'likes': [], 'dislikes': []} for sector, *rest in sectors}

    for num, sector in parcels:
        res[sector]['parcels'].append(num)

    for sector, *rest in likes:
        res[sector]['likes'].append(list(rest))

    for sector, *rest in dislikes:
        res[sector]['dislikes'].append(list(rest))

    return jsonify([{'name': key, **val} for key, val in res.items()])


@app.route('/salary', methods=['GET'])
def get_salary():
    try:
        # get '?date=...' from query string
        arg = request.args['date']
        if not arg or not (DATE := datetime.strptime(arg, '%Y-%m')):
            raise Exception()
    except:
        abort(make_response(jsonify(message='Date mal formatée'), 400))

    sql = 'SELECT * FROM salairesDuMois(?)'

    try:
        cur = cnxn.cursor()
        cur.execute(sql, str(DATE.date()))
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 500))

    return [list(row) for row in cur.fetchall()]


@app.route('/schedule/<view>/options', methods=['GET'])
def get_schedule_options(view):
    match view:
        case 'sector':
            sql ='SELECT DISTINCT nom_secteur FROM Parcelle'
        case 'staff':
            sql = "SELECT code_mnemotechnique FROM Employe WHERE fonction LIKE 'Gardien'"
        case _:
            abort(404)
    try:
        cur = cnxn.cursor()
        cur.execute(sql)
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 500))

    return [row[0] for row in cur.fetchall()]


@app.route('/schedule/sector', methods=['GET'])
def get_sector_schedule():
    try:
        date, sector = request.args['date'], request.args['sector']
        if not date or not sector:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Arguments manquants'), 400))
    sql_header = 'SELECT num_parcelle FROM Parcelle WHERE nom_secteur LIKE ?; '
    sql = (
        "WITH T AS ("
        "SELECT FORMAT(dt_debut, 'hh:mm') AS time, Parcelle.num_parcelle as num_parcelle, code_gardien "
        "FROM Surveillance JOIN Parcelle "
        "ON Surveillance.num_parcelle = Parcelle.num_parcelle "
        "WHERE FORMAT(dt_debut, 'yyyy-MM-dd') LIKE ? "
        "AND nom_secteur LIKE ?) "
        "SELECT time, num_parcelle, code_gardien, prenom, COALESCE(nom_marital, nom) "
        "FROM T JOIN Employe "
        "ON T.code_gardien = Employe.code_mnemotechnique"
    )
    try:
        cur = cnxn.cursor()
        cur.execute(sql_header + sql, sector, date, sector)
    except Exception as e:
        abort(make_response(jsonify(message=str(e)), 500))

    header = next(gen := fetch_while_next(cur))
    if not header:
        abort(make_response(jsonify(message='Ce secteur n\'a pas de parcelles'), 404))

    res = {
        'header': [row[0] for row in header],
        'data': [list(row) for row in next(gen)]
    }
    return res
