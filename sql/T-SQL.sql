USE ProjetSession;
GO

CREATE OR ALTER TRIGGER conflit_horaire ON Surveillance
AFTER INSERT
AS
BEGIN
    DECLARE @_code CHAR(3);
    DECLARE @_start DATETIME2, @_end DATETIME2;
    SELECT @_start = dt_debut, @_end = dt_fin, @_code = code_gardien FROM inserted;

    DECLARE @crsr CURSOR;
    SET @crsr = CURSOR FOR
        SELECT dt_debut, dt_fin FROM Surveillance
        WHERE code_gardien = @_code
        AND DATEPART(year, dt_debut) = DATEPART(year, @_start)
        AND DATEPART(dayofyear, dt_debut) = DATEPART(dayofyear, @_start);
    OPEN @crsr;

    DECLARE @start DATETIME2, @end DATETIME2;
    FETCH NEXT FROM @crsr INTO @start, @end;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF (@_start > @start AND @_start < @end) OR (@_end > @start AND @_end < @end)
        BEGIN
            RAISERROR ('Il y a un conflit d''horaire avec une autre surveillance', 16, 1);
            ROLLBACK TRANSACTION;
        END
        FETCH NEXT FROM @crsr INTO @start, @end;
    END
END
GO

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
