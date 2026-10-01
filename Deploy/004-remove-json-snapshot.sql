-- Finalize relational storage after migration 003 and a successful app acceptance window.
-- Checks the current relational state, then disables snapshot writes and removes AppState.
-- Run from the repository root in SQLCMD mode. Safe to rerun.
USE [DEMO_Accounting];
GO
:r App/server/data/migrations/004-remove-json-snapshot.sql
