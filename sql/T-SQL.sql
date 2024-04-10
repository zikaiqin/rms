USE ProjetSession;
GO

-- Lance une exception si un gardien est assigné à plus qu'un secteur le même jour
CREATE OR ALTER TRIGGER conflit_horaire ON Surveillance
AFTER INSERT
AS
BEGIN
-- Nécessite curseur sur inserted pour les insertions multiples
    DECLARE @crsr CURSOR;
    SET @crsr = CURSOR FOR
        SELECT DISTINCT code_gardien, DATEPART(year, dt_debut) AS year, DATEPART(dayofyear, dt_debut) AS doy
        FROM inserted;
    OPEN @crsr;

    DECLARE @code CHAR(3), @year INT, @doy INT;
    FETCH NEXT FROM @crsr INTO @code, @year, @doy;

    DECLARE @count INT;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        WITH T AS (
            SELECT * FROM Surveillance
            UNION
            SELECT * FROM inserted),
        S AS (
            SELECT DISTINCT num_parcelle FROM T
            WHERE code_gardien = @code
            AND DATEPART(year, dt_debut) = @year
            AND DATEPART(dayofyear, dt_debut) = @doy)
        SELECT @count = COUNT(DISTINCT nom_secteur)
        FROM S JOIN Parcelle
        ON S.num_parcelle = Parcelle.num_parcelle;

        IF (@count > 1)
        BEGIN
            DECLARE @date VARCHAR(10);
            SELECT @date = FORMAT(DATEADD(day, @doy - 1, DATEFROMPARTS(@year, 1, 1)), 'yyyy-MM-dd');
            RAISERROR (
                N'Conflit d''horaire le %s: gardien %s a été assigné à plusieurs secteurs', 16, 1,
                @date, @code);
            ROLLBACK TRANSACTION;
        END
        FETCH NEXT FROM @crsr INTO @code, @year, @doy;
    END
END
GO

-- Insère un employé avec grade et taux requis si l'employé est un gardien
CREATE OR ALTER PROCEDURE insertionEmploye (
    @code_mnemotechnique CHAR(3),
    @numero_avs INT,
    @prenom VARCHAR(50),
    @nom VARCHAR(50),
    @nom_marital VARCHAR(50) = NULL,
    @date_naissance DATE,
    @lieu_naissance VARCHAR(50),
    @adresse VARCHAR(255),
    @fonction VARCHAR(50),
    @service VARCHAR(50),
    @grade VARCHAR(255) = NULL,
    @taux_occupation DECIMAL(5, 2) = NULL
)
AS
BEGIN
    BEGIN TRY
        BEGIN TRAN;
        INSERT INTO Employe VALUES (
            @code_mnemotechnique, @numero_avs, @prenom, @nom, @nom_marital,
            @date_naissance, @lieu_naissance, @adresse, @fonction, @service
        );
        IF (@fonction LIKE 'Chef de secteur')
        BEGIN
            INSERT INTO ChefDeSecteur VALUES
            (@code_mnemotechnique);
        END
        ELSE IF (@fonction LIKE 'Gardien')
        BEGIN
            INSERT INTO Gardien VALUES
            (@code_mnemotechnique, @grade, @taux_occupation);
        END
        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- Retourne tous les salaires du mois de la @date
CREATE OR ALTER FUNCTION salairesDuMois(@date DATE)
RETURNS TABLE
AS
RETURN
    WITH T AS (
        SELECT code_mnemotechnique, prenom, COALESCE(nom_marital, nom) AS nom, numero_avs, fonction, taux_occupation
        FROM Employe LEFT JOIN Gardien
        ON code_mnemotechnique = code_employe)
    SELECT code_mnemotechnique, prenom, nom, numero_avs, fonction, taux_occupation, montant AS salaire
    FROM T JOIN Salaire
    ON code_mnemotechnique = code_employe
    WHERE DATEPART(year, date) = DATEPART(year, @date) AND DATEPART(month, date) = DATEPART(month, @date)
GO
