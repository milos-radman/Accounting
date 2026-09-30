import express from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { connectStore, loadState, saveState } from './data/sqlStateStore.js';

const app = express();
const port = Number(process.env.PORT ?? 4174);
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
app.use(express.json({ limit: '25mb' }));

let poolPromise;
const getPool = () => poolPromise ??= connectStore().catch(error => {
  poolPromise = undefined;
  throw error;
});
app.get('/demo/state', async (_request, response, next) => {
  try {
    const state = await loadState(await getPool());
    if (state === null) return response.sendStatus(204);
    response.type('application/json').send(state);
  } catch (error) {
    next(error);
  }
});

app.put('/demo/state', async (request, response, next) => {
  if (!request.body || Array.isArray(request.body) || typeof request.body !== 'object') {
    return response.status(400).json({ message: 'Demo state must be a JSON object.' });
  }
  try {
    await saveState(await getPool(), request.body);
    response.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.get('/health', (_request, response) => response.json({ status: 'ready' }));
app.use(express.static(dist));
app.get('*splat', (_request, response) => response.sendFile(path.join(dist, 'index.html')));
app.use((error, request, response, _next) => {
  const diagnosticId = randomUUID();
  console.error(`Demo request failed (${diagnosticId})`, error);
  const details = String(error?.stack ?? error).replace(/(password|pwd)\s*=.*$/gim, '$1=[REDACTED]');
  response.status(500).json({
    message: 'The demo could not load or save its data. The database may be unavailable; please retry in a moment.',
    diagnosticId,
    details: { timeUtc: new Date().toISOString(), method: request.method, path: request.path, exception: details },
  });
});

const server = app.listen(port, () => console.log(`Accounting demo listening on http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close();
    if (poolPromise) await poolPromise.then(pool => pool.close()).catch(() => undefined);
    process.exit(0);
  });
}
