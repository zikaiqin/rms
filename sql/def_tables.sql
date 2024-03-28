Use master;

--DROP DATABASE IF EXISTS ProjetSession;

--CREATE DATABASE ProjetSession;

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
	code_mnemotechnique int PRIMARY KEY,
	numero_avs int NOT NULL,
	prenom varchar(50) NOT NULL,
	nom varchar(50) NOT NULL,
	nomMarital varchar(50) NULL, --Optionnel
	date_naissance DATE NOT NULL,
	lieu_naissance varchar(50) NOT NULL,
	adresse varchar(255) NOT NULL,
	fonction varchar(50) NOT NULL,	--CHECK 8 METIERS 
	typeService varchar(50) NOT NULL, --CHECK 3 TYPES 
	CONSTRAINT typeDeService CHECK( typeService IN ('Administratif', 'Surveillance', 'Medical')),
	CONSTRAINT nom_metier CHECK( fonction IN ('Veterinaire', 'Infirmier', 'Gardien', 'Chef de secteur', 'Secretaire', 'Comptable', 'Chef du personnel', 'Directeur'))
);

CREATE TABLE Gardien (
	code_employe int PRIMARY KEY,
    grade VARCHAR(255),
    taux_occupation DECIMAL(5, 2) CHECK (taux_occupation BETWEEN 0 AND 100),  
    FOREIGN KEY (code_employe) REFERENCES Employe(code_mnemotechnique)
);

CREATE TABLE ChefDeSecteur(
	code_employe int PRIMARY KEY,
	FOREIGN KEY(code_employe) REFERENCES Employe(code_mnemotechnique)
);

CREATE TABLE Secteur(
	nom_secteur varchar(50) PRIMARY KEY,
	code_chef_secteur int NOT NULL,
	FOREIGN KEY(code_chef_secteur) REFERENCES ChefDeSecteur(code_employe)
)

CREATE TABLE Parcelle(
	num_parcelle int PRIMARY KEY,
	nom_secteur varchar(50) NOT NULL,
	FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur)
);

CREATE TABLE Salaire(
	idSalaire int PRIMARY KEY,
	mois varchar(50) NOT NULL, --CHECK 12 MOIS 
	montant float NOT NULL, --PAS NEGATIF 
	code_employe int,
	FOREIGN KEY(code_employe) REFERENCES Employe(code_mnemotechnique),
	CONSTRAINT nom_mois CHECK (mois IN ('Janvier', 'F�vrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Ao�t', 'Septembre', 'Octobre', 'Novembre', 'D�cembre')),
	CONSTRAINT montant_negatif CHECK (montant >= 0)
);

CREATE TABLE Surveillance (
	num_parcelle int,
	code_gardien int,
	datetime_debut datetime NOT NULL,	--CHECK DEBUT AVANT FIN 
	datetime_fin datetime NOT NULL,
	PRIMARY KEY(num_parcelle, code_gardien),
	FOREIGN KEY(num_parcelle) REFERENCES Parcelle(num_parcelle),
	FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe),
	CONSTRAINT datetime_df CHECK (datetime_debut < datetime_fin)
);

CREATE TABLE Preference( 
	nom_secteur varchar(50),
	code_gardien int,
	PRIMARY KEY(nom_secteur, code_gardien),
	FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur),
	FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe)
);

CREATE TABLE Aversion( 
	nom_secteur varchar(50),
	code_gardien int,
	PRIMARY KEY(nom_secteur, code_gardien),
	FOREIGN KEY(nom_secteur) REFERENCES Secteur(nom_secteur),
	FOREIGN KEY(code_gardien) REFERENCES Gardien(code_employe)
);
