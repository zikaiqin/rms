USE master
--DROP DATABASE IF EXISTS ProjetSession;
GO

--CREATE DATABASE ProjetSession;
GO

USE ProjetSession;

--1) Salaire moyen et nombre de mois de l'employé 76A
SELECT AVG(salaire.montant) AS Montant_moyen, COUNT(salaire.montant) AS Nombre_mois FROM Salaire
WHERE Salaire.code_employe = '76A';

--2) Quels sont les noms des gardiens qui travaillent le 2024-04-02?
SELECT Employe.nom, Employe.prenom FROM Surveillance
INNER JOIN Gardien on Gardien.code_employe = Surveillance.code_gardien
INNER JOIN Employe on Employe.code_mnemotechnique = Surveillance.code_gardien
WHERE LEFT(dt_debut, 10) = '2024-04-02'
GROUP BY Employe.nom, Employe.prenom;

--3)Combien d'employés ont été payé le 2024-3-15?
SELECT COUNT(id_salaire) AS nb_employe_paye FROM Salaire
WHERE date = '2024-3-15';

--4)Quels sont les noms des chef de secteurs et le nom des secteurs qu'ils sont responsables?
SELECT Employe.nom, Employe.prenom, Secteur.nom_secteur FROM Employe
INNER JOIN ChefDeSecteur on ChefDeSecteur.code_employe = Employe.code_mnemotechnique
INNER JOIN Secteur on Secteur.code_chef_secteur = ChefDeSecteur.code_employe;

--5)Combien de parcelles il y a t-il dans chaque secteur?
SELECT Count(num_parcelle) AS nb_parcelles, nom_secteur
FROM Parcelle
WHERE Parcelle.nom_secteur = nom_secteur
GROUP BY nom_secteur;

--6) Nombre de mois de salaire payé avant 2024?
SELECT Count(id_salaire) AS nb_paye FROM Salaire
WHERE date < '2023-12-31'

--7) nom, prénom, nom marital, salaires et nom des secteurs des gardiens ayant un nom marital?
SELECT Employe.nom, Employe.prenom, Employe.nom_marital, Salaire.montant
FROM Employe
JOIN Salaire ON Salaire.code_employe = Employe.code_mnemotechnique
WHERE Employe.nom_marital IS NOT NULL AND Employe.fonction = 'Gardien';

--8)Quel est le nom du gardien 'ASC', le id des parcelles qu'il surveille et le nom des secteurs dont les parcelles font partie?
SELECT Employe.nom, Employe.prenom, Surveillance.num_parcelle, Secteur.nom_secteur From Employe
INNER JOIN Gardien on Employe.code_mnemotechnique = Gardien.code_employe
INNER JOIN Surveillance on Surveillance.code_gardien = Gardien.code_employe
INNER JOIN Parcelle on Parcelle.num_parcelle = Surveillance.num_parcelle
INNER JOIN Secteur on Secteur.nom_secteur = Parcelle.nom_secteur
WHERE Employe.code_mnemotechnique = 'ASC';

--9) Quels gardiens surveillent quelles parcelles quand et quel est le nom du secteur de la parcelle?
SELECT Surveillance.num_parcelle, Employe.nom, Employe.prenom, Surveillance.dt_debut, Surveillance.dt_fin, Parcelle.nom_secteur
FROM Surveillance
INNER JOIN Gardien ON Surveillance.code_gardien = Gardien.code_employe
INNER JOIN Employe ON Gardien.code_employe = Employe.code_mnemotechnique
INNER JOIN Parcelle ON Parcelle.num_parcelle = Surveillance.num_parcelle;

--10) Pour les gardiens, donnez le code mnémotechnique, nom complet et le nom des secteurs de ceux qui surveillent des parcelles.
SELECT Employe.code_mnemotechnique, Employe.nom, Employe.prenom, Secteur.nom_secteur
FROM Employe
JOIN Gardien ON Employe.code_mnemotechnique = Gardien.code_employe
JOIN Surveillance ON Gardien.code_employe = Surveillance.code_gardien
JOIN Parcelle ON Surveillance.num_parcelle = Parcelle.num_parcelle
JOIN Secteur ON Parcelle.nom_secteur = Secteur.nom_secteur
GROUP BY Employe.code_mnemotechnique, Employe.nom, Employe.prenom, Secteur.nom_secteur;

--11) Quels sont les noms des chefs de secteur, leurs salaires moyens et les secteurs qu'ils sont responsable?
SELECT Employe.nom, Employe.prenom, AVG(montant) AS Salaire_moyen, Secteur.nom_secteur FROM Employe
INNER JOIN Salaire ON Salaire.code_employe = Employe.code_mnemotechnique
INNER JOIN ChefDeSecteur ON ChefDeSecteur.code_employe = Employe.code_mnemotechnique
INNER JOIN Secteur ON Secteur.code_chef_secteur = ChefDeSecteur.code_employe
GROUP BY Employe.nom, Employe.prenom, Secteur.nom_secteur;

--12)quels sont les nom de secteur et numero des parcelles des préférences du gardien 'ASC' et le chef de secteur des secteurs?
SELECT Parcelle.num_parcelle, Secteur.nom_secteur, Employe.nom, Employe.prenom
FROM Preference
JOIN Parcelle ON Preference.nom_secteur = Parcelle.nom_secteur
JOIN Secteur ON Parcelle.nom_secteur = Secteur.nom_secteur
JOIN ChefDeSecteur ON Secteur.code_chef_secteur = ChefDeSecteur.code_employe
JOIN Employe ON Employe.code_mnemotechnique = ChefDeSecteur.code_employe
WHERE Preference.code_gardien = 'ASC';

--13) Quels sont les noms et nom de secteur des parcelles des employés qui surveillent au moins une parcelle dans les secteurs du chef de secteur '0GS'?
SELECT Employe.nom, Employe.prenom, Parcelle.nom_secteur
FROM Employe
JOIN Surveillance ON Employe.code_mnemotechnique = Surveillance.code_gardien
JOIN Parcelle ON Surveillance.num_parcelle = Parcelle.num_parcelle
JOIN Secteur ON Parcelle.nom_secteur = Secteur.nom_secteur
JOIN ChefDeSecteur ON Secteur.code_chef_secteur = ChefDeSecteur.code_employe
WHERE ChefDeSecteur.code_employe = '0GS'

