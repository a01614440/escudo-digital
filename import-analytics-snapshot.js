import fs from 'fs/promises';
import { stdin } from 'process';
import { importAnalyticsSnapshot, initDb } from './db.js';

const readStdin = async () => {
  let data = '';
  for await (const chunk of stdin) {
    data += chunk;
  }
  return data;
};

const main = async () => {
  const inputPath = process.argv[2] || '';
  const raw = inputPath ? await fs.readFile(inputPath, 'utf8') : await readStdin();
  const parsed = JSON.parse(raw);

  await initDb();
  const result = await importAnalyticsSnapshot(parsed, {
    snapshotType: 'legacy_analytics_export',
    sourceLabel: inputPath || 'stdin',
  });

  console.log(JSON.stringify(result));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
