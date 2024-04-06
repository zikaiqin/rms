import pyodbc
from flask import Flask, request, abort, make_response, jsonify
from flask_cors import CORS
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

@app.route('/staff', methods=['GET'])
def staff():
    """
    This is the staff endpoint

    Parameters: None

    Returns: A list of partial details of all employees
    """
    cur = cnxn.cursor()
    sql = 'SELECT code_mnemotechnique, prenom, COALESCE(nom_marital, nom) AS nom, fonction, service FROM Employe'
    cur.execute(sql)
    return [list(row) for row in cur.fetchall()]


@app.route('/staff/details', methods=['GET'])
def staff_details():
    """
    This is the staff details endpoint

    Parameters:
        - ?code: code of the employee whose details we are trying to get

    Returns: A dict with all the attributes of the employee
    """
    try:
        # get '?code=...' from query string
        CODE = request.args['code']
        if not CODE or len(CODE) != 3:
            raise Exception()
    except:
        abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))

    cur = cnxn.cursor()
    sql = 'SELECT * FROM Employe LEFT JOIN Gardien ON code_mnemotechnique=code_employe WHERE code_mnemotechnique=?'
    cur.execute(sql, CODE)

    # result of the sql query
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
    CODE = request.form['code']
    cur = cnxn.cursor()
    sql = 'DELETE FROM Employe WHERE code_mnemotechnique=?'
    try:
        cur.execute(sql, CODE)
    except pyodbc.IntegrityError as err:
        matches = re.search(r'REFERENCE constraint ".*"', err.args[1])
        err_msg = matches.group(0) if matches else ''
        if '"est_chef"' in err_msg:
            msg = f'L\'employé associé au code "{CODE}" ne peut pas être supprimé, car il supervise un ou plusieurs secteurs'
            abort(make_response(jsonify(message=msg), 409))
        else:
            raise err

    if cur.rowcount == 0:
        abort(make_response(jsonify(message=f'Aucun employé associé au code "{CODE}"'), 404))

    return jsonify(success=True)
