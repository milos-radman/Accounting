import sql from 'mssql';

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
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.DemoAppState', N'U') IS NULL
        CREATE TABLE dbo.DemoAppState (
          StateKey nvarchar(100) NOT NULL CONSTRAINT PK_DemoAppState PRIMARY KEY,
          StateJson nvarchar(max) NOT NULL,
          UpdatedAt datetime2(7) NOT NULL CONSTRAINT DF_DemoAppState_UpdatedAt DEFAULT SYSUTCDATETIME()
        )
    `);
  }
  return pool;
}

export async function loadState(pool) {
  const result = await pool.request().query("SELECT StateJson FROM dbo.DemoAppState WHERE StateKey = N'app'");
  return result.recordset[0]?.StateJson ?? null;
}

export async function saveState(pool, state) {
  await pool.request()
    .input('stateJson', sql.NVarChar(sql.MAX), JSON.stringify(state))
    .query(`
      UPDATE dbo.DemoAppState
      SET StateJson = @stateJson, UpdatedAt = SYSUTCDATETIME()
      WHERE StateKey = N'app';
      IF @@ROWCOUNT = 0
        INSERT INTO dbo.DemoAppState (StateKey, StateJson) VALUES (N'app', @stateJson);
    `);
}
