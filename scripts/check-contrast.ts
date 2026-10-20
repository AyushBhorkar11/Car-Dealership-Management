import fs from 'node:fs';
import path from 'node:path';

// OKLCH to linear RGB conversion based on CSS Color 4 specification
function oklchToRgb(l: number, c: number, hDeg: number): [number, number, number] {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const rLin = +4.0767434778 * L - 3.3077115913 * M + 0.2309699295 * S;
  const gLin = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bLin = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return [clamp(rLin), clamp(gLin), clamp(bLin)];
}

function parseOklch(str: string): [number, number, number] | null {
  const match = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) return null;
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
}

function getLuminance(val: string): number {
  const parsed = parseOklch(val);
  if (!parsed) {
    if (val.includes('0 0 0')) return 0;
    if (val.includes('1 0 0') || val.includes('0.99')) return 1;
    return 0.5;
  }
  const rgb = oklchToRgb(parsed[0], parsed[1], parsed[2]);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseTokensFromCss(css: string) {
  const darkBlockMatch = css.match(/:root\s*\{([^}]+)\}/);
  const lightBlockMatch = css.match(/:root\[data-theme=light\][\s\S]*?\{([\s\S]*?)\}/);

  const extractTokens = (block: string) => {
    const tokens: Record<string, string> = {};
    const lines = block.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      const m = trimmed.match(/^--([a-z0-9-]+)\s*:\s*([^;]+);/);
      if (m) {
        tokens[m[1]] = m[2].trim();
      }
    }
    return tokens;
  };

  const darkTokens = darkBlockMatch ? extractTokens(darkBlockMatch[1]) : {};
  const lightTokens = lightBlockMatch ? extractTokens(lightBlockMatch[1]) : {};

  return { darkTokens, lightTokens };
}

function main() {
  const cssPath = path.resolve(process.cwd(), 'src/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const { darkTokens, lightTokens } = parseTokensFromCss(css);

  const pairs = [
    { bg: 'background', fg: 'foreground', min: 4.5, name: 'Normal Page Text' },
    { bg: 'card', fg: 'card-foreground', min: 4.5, name: 'Card Surface Text' },
    { bg: 'popover', fg: 'popover-foreground', min: 4.5, name: 'Popover / Dropdown Text' },
    { bg: 'primary', fg: 'primary-foreground', min: 4.5, name: 'Primary Button Text' },
    { bg: 'secondary', fg: 'secondary-foreground', min: 4.5, name: 'Secondary Element Text' },
    { bg: 'muted', fg: 'muted-foreground', min: 4.5, name: 'Muted Helper Text' },
    { bg: 'accent', fg: 'accent-foreground', min: 4.5, name: 'Accent Highlight Text' },
    { bg: 'destructive', fg: 'destructive-foreground', min: 4.5, name: 'Destructive / Error Text' },
    { bg: 'warning', fg: 'warning-foreground', min: 4.5, name: 'Warning Alert Text' },
    { bg: 'success', fg: 'success-foreground', min: 4.5, name: 'Success Confirmation Text' },
    { bg: 'on-image', fg: 'on-image-foreground', min: 4.5, name: 'On-Image Button (Hero)' },
  ];

  console.log('========================================================');
  console.log('CDMS WCAG AA COLOR CONTRAST VALIDATION SUITE');
  console.log('========================================================\n');

  let failedCount = 0;

  for (const theme of ['DARK', 'LIGHT'] as const) {
    console.log(`--- ${theme} THEME TOKEN PAIRS ---`);
    const tokens = theme === 'DARK' ? darkTokens : lightTokens;

    for (const p of pairs) {
      const bgVal = tokens[p.bg] || darkTokens[p.bg];
      const fgVal = tokens[p.fg] || darkTokens[p.fg];

      if (!bgVal || !fgVal) {
        console.warn(`[WARN] Missing token pair for ${p.bg} / ${p.fg}`);
        continue;
      }

      const lBg = getLuminance(bgVal);
      const lFg = getLuminance(fgVal);
      const ratio = contrastRatio(lBg, lFg);
      const passes = ratio >= p.min;

      const ratioStr = `${ratio.toFixed(2)}:1`.padEnd(8);
      const statusStr = passes ? '[PASS]' : '[FAIL]';
      if (!passes) failedCount++;

      console.log(
        `${statusStr} ${p.name.padEnd(28)}: ${p.bg}/${p.fg.padEnd(20)} -> ${ratioStr} (Req: >=${p.min}:1)`
      );
    }
    console.log('');
  }

  if (failedCount > 0) {
    console.error(`[ERROR] Total contrast failures: ${failedCount}. Fix token values to satisfy WCAG AA.`);
    process.exit(1);
  } else {
    console.log('[SUCCESS] All foreground/background color token pairs meet or exceed WCAG AA standards!\n');
  }
}

main();
