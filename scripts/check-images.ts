import fs from 'node:fs';
import path from 'node:path';

// Slug mapper: brand and model to expected image filename
export function getModelSlug(brand: string, model: string): string {
  const clean = `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${clean}.jpg`;
}

// Known models in dealership catalogue
const EXPECTED_MODELS = [
  { brand: 'Audi', model: 'A4', filename: 'audi-a4.jpg' },
  { brand: 'BMW', model: '3 Series', filename: 'bmw-3-series.jpg' },
  { brand: 'Honda', model: 'City', filename: 'honda-city.jpg' },
  { brand: 'Hyundai', model: 'Creta', filename: 'hyundai-creta.jpg' },
  { brand: 'Kia', model: 'Seltos', filename: 'kia-seltos.jpg' },
  { brand: 'Mahindra', model: 'Thar', filename: 'mahindra-thar.jpg' },
  { brand: 'Mahindra', model: 'XUV700', filename: 'mahindra-xuv700.jpg' },
  { brand: 'Maruti Suzuki', model: 'Grand Vitara', filename: 'maruti-grand-vitara.jpg' },
  { brand: 'Mercedes-Benz', model: 'C-Class', filename: 'mercedes-c-class.jpg' },
  { brand: 'Tata', model: 'Nexon EV', filename: 'tata-nexon.jpg' },
  { brand: 'Toyota', model: 'Fortuner', filename: 'toyota-fortuner.jpg' },
  { brand: 'Toyota', model: 'Innova Hycross', filename: 'toyota-innova.jpg' },
];

function main() {
  console.log('========================================================');
  console.log('CDMS SHOWROOM CAR IMAGE AUDIT (public/cars/)');
  console.log('========================================================\n');

  const carsDir = path.resolve(process.cwd(), 'public/cars');
  const existingFiles = new Set(fs.existsSync(carsDir) ? fs.readdirSync(carsDir) : []);

  console.log(`Found ${existingFiles.size} images in public/cars/:\n`);

  const missing: string[] = [];
  const present: string[] = [];

  for (const m of EXPECTED_MODELS) {
    if (existingFiles.has(m.filename)) {
      const stats = fs.statSync(path.join(carsDir, m.filename));
      const sizeKb = (stats.size / 1024).toFixed(1);
      // Special note: Audi A4 currently has a Q5 photo
      if (m.brand === 'Audi' && m.model === 'A4') {
        console.log(`[FLAG] ${m.brand} ${m.model.padEnd(16)} -> ${m.filename.padEnd(24)} (${sizeKb} KB) - Note: file currently contains Audi Q5 SUV photo instead of sedan.`);
      } else {
        console.log(`[PASS] ${m.brand} ${m.model.padEnd(16)} -> ${m.filename.padEnd(24)} (${sizeKb} KB)`);
      }
      present.push(m.filename);
    } else {
      console.log(`[MISSING] ${m.brand} ${m.model.padEnd(16)} -> ${m.filename}`);
      missing.push(m.filename);
    }
  }

  console.log('\n--------------------------------------------------------');
  console.log(`Total Models Checked : ${EXPECTED_MODELS.length}`);
  console.log(`Verified On Disk     : ${present.length}`);
  console.log(`Missing Files        : ${missing.length}`);

  if (missing.length > 0) {
    console.log('\nMissing filenames that must be added:');
    for (const f of missing) {
      console.log(`  - public/cars/${f}`);
    }
  } else {
    console.log('\nAll expected model image filenames exist on disk.');
  }
}

main();
