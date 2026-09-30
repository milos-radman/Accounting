-- Run this script against AZS-PFSDEV-07.credit-dev.com.
-- It is safe to rerun. Add future schema changes as new numbered migrations below;
-- do not edit a migration that has already been applied.

USE [master];
GO

IF DB_ID(N'DEMO_Accounting') IS NULL
  CREATE DATABASE [DEMO_Accounting];
GO

USE [DEMO_Accounting];
GO

IF OBJECT_ID(N'dbo.DemoSchemaMigrations', N'U') IS NULL
  CREATE TABLE dbo.DemoSchemaMigrations (
    MigrationId varchar(100) NOT NULL CONSTRAINT PK_DemoSchemaMigrations PRIMARY KEY,
    AppliedAt datetime2(7) NOT NULL CONSTRAINT DF_DemoSchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
  );
GO

IF NOT EXISTS (SELECT 1 FROM dbo.DemoSchemaMigrations WHERE MigrationId = '001-state-snapshot')
BEGIN
  BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(N'dbo.DemoAppState', N'U') IS NULL
      CREATE TABLE dbo.DemoAppState (
        StateKey nvarchar(100) NOT NULL CONSTRAINT PK_DemoAppState PRIMARY KEY,
        StateJson nvarchar(max) NOT NULL,
        UpdatedAt datetime2(7) NOT NULL CONSTRAINT DF_DemoAppState_UpdatedAt DEFAULT SYSUTCDATETIME()
      );
    INSERT INTO dbo.DemoSchemaMigrations (MigrationId) VALUES ('001-state-snapshot');
    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH;
END;
GO

-- Future migration template:
-- IF NOT EXISTS (SELECT 1 FROM dbo.DemoSchemaMigrations WHERE MigrationId = '002-short-description')
-- BEGIN
--   BEGIN TRY
--     BEGIN TRANSACTION;
--     -- Make additive, guarded changes here, for example:
--     -- IF COL_LENGTH(N'dbo.DemoAppState', N'NewColumn') IS NULL
--     --   ALTER TABLE dbo.DemoAppState ADD NewColumn nvarchar(100) NULL;
--     INSERT INTO dbo.DemoSchemaMigrations (MigrationId) VALUES ('002-short-description');
--     COMMIT;
--   END TRY
--   BEGIN CATCH
--     IF @@TRANCOUNT > 0 ROLLBACK;
--     THROW;
--   END CATCH;
-- END;
-- GO
