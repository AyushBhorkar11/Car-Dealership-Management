import fs from 'node:fs';
import path from 'node:path';

// Files allowed to have hero-specific or raw styling exceptions
const ALLOWED_EXCEPTIONS = [
  'styles.css', // Defines global theme tokens and hero overlay
  'vehicle-scene.tsx', // 3D WebGL Three.js materials
  'engineering.tsx', // 3D Illustrative vehicle canvas
];

const FORBIDDEN_PATTERNS = [
  { name: 'bg-black', regex: /\bbg-black\b/g },
  { name: 'bg-white', regex: /\bbg-white\b/g },
  { name: 'text-black', regex: /\btext-black\b/g },
  { name: 'text-white', regex: /\btext-white\b/g },
  { name: 'hex-color', regex: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g },
];

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function main() {
  console.log('========================================================');
  console.log('CDMS HARD-CODED COLOR SANITIZATION AUDIT');
  console.log('========================================================\n');

  const srcDir = path.resolve(process.cwd(), 'src');
  const allFiles = getAllFiles(srcDir);
  let violationCount = 0;

  for (const file of allFiles) {
    const baseName = path.basename(file);
    if (ALLOWED_EXCEPTIONS.includes(baseName)) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignore comments or URLs/imports
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const pattern of FORBIDDEN_PATTERNS) {
        const matches = line.match(pattern.regex);
        if (matches) {
          // Check if it's an anchor href like #catalogue
          if (pattern.name === 'hex-color') {
            const filtered = matches.filter((m) => {
              // Ignore href="#..." or anchor links
              const isAnchor = line.includes(`href="${m}"`) || line.includes(`href={'${m}'}`) || line.includes(`href='${m}'`);
              return !isAnchor;
            });
            if (filtered.length === 0) continue;
          }

          const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
          console.warn(`[VIOLATION] ${relPath}:${i + 1} -> Contains '${pattern.name}': ${line.trim().slice(0, 80)}`);
          violationCount++;
        }
      }
    }
  }

  console.log('\n--------------------------------------------------------');
  if (violationCount > 0) {
    console.error(`[FAIL] Found ${violationCount} hard-coded color violations in src/. Use semantic theme tokens instead.`);
    process.exit(1);
  } else {
    console.log('[PASS] Zero hardcoded colors found in src/! 100% compliant with design tokens.');
  }
}

main();
