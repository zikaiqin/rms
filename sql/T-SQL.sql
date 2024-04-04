USE ProjetSession;

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
