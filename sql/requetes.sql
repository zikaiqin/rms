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
WHERE LEFT(datetime_debut, 10) = '2024-04-02'
GROUP BY Employe.nom, Employe.prenom

--3)Combien d'employés ont été payé le 2024-3-15?
SELECT COUNT(id_salaire) AS nb_employe_paye FROM Salaire
WHERE date = '2024-3-15'

--4)Quels sont les noms des chef de secteurs et le nom des secteurs qu'ils sont responsables?
SELECT Employe.nom, Employe.prenom, Secteur.nom_secteur FROM Employe
INNER JOIN ChefDeSecteur on ChefDeSecteur.code_employe = Employe.code_mnemotechnique
INNER JOIN Secteur on Secteur.code_chef_secteur = ChefDeSecteur.code_employe

--5)Combien de parcelles il y a t-il dans chaque secteur?
SELECT Count(num_parcelle) AS nb_parcelles, nom_secteur
FROM Parcelle
WHERE Parcelle.nom_secteur = nom_secteur
GROUP BY nom_secteur;

--6)Quel est le nom du gardien 'ASC', le id des parcelles qu'il surveille et le nom des secteurs dont les parcelles font partie?
SELECT Employe.nom, Employe.prenom, Surveillance.num_parcelle, Secteur.nom_secteur From Employe
INNER JOIN Gardien on Employe.code_mnemotechnique = Gardien.code_employe
INNER JOIN Surveillance on Surveillance.code_gardien = Gardien.code_employe
INNER JOIN Parcelle on Parcelle.num_parcelle = Surveillance.num_parcelle
INNER JOIN Secteur on Secteur.nom_secteur = Parcelle.nom_secteur
WHERE Employe.code_mnemotechnique = 'ASC'

--7)Quels gardiens surveillent 2 parcelles ou plus et et quels sont les noms des chef des secteurs auxquels les parcelles appartiennent? Not working as intended
SELECT E.nom AS nom_gardien, COUNT(*) AS nombre_parcelles_surveillees, E_SC.nom AS nom_chef
FROM Gardien G
JOIN Employe E ON G.code_employe = E.code_mnemotechnique
JOIN Surveillance S ON G.code_employe = S.code_gardien
JOIN Parcelle P ON S.num_parcelle = P.num_parcelle
JOIN Secteur SC ON P.nom_secteur = SC.nom_secteur
JOIN ChefDeSecteur CS ON SC.code_chef_secteur = CS.code_employe
JOIN Employe E_SC ON CS.code_employe = E_SC.code_mnemotechnique
GROUP BY E.nom, E_SC.nom
HAVING COUNT(S.num_parcelle) >= 2;

