-- Insère un nouveau employé, avec grade et taux requis si l'employé est un gardien
CREATE OR ALTER PROCEDURE insertionEmploye (
    @code_mnemotechnique CHAR(3),
    @numero_avs INT,
    @prenom VARCHAR(50),
    @nom VARCHAR(50),
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
            @code_mnemotechnique, @numero_avs, @prenom, @nom,
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

-- Retourne tous les salaires du même mois que la @date
CREATE OR ALTER FUNCTION salairesDuMois(@date DATE)
RETURNS TABLE
AS
RETURN
    WITH T AS (
        SELECT code_mnemotechnique, prenom, nom, numero_avs, fonction, taux_occupation
        FROM Employe LEFT JOIN Gardien
        ON code_mnemotechnique = code_employe)
    SELECT code_mnemotechnique, prenom, nom, numero_avs, fonction, taux_occupation, montant AS salaire
    FROM T JOIN Salaire
    ON code_mnemotechnique = code_employe
    WHERE DATEPART(year, date) = DATEPART(year, @date) AND DATEPART(month, date) = DATEPART(month, @date)
GO
