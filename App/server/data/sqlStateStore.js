import sql from 'mssql';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const databaseName = process.env.DB_NAME ?? 'AccountingDemo';
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
}

const baseConfig = {
  server: process.env.DB_SERVER ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 1433),
  user: process.env.DB_USER ?? 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
};

export async function connectStore() {
  if (!baseConfig.password) throw new Error('Set DB_PASSWORD before starting the demo.');

  const autoCreateDatabase = process.env.DB_AUTO_CREATE !== 'false';
  if (autoCreateDatabase) {
    const master = await new sql.ConnectionPool({ ...baseConfig, database: 'master' }).connect();
    try {
      await master.request().query(`IF DB_ID(N'${databaseName}') IS NULL CREATE DATABASE [${databaseName}]`);
    } finally {
      await master.close();
    }
  }

  const pool = await new sql.ConnectionPool({ ...baseConfig, database: databaseName }).connect();
  if (autoCreateDatabase) {
    const { recordset: ledgers } = await pool.request().query(`
      SELECT CASE
        WHEN OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NOT NULL THEN N'dbo.SchemaMigrations'
        WHEN OBJECT_ID(N'dbo.DemoSchemaMigrations', N'U') IS NOT NULL THEN N'dbo.DemoSchemaMigrations'
      END AS LedgerName
    `);
    let ledgerName = ledgers[0]?.LedgerName;
    const applied = async (id) => {
      if (!ledgerName) return false;
      const { recordset } = await pool.request()
        .input('migrationId', sql.VarChar(100), id)
        .query(`SELECT CONVERT(bit, CASE WHEN EXISTS (SELECT 1 FROM ${ledgerName} WHERE MigrationId = @migrationId) THEN 1 ELSE 0 END) AS Applied`);
      return recordset[0].Applied;
    };
    const apply = async (name) => {
      const migration = await readFile(fileURLToPath(new URL(`./migrations/${name}`, import.meta.url)), 'utf8');
      for (const batch of migration.split(/^\s*GO\s*$/gim).map(part => part.trim()).filter(Boolean)) {
        await pool.request().batch(batch);
      }
    };

    if (!await applied('002-relational-tables')) {
      await pool.request().query(`
        IF OBJECT_ID(N'dbo.DemoAppState', N'U') IS NULL AND OBJECT_ID(N'dbo.AppState', N'U') IS NULL
          CREATE TABLE dbo.DemoAppState (
            StateKey nvarchar(100) NOT NULL CONSTRAINT PK_DemoAppState PRIMARY KEY,
            StateJson nvarchar(max) NOT NULL,
            UpdatedAt datetime2(7) NOT NULL CONSTRAINT DF_DemoAppState_UpdatedAt DEFAULT SYSUTCDATETIME()
          )
      `);
      await apply('002-relational-tables.sql');
      ledgerName = 'dbo.DemoSchemaMigrations';
    }
    if (!await applied('003-unprefixed-tables')) {
      await apply('003-unprefixed-tables.sql');
      ledgerName = 'dbo.SchemaMigrations';
    }
    if (!await applied('004-remove-json-snapshot')) {
      const { recordset } = await pool.request().query(`
        SELECT InitializedAt FROM dbo.StoreMetadata WHERE StoreKey = N'app'
      `);
      if (recordset[0]?.InitializedAt) await apply('004-remove-json-snapshot.sql');
    }
  }
  return pool;
}

export async function loadState(pool) {
  const result = await pool.request().execute('dbo.GetDemoState');
  return result.recordset[0]?.StateJson ?? null;
}

export async function saveState(pool, state) {
  await pool.request()
    .input('stateJson', sql.NVarChar(sql.MAX), JSON.stringify(state))
    .execute('dbo.SaveDemoState');
}
