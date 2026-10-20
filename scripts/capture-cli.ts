import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const edge = fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';

function shot(url: string, dest: string) {
  const fullDest = path.resolve(dest);
  console.log(`Shooting ${url} -> ${dest}`);
  spawnSync(edge, [
    '--headless=new',
    '--window-size=1440,960',
    `--user-data-dir=${process.env.TEMP}\\edge-temp-${Date.now()}`,
    `--screenshot=${fullDest}`,
    url,
  ]);
}

shot('http://localhost:8080/cars?theme=dark', 'docs/screenshots/before-after/explore-cars-dark-after.png');
shot('http://localhost:8080/cars?theme=light', 'docs/screenshots/before-after/explore-cars-light-after.png');
shot('http://localhost:8080/cars/audi-a4?theme=dark', 'docs/screenshots/before-after/model-audi-a4-dark.png');
shot('http://localhost:8080/cars/audi-a4?theme=light', 'docs/screenshots/before-after/model-audi-a4-light.png');
console.log('All done!');
