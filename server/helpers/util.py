from itertools import repeat
from pyodbc import Cursor

def is_valid_code(code):
    return (
        isinstance(code, str) and
        len(code) == 3 and
        code.isalnum() and
        code.isupper()
    )

def is_valid_parcel(num):
    return (
        isinstance(num, int) and
        0 < num and num < 100
    )

def fetch_while_next(cursor: Cursor):
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