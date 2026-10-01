-- Upgrade a database that already has migration 002 applied.
-- Run from the repository root in SQLCMD mode. Safe to rerun.
USE [DEMO_Accounting];
GO
:r App/server/data/migrations/003-unprefixed-tables.sql
