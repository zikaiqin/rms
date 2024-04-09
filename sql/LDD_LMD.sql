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
