from pyodbc import IntegrityError
from flask import Blueprint, request, abort, make_response, jsonify
from itertools import chain, repeat
from datetime import datetime, timedelta
import re
from helpers.util import fetch_while_next, is_valid_code, is_valid_parcel
from app import connection

schedule = Blueprint('schedule', __name__)

def assert_schedule_edit_keys(schedule: list):
    for slot in schedule:
        if not isinstance(slot, dict):
            abort(make_response(jsonify(message='Arguments mal formatés'), 400))
        if 'staffCode' not in slot or (
            (CODE := slot['staffCode']) is not None and
            not is_valid_code(CODE)
        ):
            abort(make_response(jsonify(message='Code mnémotechnique manquant ou mal formaté'), 400))
        if not is_valid_parcel(PARCEL := slot.get('parcelNbr')):
            abort(make_response(jsonify(message='Numéro de parcelle manquant ou mal formaté'), 400))
        try:
            START = datetime.strptime(slot.get('dtStart'), '%Y-%m-%dT%H:%M')
        except:
            abort(make_response(jsonify(message='Dates manquantes ou mal formatées'), 400))
        yield CODE, PARCEL, START, START + timedelta(hours=1)

# could do separate checks for codes and parcels for better error feedback
@schedule.route('', methods=['POST'])
def schedule_edit():
    """
    JSON type: [{
        staffCode: string(3) | null,
        parcelNbr: number,
        dtStart: 'yyyy-MM-dd"T"HH:mm'
    }]

    Error codes:
        - 400: missing or invalid properties
    """

    DATA = request.get_json(silent=True)
    if not isinstance(DATA, list) or len(DATA) <= 0:
        abort(make_response(jsonify(message='Arguments manquants ou mal formatés'), 400))

    sanitized = tuple(assert_schedule_edit_keys(DATA))
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


def build_where_clause(start, end, staff, sector):
    if not any((start, end, staff, sector,)):
        return '', None
    sql_start = 'dt_debut >= ?' if start else None
    sql_end = 'dt_debut < ?' if end else None
    sql_staff = 'code_gardien=?' if staff else None
    sql_sector = 'nom_secteur=?' if sector else None
    sql_where = f'WHERE {' AND '.join(tuple(s for s in (sql_start, sql_end, sql_staff, sql_sector) if s))}'
    params = tuple(p for p in (start, end, staff, sector) if p)
    return sql_where, params

@schedule.route('', methods=['GET'])
def schedule_get():
    """
    Params:
        - start?: 'yyyy-MM-dd'
        - end?: 'yyyy-MM-dd'
        - staffCode?: string(3)
        - sectorName?: string

    Error codes:
        - 400: missing or invalid properties
        - 404: sector or staff not found
    """

    START, END, STAFF, SECTOR = (request.args.get(key) for key in ('start', 'end', 'staffCode', 'sectorName'))
    if START or END:
        try:
            dates = tuple(datetime.strptime(date, '%Y-%m-%d') for date in (START, END) if date)
        except:
            abort(make_response(jsonify(message='Date mal formatée'), 400))
        if len(dates) > 1 and dates[1] <= dates[0]:
            abort(make_response(jsonify(message='La date de début doit être après la date de fin'), 400))
    if 'staff' in request.args and not is_valid_code(STAFF):
        abort(make_response(jsonify(message='Code gardien mal formaté'), 400))

    sql_select = 'SELECT FORMAT(dt_debut, \'yyyy-MM-dd"T"HH:mm\') AS dtStart, Surveillance.num_parcelle AS parcelNbr, code_gardien AS staffCode'
    sql_from = 'FROM Surveillance' + (' JOIN Parcelle ON Surveillance.num_parcelle = Parcelle.num_parcelle' if SECTOR else '')
    sql_where, sql_params = build_where_clause(START, END, STAFF, SECTOR)
    sql = f'{sql_select} {sql_from} {sql_where};'

    with connection() as conn:
        cur = conn.cursor()
        if sql_where:
            sql_check = ''
            sql_check_params = ()
            if STAFF:
                sql_check += 'SELECT COUNT(*) AS staff_count FROM Gardien WHERE code_employe=?;'
                sql_check_params += (STAFF,)
            if SECTOR:
                sql_check += 'SELECT COUNT(*) AS sector_count FROM Secteur WHERE nom_secteur=?;'
                sql_check_params += (SECTOR,)
            if sql_check:
                cur.execute(sql_check, *sql_check_params)
                for rows in fetch_while_next(cur):
                    if rows[0][0] <= 0:
                        msg, val = ('Aucun gardien au code {val}', STAFF) if cur.description[0][0].startswith('staff') else ('Aucun secteur au nom {val}', SECTOR)
                        abort(make_response(jsonify(message=msg.format(val=val)), 404))
            cur = conn.cursor()
            cur.execute(sql, sql_params)
        else:
            cur.execute(sql)

        # names of each column/attribute
        keys = [col[0] for col in cur.description]

        return [dict(zip(keys, row)) for row in cur.fetchall()]
