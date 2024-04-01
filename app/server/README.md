# Back-End Routes

<h2>Employés</h2>

```
/staff
```
- `GET` : Get list of all employees with limited details
    - Params: None
    - Returns: `[{code, fname, lname, role, service}]`, i.e. array of employees with their code, first name, last name, role and service.

```
/staff/details
```
<!-- Should GET also go into /edit? -->
- `GET` : Get detailed information on employee with **@code**
    - Params: **@code : String**
    - Returns: `{attr_name: attr_val}` for each attribute of the employee. Include guard's attributes if employee is a guard.

```
/staff/edit
```
<!-- Is this absolutely necessary to implement? -->
- `POST` : Create employee with **@code**
    - Params: **@code : String, @attrs : {String *attr_name*: Any *attr_val*}**
    - Returns: `200` if successful
    - Returns: `403` if employee with **@code** already exists

<!-- Is this absolutely necessary to implement? -->
- `PUT` : Edit details of employee with **@code**
    - Params: **@code : String, @attrs : {String *attr_name*: Any *attr_val*}**
    - Returns: `200` if successful
    - Returns: `404` if employee with **@code** does not exist

<!-- Is this absolutely necessary to implement? -->
- `DELETE` : Delete employee with **@code**
    - Params: **@code : String**
    - Returns: `200` if successful
    - Returns: `403` if trying to delete a sector chief that is responsible for one or more sectors, as well as the list of sectors he supervises

<h2>Secteurs</h2>

```
/sector
```
- `GET` : Get all sectors
    - Params: None

<h2>Salaires</h2>

```
/salary
```
- `GET` : Get all salaries
    - Params: None

<h2>Horaire</h2>

```
/schedule/staff
```
- `GET` : Get the schedule of the employee with **@code** during the week of **@date**
    - Params: **@code : String, @date : Date**
    - Returns: `{day: {start_hour: parcel_num}}`, i.e. for each day of the week of **@date**, for every shift where employee with **@code** is working, give the hour when the shift begins and the number of the parcel beign guarded.
<br><br>

```
/schedule/sector
```
- `GET` : Get the schedule for one **@sector** during the *day* of **@date**
    - Params: **@sector : String, @date : Date**
    - Returns: `{parcel_num: {start_hour: employee_code}}`, i.e. for each parcel of **@sector**, for every shift where the parcel is guarded, give the hour when the shift begins and the code of the employee working the shift. Shifts where a parcel is left unguarded are simply left out.
<br><br>

```
/schedule/generate
```
- `POST` : Generate schedule for the week of **@date**
    - Params: **@date : Date**
    - Returns: `200` if successful, otherwise inform of any errors that occured