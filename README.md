# Resource Management System

RMS is a simple CRUD app with an SQL Server database, Flask backend API and frontend built using Vite.

In production, the front and back ends run inside two separate Docker containers:

* `frontend` is an nginx server serving static assets and proxying for the back-end server.
* `backend` is a gunicorn server running the back-end Flask application.



## How To Run

### 1. Initiate Database

This project uses SQL Server. Find yourself a server, then run the following scripts in order:

* [`tables.sql`](./sql/tables.sql)
* [`procedures.sql`](./sql/procedures.sql)

This will create the necessary tables and procedures on your database.

### 2. Set Environment Variables

Change [`prod.env.tmpl`](./prod.env.tmpl) so so that `DB_CONNECTION` contains a valid connection string to your server. Other variables are provided for your convenience, but only `DB_CONNECTION` is used by the application.

If you decide not to follow the template, you must set the driver value in your connection string to `ODBC Driver 18 for SQL Server`.

```
# Change these lines inside prod.env.tmpl

DB_USER=<username>
DB_PWD=<password>
```

Once the variables are set to the right value, rename `prod.env.tmpl` to `prod.env`.

### 3. Run Docker

If you haven't already, [install Docker](https://www.docker.com/get-started/).

Then, open this folder in a terminal and run the following command:

```
docker compose up -d
```

Once the containers are up, you can access the app the following address:

```
http://localhost
```
