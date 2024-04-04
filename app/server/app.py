import pyodbc
from flask import Flask, request, abort, make_response, jsonify

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
    sql = 'SELECT * FROM Employe WHERE code_mnemotechnique=?'
    cur.execute(sql, CODE)

    # result of the sql query
    row = cur.fetchone()
    if not row:
        abort(make_response(jsonify(message='Code mnémotechnique n''appartient à aucun employé'), 404))

    # names of each column/attribute
    keys = [col[0] for col in cur.description]

    # return a dictionary of all attributes
    res = dict(zip(keys, row))
    return res
