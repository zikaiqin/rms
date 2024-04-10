-- LDD
USE master
DROP DATABASE IF EXISTS ProjetSession;
GO

CREATE DATABASE ProjetSession;
GO

USE ProjetSession;

CREATE TABLE Employe (
    code_mnemotechnique CHAR(3) PRIMARY KEY,
    numero_avs INT NOT NULL UNIQUE,
    prenom VARCHAR(50) NOT NULL,
    nom VARCHAR(50) NOT NULL,
    nom_marital VARCHAR(50),
    date_naissance DATE NOT NULL,
    lieu_naissance VARCHAR(50) NOT NULL,
    adresse VARCHAR(255) NOT NULL,
    fonction VARCHAR(50) NOT NULL,
    service VARCHAR(50) NOT NULL,
    CONSTRAINT type_service CHECK(service IN ('Administratif', 'Surveillance', 'Médical')),
    CONSTRAINT type_fonction CHECK(
        service LIKE 'Administratif' AND fonction IN ('Secrétaire', 'Comptable', 'Chef du personnel', 'Directeur')
        OR service LIKE 'Surveillance' AND fonction IN ('Gardien', 'Chef de secteur')
        OR service LIKE 'Médical' AND fonction IN ('Vétérinaire', 'Infirmier'))
);
GO

CREATE TABLE Gardien(
    code_employe CHAR(3) PRIMARY KEY,
    grade VARCHAR(255) NOT NULL,
    taux_occupation DECIMAL(5, 2) NOT NULL,
    CONSTRAINT pourcentage CHECK (taux_occupation BETWEEN 0 AND 100),  
    FOREIGN KEY(code_employe) REFERENCES Employe(code_mnemotechnique)
    ON DELETE CASCADE
);
GO

CREATE TABLE ChefDeSecteur(
	code_employe CHAR(3) PRIMARY KEY,
	FOREIGN KEY(code_employe) REFERENCES Employe(code_mnemotechnique)
    ON DELETE CASCADE
);
GO

CREATE TABLE Secteur(
    nom_secteur VARCHAR(50) PRIMARY KEY,
    code_chef_secteur CHAR(3) NOT NULL,
    CONSTRAINT est_chef FOREIGN KEY(code_chef_secteur) REFERENCES ChefDeSecteur(code_employe)
    ON DELETE NO ACTION
);
GO

CREATE TABLE Parcelle(
    num_parcelle INT PRIMARY KEY,
    nom_secteur VARCHAR(50) NOT NULL,
    FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur)
    ON DELETE CASCADE
);
GO

CREATE TABLE Salaire(
    id_salaire uniqueidentifier PRIMARY KEY DEFAULT newid(),
    date DATE NOT NULL,
    montant DECIMAL(9, 2) NOT NULL,
    code_employe CHAR(3) NOT NULL,
    FOREIGN KEY(code_employe) REFERENCES Employe(code_mnemotechnique)
    ON DELETE CASCADE,
    CONSTRAINT montant_positif CHECK (montant >= 0)
);
GO

CREATE TABLE Surveillance(
    num_parcelle INT,
    code_gardien CHAR(3),
    dt_debut DATETIME2(0),
    dt_fin DATETIME2(0),
    PRIMARY KEY(code_gardien, dt_debut, dt_fin),
    FOREIGN KEY(num_parcelle) REFERENCES Parcelle(num_parcelle)
    ON DELETE CASCADE,
    FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe)
    ON DELETE CASCADE,
    CONSTRAINT dure_une_heure CHECK (DATEDIFF(s, dt_debut, dt_fin) = 3600), -- traite aussi le cas fin < debut
    CONSTRAINT heure_pile CHECK ((DATEPART(mi, dt_debut) = 0) AND (DATEPART(s, dt_debut) = 0)),
);
GO

CREATE TABLE Preference( 
    nom_secteur VARCHAR(50),
    code_gardien CHAR(3),
    PRIMARY KEY(nom_secteur, code_gardien),
    FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur)
    ON DELETE CASCADE,
    FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe)
    ON DELETE CASCADE
);
GO

CREATE TABLE Aversion( 
    nom_secteur VARCHAR(50),
    code_gardien CHAR(3),
    PRIMARY KEY(nom_secteur, code_gardien),
    FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur)
    ON DELETE CASCADE,
    FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe)
    ON DELETE CASCADE
);
GO

-- LMD

INSERT INTO Employe (code_mnemotechnique,numero_avs,prenom,nom,nom_marital,date_naissance,lieu_naissance,adresse,fonction, service) VALUES
	('76A', 123, 'Eric', 'Guan', NULL, '2000-07-25', 'Montréal', '8520 rue Oregon', 'Vétérinaire', 'Médical'),
	('7AD', 645, 'Eronk', 'Gonk', NULL, '1995-12-14', 'Sherbrooke', '16 croissant Toulon', 'Secrétaire', 'Administratif'),
	('23B', 245, 'Dan', 'Tremblay', NULL, '1975-02-09', 'Montréal', '75 rue la Fontaine', 'Comptable', 'Administratif'),
	('AD4', 132, 'Jeanne', 'Tremblay', 'Dubois', '1983-11-16', 'Drummondville', '1532 avenue Saint-Jean', 'Chef du personnel', 'Administratif'),
	('2JD', 787, 'Catherine', 'Dupont', NULL, '1991-08-29', 'Gaspé', '177 rue Océanie', 'Gardien', 'Surveillance'),
	('0GS', 578, 'Jake', 'Jones', NULL, '1993-05-03', 'New York', '12 rue State Farm', 'Chef de secteur', 'Surveillance'),
	('2SF', 567, 'Lebron', 'James', NULL, '1984-12-30', 'Akron', '124 rue Ohio', 'Gardien', 'Surveillance'),
	('H41', 682, 'Alain', 'Beaulieu', NULL, '1999-11-24', 'Toronto', '12 rue Scotia', 'Gardien', 'Surveillance'),
	('VY6', 392, 'Braxton', 'Tremblay', NULL, '1998-06-11', 'Québec', '990 rue de la ferme', 'Chef de secteur', 'Surveillance'),
	('CE4', 393, 'Cynthia', 'Cormier', 'Beaulieu', '1994-08-29', 'Trois-rivière', '177 rue Tourigny', 'Gardien', 'Surveillance'),
	('A45', 299, 'Victor', 'Beaudoin', NULL, '1979-10-15', 'Montréal', '12 rue Pomme', 'Infirmier', 'Médical'),
	('1S3', 295, 'Sarah', 'Allard', NULL, '1964-12-31', 'Sherbrooke', '554 rue Jeannette', 'Secrétaire', 'Administratif'),
	('1DJ', 180, 'Sandra', 'Bouchard', NULL, '2000-01-12', 'Montréal', '1 rue de la gare', 'Comptable', 'Administratif'),
	('632', 951, 'Louis', 'Morin', NULL, '1996-04-25', 'Québec', '1897 rue Breton', 'Infirmier', 'Médical'),
	('ASC', 935, 'William', 'Lachapelle', NULL, '1999-08-22', 'Laval', '177 rue Beaupré', 'Gardien', 'Surveillance');
GO

INSERT INTO Salaire ( date, montant, code_employe) VALUES
	( '2024-01-15', 8500.00, '76A'),
	( '2024-02-15', 10000.00, '76A'),
	( '2024-03-15', 10000.00, '76A'),
	( '2024-04-15', 10000.00, '76A'),
	( '2024-03-15', 5000.00, '7AD'),
	( '2024-03-15', 7000.00, '23B'),
	( '2024-03-15', 15000.00, 'AD4'),
	( '2024-04-15', 15000.00, 'AD4'),
	( '2024-05-15', 7000.00, '2JD'),
	( '2023-06-15', 7000.00, '2JD'),
	( '2023-07-15', 7500.00, '2JD'),
	( '2023-08-15', 7500.00, '2JD'),
	( '2023-06-15', 12000.00, '0GS'),
	( '2023-07-15', 6500.00, '2SF'),
	( '2023-08-15', 7000.00, '2SF'),
	( '2023-09-15', 7000.00, '2SF'),
	( '2024-01-15', 6000.00, 'H41'),
	( '2024-02-15', 6000.00, 'H41'),
	( '2024-03-15', 9000.00, 'VY6'),
	( '2023-07-15', 7300.00, 'CE4'),
	( '2024-01-15', 6900.00, 'A45'),
	( '2024-02-15', 7000.00, 'A45'),
	( '2024-03-15', 7000.00, 'A45'),
	( '2023-08-15', 5800.00, '1S3'),
	( '2023-07-15', 5500.00, '1DJ'),
	( '2023-06-15', 5200.00, '632'),
	( '2023-06-15', 7000.00, '632'),
	( '2024-04-15', 7900.00, 'ASC');
GO

INSERT INTO Gardien (code_employe,grade,taux_occupation) VALUES
	('2JD', 'Grade 1', 100.00),
	('2SF', 'Grade 2', 50.00),
	('H41', 'Grade 3', 75.00),
	('CE4', 'Grade 4', 90.00),
	('ASC', 'Grade 6', 100.00);
GO

INSERT INTO ChefDeSecteur (code_employe) VALUES
	('0GS'),
	('VY6');
GO

INSERT INTO Secteur(nom_secteur, code_chef_secteur) VALUES
	('Mammifère', '0GS'),
	('Oiseau', '0GS'),
	('Reptile', 'VY6'),
	('Aquarium', 'VY6');
GO

INSERT INTO Parcelle(num_parcelle,nom_secteur) VALUES
	(1, 'Mammifère'),
	(2, 'Mammifère'),
	(3, 'Mammifère'),
	(4, 'Oiseau'),
	(5, 'Oiseau'),
	(6, 'Reptile'),
	(7, 'Aquarium'),
	(8, 'Aquarium'),
	(9, 'Aquarium');
GO

INSERT INTO Surveillance(num_parcelle,code_gardien, dt_debut,dt_fin) VALUES
	(1, '2JD', '2024-04-01 10:00:00', '2024-04-01 11:00:00'),
	(1, 'ASC', '2024-04-01 14:00:00', '2024-04-01 15:00:00'),
	(2, 'CE4', '2024-04-02 11:00:00', '2024-04-02 12:00:00'),
	(2, 'ASC', '2024-04-02 13:00:00', '2024-04-02 14:00:00'),
	(3, 'H41', '2024-04-04 16:00:00', '2024-04-04 17:00:00'),
	(4, 'CE4', '2024-04-03 12:00:00', '2024-04-03 13:00:00'),
	(5, '2SF', '2024-04-03 11:00:00', '2024-04-03 12:00:00'),
	(6, 'H41', '2024-04-01 10:00:00', '2024-04-01 11:00:00'),
	(6, '2JD', '2024-04-06 15:00:00', '2024-04-06 16:00:00'),
	(7, 'CE4', '2024-04-01 12:00:00', '2024-04-01 13:00:00'),
	(8, 'H41', '2024-04-07 13:00:00', '2024-04-07 14:00:00'),
	(9, 'CE4', '2024-04-04 14:00:00', '2024-04-04 15:00:00'),
	(9, 'ASC', '2024-04-06 16:00:00', '2024-04-06 17:00:00');
GO

INSERT INTO Preference (code_gardien, nom_secteur) VALUES
	('2JD', 'Reptile'),
	('2JD', 'Mammifère'),
	('2SF', 'Oiseau'),
	('H41', 'Aquarium'),
	('H41', 'Reptile'),
	('ASC', 'Mammifère'),
	('ASC', 'Aquarium');
GO

INSERT INTO Aversion (code_gardien, nom_secteur) VALUES
	('2JD', 'Aquarium'),
	('2JD', 'Oiseau'),
	('2SF', 'Aquarium'),
	('CE4', 'Reptile'),
	('ASC', 'Oiseau');
GO
