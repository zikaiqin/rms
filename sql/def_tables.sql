DROP DATABASE IF EXISTS ProjetSession;
CREATE DATABASE ProjetSession;
USE ProjetSession;

DROP TABLE IF EXISTS Surveillance;
DROP TABLE IF EXISTS Preference;
DROP TABLE IF EXISTS Aversion;
DROP TABLE IF EXISTS Parcelle;
DROP TABLE IF EXISTS Secteur;
DROP TABLE IF EXISTS ChefDeSecteur;
DROP TABLE IF EXISTS Gardien;
DROP TABLE IF EXISTS Salaire;
DROP TABLE IF EXISTS Employe;

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

CREATE TABLE Gardien(
    code_employe CHAR(3) PRIMARY KEY,
    grade VARCHAR(255),
    taux_occupation DECIMAL(5, 2) CHECK (taux_occupation BETWEEN 0 AND 100),  
    FOREIGN KEY(code_employe) REFERENCES Employe(code_mnemotechnique)
);

CREATE TABLE ChefDeSecteur(
	code_employe CHAR(3) PRIMARY KEY,
	FOREIGN KEY(code_employe) REFERENCES Employe(code_mnemotechnique)
);

CREATE TABLE Secteur(
    nom_secteur VARCHAR(50) PRIMARY KEY,
    code_chef_secteur CHAR(3) NOT NULL,
    FOREIGN KEY(code_chef_secteur) REFERENCES Employe(code_mnemotechnique)
);

CREATE TABLE Parcelle(
    num_parcelle INT PRIMARY KEY,
    nom_secteur VARCHAR(50) NOT NULL,
    FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur)
);

CREATE TABLE Salaire(
    id_salaire INT PRIMARY KEY,
    mois INT NOT NULL,
    montant DECIMAL(9, 2) NOT NULL,
    code_employe CHAR(3),
    FOREIGN KEY(code_employe) REFERENCES Employe(code_mnemotechnique),
    CONSTRAINT num_mois CHECK (mois BETWEEN 1 AND 12),
    CONSTRAINT montant_positif CHECK (montant >= 0)
);

CREATE TABLE Surveillance(
    num_parcelle INT,
    code_gardien CHAR(3),
    datetime_debut SMALLDATETIME,
    datetime_fin SMALLDATETIME,
    PRIMARY KEY(num_parcelle, code_gardien, datetime_debut, datetime_fin),
    FOREIGN KEY(num_parcelle) REFERENCES Parcelle(num_parcelle),
    FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe),
    CONSTRAINT datetime_df CHECK (datetime_debut < datetime_fin)
);

CREATE TABLE Preference( 
    nom_secteur VARCHAR(50),
    code_gardien CHAR(3),
    PRIMARY KEY(nom_secteur, code_gardien),
    FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur),
    FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe)
);

CREATE TABLE Aversion( 
    nom_secteur VARCHAR(50),
    code_gardien CHAR(3),
    PRIMARY KEY(nom_secteur, code_gardien),
    FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur),
    FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe)
);
