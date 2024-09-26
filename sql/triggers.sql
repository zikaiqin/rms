USE ProjetSession;
GO

-- Lance une exception si un gardien est assigné à plus qu'un secteur le même jour
-- ou à la même parcelle pendant deux heures de suite
CREATE OR ALTER TRIGGER conflit_horaire ON Surveillance
AFTER INSERT, UPDATE
AS
BEGIN
-- Nécessite curseur sur inserted pour les insertions multiples
    DECLARE @crsr CURSOR;
    SET @crsr = CURSOR FOR
        SELECT num_parcelle, code_gardien, dt_debut, dt_fin
        FROM inserted;
    OPEN @crsr;

    DECLARE @parcel INT, @code CHAR(3), @start DATETIME2, @end DATETIME2;
    FETCH NEXT FROM @crsr INTO @parcel, @code, @start, @end;

    DECLARE @count INT;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Vérifie que les gardiens changent de secteur à chaque heure;
        IF (EXISTS (SELECT * FROM (
                SELECT * FROM Surveillance
                UNION
                SELECT * FROM inserted) AS T
            WHERE num_parcelle = @parcel
            AND code_gardien = @code
            AND (dt_fin = @start OR dt_debut = @end)))
        BEGIN
            DECLARE @dt1 VARCHAR(20), @dt2 VARCHAR(20);
            SELECT @dt1 = CONVERT(VARCHAR(20), @start, 120);
            SELECT @dt2 = CONVERT(VARCHAR(20), @end, 120);
            RAISERROR (
                N'Le gardien %s ne peut pas surveiller la parcelle %d entre %s et %s', 16, 1,
                @code, @parcel, @dt1, @dt2);
            ROLLBACK TRANSACTION;
        END

        -- Vérifie que les gardiens ne surveillent qu'un seul secteur par jour
        SELECT @count = COUNT(DISTINCT nom_secteur)
        FROM (
            SELECT * FROM Surveillance
            UNION
            SELECT * FROM inserted
        ) AS T JOIN Parcelle
        ON T.num_parcelle = Parcelle.num_parcelle
        WHERE code_gardien = @code
        AND DATEPART(year, dt_debut) = DATEPART(year, @start)
        AND DATEPART(dayofyear, dt_debut) = DATEPART(dayofyear, @start);

        IF (@count > 1)
        BEGIN
            DECLARE @date VARCHAR(10);
            SELECT @date = FORMAT(@start, 'yyyy-MM-dd');
            RAISERROR (
                N'Le gardien %s a été assigné à plusieurs secteurs lors du %s', 16, 1,
                @code, @date);
            ROLLBACK TRANSACTION;
        END
        FETCH NEXT FROM @crsr INTO @parcel, @code, @start, @end;
    END
END
GO

-- Vérifie que le gardien ne dépasse pas 3 préférences
CREATE OR ALTER TRIGGER trois_pref_max ON Preference
AFTER INSERT, UPDATE
AS
BEGIN
    DECLARE @crsr CURSOR;
    SET @crsr = CURSOR FOR
        SELECT DISTINCT code_gardien
        FROM inserted;
    OPEN @crsr;

    DECLARE @code CHAR(3);
    FETCH NEXT FROM @crsr INTO @code;

    DECLARE @count INT;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Vérifie le nombre de préférences
        SELECT @count = COUNT(*) FROM (
            SELECT * FROM Preference
            UNION
            SELECT * FROM inserted) AS T
        WHERE code_gardien = @code;

        IF (@count > 3)
        BEGIN
            RAISERROR (
                N'Le gardien %s ne peut pas avoir plus que trois préférences', 16, 1,
                @code);
            ROLLBACK TRANSACTION;
        END
        FETCH NEXT FROM @crsr INTO @code;
    END
END
GO

-- Idem pour les aversions
CREATE OR ALTER TRIGGER trois_aver_max ON Aversion
AFTER INSERT, UPDATE
AS
BEGIN
    DECLARE @crsr CURSOR;
    SET @crsr = CURSOR FOR
        SELECT DISTINCT code_gardien
        FROM inserted;
    OPEN @crsr;

    DECLARE @code CHAR(3);
    FETCH NEXT FROM @crsr INTO @code;

    DECLARE @count INT;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Vérifie le nombre de préférences
        SELECT @count = COUNT(*) FROM (
            SELECT * FROM Aversion
            UNION
            SELECT * FROM inserted) AS T
        WHERE code_gardien = @code;

        IF (@count > 3)
        BEGIN
            RAISERROR (
                N'Le gardien %s ne peut pas avoir plus que trois aversions', 16, 1,
                @code);
            ROLLBACK TRANSACTION;
        END
        FETCH NEXT FROM @crsr INTO @code;
    END
END
GO

-- Vérifie que le gardien n'a pas simultanément une préférence et une aversion envers un même secteur
CREATE OR ALTER TRIGGER pref_ou_aver ON Preference
AFTER INSERT, UPDATE
AS
BEGIN
    DECLARE @crsr CURSOR;
    SET @crsr = CURSOR FOR
        SELECT nom_secteur, code_gardien
        FROM inserted;
    OPEN @crsr;

    DECLARE @sector VARCHAR(50), @code CHAR(3);
    FETCH NEXT FROM @crsr INTO @sector, @code;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Vérifie s'il existe une aversion pour ce secteur
        IF (@sector IN (
            SELECT nom_secteur FROM Aversion
            WHERE code_gardien = @code))
        BEGIN
            RAISERROR (
                N'Le gardien %s ne peut pas pas simultanément avoir une préférence et une aversion envers le secteur %s', 16, 1,
                @code, @sector);
            ROLLBACK TRANSACTION;
        END
        FETCH NEXT FROM @crsr INTO @sector, @code;
    END
END
GO

-- Idem dans le sens inverse
CREATE OR ALTER TRIGGER aver_ou_pref ON Aversion
AFTER INSERT, UPDATE
AS
BEGIN
    DECLARE @crsr CURSOR;
    SET @crsr = CURSOR FOR
        SELECT nom_secteur, code_gardien
        FROM inserted;
    OPEN @crsr;

    DECLARE @sector VARCHAR(50), @code CHAR(3);
    FETCH NEXT FROM @crsr INTO @sector, @code;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Vérifie s'il existe une aversion pour ce secteur
        IF (@sector IN (
            SELECT nom_secteur FROM Preference
            WHERE code_gardien = @code))
        BEGIN
            RAISERROR (
                N'Le gardien %s ne peut pas pas simultanément avoir une préférence et une aversion envers le secteur %s', 16, 1,
                @code, @sector);
            ROLLBACK TRANSACTION;
        END
        FETCH NEXT FROM @crsr INTO @sector, @code;
    END
END
GO
