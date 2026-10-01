-- Run this script against AZS-PFSDEV-07.credit-dev.com.
-- Initial database setup. Once migration 003 has been applied, use numbered upgrade scripts
-- instead of rerunning this bootstrap file; it includes the historical migration 002.

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

-- Run this file in SQLCMD mode from the repository root so Node and IIS use the same migration.
:r App/server/data/migrations/002-relational-tables.sql
:r App/server/data/migrations/003-unprefixed-tables.sql
