import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryDirectory = path.resolve(appDirectory, '..');
const appReadme = await readFile(path.join(appDirectory, 'README.md'), 'utf8');
const repositoryGuide = `\n\n## Repository guide\n\n- [AI working rules](AGENTS.md)\n- [Current work and decision log](DEMO_DEPLOYMENT.md)\n- [Archived service, contracts, and reference material](Documents/)\n`;
await writeFile(path.join(repositoryDirectory, 'README.md'), appReadme.trimEnd() + repositoryGuide, 'utf8');
