USE ProjetSession;
GO

--1) Salaire moyen et nombre de mois de l'employé 76A
SELECT AVG(salaire.montant) AS Montant_moyen, COUNT(salaire.montant) AS Nombre_mois FROM Salaire
WHERE Salaire.code_employe = '76A';
GO

--2) Quels sont les noms des gardiens qui travaillent le 2024-04-02?
SELECT Employe.nom, Employe.prenom FROM Surveillance
INNER JOIN Gardien on Gardien.code_employe = Surveillance.code_gardien
INNER JOIN Employe on Employe.code_mnemotechnique = Surveillance.code_gardien
WHERE LEFT(dt_debut, 10) = '2024-04-02'
GROUP BY Employe.nom, Employe.prenom;
GO

--3)Combien d'employés ont été payé le 2024-3-15?
SELECT COUNT(id_salaire) AS nb_employe_paye FROM Salaire
WHERE date = '2024-3-15';
GO

--4)Quels sont les noms des chef de secteurs et le nom des secteurs qu'ils sont responsables?
SELECT Employe.nom, Employe.prenom, Secteur.nom_secteur FROM Employe
INNER JOIN ChefDeSecteur on ChefDeSecteur.code_employe = Employe.code_mnemotechnique
INNER JOIN Secteur on Secteur.code_chef_secteur = ChefDeSecteur.code_employe;
GO

--5)Combien de parcelles il y a t-il dans chaque secteur?
SELECT Count(num_parcelle) AS nb_parcelles, nom_secteur
FROM Parcelle
WHERE Parcelle.nom_secteur = nom_secteur
GROUP BY nom_secteur;
GO

--6) Nombre de mois de salaire payé avant 2024?
SELECT Count(id_salaire) AS nb_paye FROM Salaire
WHERE date < '2023-12-31';
GO

--7) nom, prénom, nom marital, salaires et nom des secteurs des gardiens ayant un nom marital?
SELECT Employe.nom, Employe.prenom, Employe.nom_marital, Salaire.montant
FROM Employe
JOIN Salaire ON Salaire.code_employe = Employe.code_mnemotechnique
WHERE Employe.nom_marital IS NOT NULL AND Employe.fonction = 'Gardien';
GO

--8)Quel est le nom du gardien 'ASC', le id des parcelles qu'il surveille et le nom des secteurs dont les parcelles font partie?
SELECT Employe.nom, Employe.prenom, Surveillance.num_parcelle, Secteur.nom_secteur From Employe
INNER JOIN Gardien on Employe.code_mnemotechnique = Gardien.code_employe
INNER JOIN Surveillance on Surveillance.code_gardien = Gardien.code_employe
INNER JOIN Parcelle on Parcelle.num_parcelle = Surveillance.num_parcelle
INNER JOIN Secteur on Secteur.nom_secteur = Parcelle.nom_secteur
WHERE Employe.code_mnemotechnique = 'ASC';
GO

--9) Quels gardiens surveillent quelles parcelles quand et quel est le nom du secteur de la parcelle?
SELECT Surveillance.num_parcelle, Employe.nom, Employe.prenom, Surveillance.dt_debut, Surveillance.dt_fin, Parcelle.nom_secteur
FROM Surveillance
INNER JOIN Gardien ON Surveillance.code_gardien = Gardien.code_employe
INNER JOIN Employe ON Gardien.code_employe = Employe.code_mnemotechnique
INNER JOIN Parcelle ON Parcelle.num_parcelle = Surveillance.num_parcelle;
GO

--10) Pour les gardiens, donnez le code mnémotechnique, nom complet et le nom des secteurs de ceux qui surveillent des parcelles.
SELECT Employe.code_mnemotechnique, Employe.nom, Employe.prenom, Secteur.nom_secteur
FROM Employe
JOIN Gardien ON Employe.code_mnemotechnique = Gardien.code_employe
JOIN Surveillance ON Gardien.code_employe = Surveillance.code_gardien
JOIN Parcelle ON Surveillance.num_parcelle = Parcelle.num_parcelle
JOIN Secteur ON Parcelle.nom_secteur = Secteur.nom_secteur
GROUP BY Employe.code_mnemotechnique, Employe.nom, Employe.prenom, Secteur.nom_secteur;
GO

--11) Quels sont les noms des chefs de secteur, leurs salaires moyens et les secteurs qu'ils sont responsable?
SELECT Employe.nom, Employe.prenom, AVG(montant) AS Salaire_moyen, Secteur.nom_secteur FROM Employe
INNER JOIN Salaire ON Salaire.code_employe = Employe.code_mnemotechnique
INNER JOIN ChefDeSecteur ON ChefDeSecteur.code_employe = Employe.code_mnemotechnique
INNER JOIN Secteur ON Secteur.code_chef_secteur = ChefDeSecteur.code_employe
GROUP BY Employe.nom, Employe.prenom, Secteur.nom_secteur;
GO

--12)quels sont les nom de secteur et numero des parcelles des préférences du gardien 'ASC' et le chef de secteur des secteurs?
SELECT Parcelle.num_parcelle, Secteur.nom_secteur, Employe.nom, Employe.prenom
FROM Preference
JOIN Parcelle ON Preference.nom_secteur = Parcelle.nom_secteur
JOIN Secteur ON Parcelle.nom_secteur = Secteur.nom_secteur
JOIN ChefDeSecteur ON Secteur.code_chef_secteur = ChefDeSecteur.code_employe
JOIN Employe ON Employe.code_mnemotechnique = ChefDeSecteur.code_employe
WHERE Preference.code_gardien = 'ASC';
GO

--13) Quels sont les noms et nom de secteur des parcelles des employés qui surveillent au moins une parcelle dans les secteurs du chef de secteur '0GS'?
SELECT Employe.nom, Employe.prenom, Parcelle.nom_secteur
FROM Employe
JOIN Surveillance ON Employe.code_mnemotechnique = Surveillance.code_gardien
JOIN Parcelle ON Surveillance.num_parcelle = Parcelle.num_parcelle
JOIN Secteur ON Parcelle.nom_secteur = Secteur.nom_secteur
JOIN ChefDeSecteur ON Secteur.code_chef_secteur = ChefDeSecteur.code_employe
WHERE ChefDeSecteur.code_employe = '0GS'
GO

RAISERROR('Stop execution', 25, -1)


-------------------------------------------------------------------------------------
-- Requêtes utilisées par l'application                                            --
-- Certaines requêtes générées programmatiquement dans python ne sont pas incluses --
-------------------------------------------------------------------------------------


-- GET /staff
-- Retourne le code mnémotechnique, prenom, le nom marital OU le nom s'il n'existe pas, la fonction et le service de tous les employés
SELECT code_mnemotechnique, prenom, COALESCE(nom_marital, nom) AS nom, fonction, service FROM Employe

-- GET /staff/details
-- Retourne tous les attributs de l'employé dont le code est @c, incluant grade et taux d'occupation s'il est gardien
SELECT * FROM Employe LEFT JOIN Gardien ON code_mnemotechnique=code_employe WHERE code_mnemotechnique=@c

-- POST /staff/delete
-- Supprime l'employé dont le code est @c
DELETE FROM Employe WHERE code_mnemotechnique=@c

-- GET /salary
-- Retourne tous les salaires du même mois que la date @d
SELECT * FROM salairesDuMois(@d) ORDER BY code_mnemotechnique

-- POST /salary/edit
-- Modifie le montant du salaire de l'employé dont le code est @c, à la date @d
UPDATE Salaire SET montant=@m WHERE code_employe=@c AND date=@d

-- POST /salary/edit (lorsque le montant est 0)
-- Supprime le salaire de l'employé dont le code est @c, à la date @d
DELETE FROM Salaire WHERE code_employe=@c AND date=@d

-- GET /salary/add
-- Retourne les employé qui n'ont pas de salaire lors du mois de la date @d
SELECT code_mnemotechnique, prenom, COALESCE(nom_marital, nom), numero_avs, fonction, taux_occupation
FROM Employe LEFT JOIN Gardien
ON code_mnemotechnique = code_employe
WHERE code_mnemotechnique NOT IN (
    SELECT code_employe FROM Salaire
    WHERE DATEPART(year, date) = DATEPART(year, @d)
    AND DATEPART(month, date) = DATEPART(month, @d));

-- POST /salary/add
-- Soient une date @d, montant @m et code @c
-- S'il existe un salaire pour l'employé dont le code est @c, à la date @d, mettre à jour le montant
-- Sinon, insérer un salaire avec date @d, montant @m et code @c
BEGIN TRAN;
IF EXISTS (SELECT * FROM Salaire WHERE code_employe=@c AND date=@d)
BEGIN
    UPDATE Salaire SET montant=@m WHERE code_employe=@c AND date=@d;
END
ELSE BEGIN
    INSERT INTO Salaire(date, montant, code_employe) VALUES (@d, @m, @c);
END
COMMIT TRAN;

-- GET /schedule/sector
-- Retourne l'heure de début, le numéro de parcelle, ainsi que le code, prénom et nom des gardiens qui surveillent le secteur @s lors de la date @d
WITH T AS (
    SELECT FORMAT(dt_debut, 'hh:mm') AS time, Parcelle.num_parcelle as num_parcelle, code_gardien
    FROM Surveillance JOIN Parcelle
    ON Surveillance.num_parcelle = Parcelle.num_parcelle
    WHERE CONVERT(DATE, dt_debut) = @d
    AND nom_secteur LIKE @s)
SELECT time, num_parcelle, code_gardien, prenom, COALESCE(nom_marital, nom)
FROM T JOIN Employe
ON T.code_gardien = Employe.code_mnemotechnique

-- GET /schedule/staff
-- Retourne la date et l'heure de début, le numéro de parcelle, et le nom du secteur des surveillances du gardien au code @c entre les dates @d1 et @d2
SELECT CONVERT(VARCHAR(20), dt_debut, 120) AS dt_debut, Parcelle.num_parcelle as num_parcelle, nom_secteur
FROM Surveillance JOIN Parcelle
ON Surveillance.num_parcelle = Parcelle.num_parcelle
WHERE code_gardien=@c
AND dt_debut BETWEEN @d1 AND @d2
