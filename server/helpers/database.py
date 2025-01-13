from contextlib import contextmanager
import pyodbc

class DataBase:
    def __init__(self, connection_string):
        self.connection_string = connection_string

    def connect(self):
        return pyodbc.connect(self.connection_string)

@contextmanager
def get_connection(db: DataBase):
    connection = db.connect()
    try:
        yield connection
    except Exception as e:
        connection.rollback()
        raise e
    else:
        connection.commit()
    finally:
        connection.close()
