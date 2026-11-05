import fs from 'node:fs';
import path from 'node:path';

interface BenchFile {
  calibMs: number;
  metrics: Record<string, number>;
}

const baselinePath = path.resolve(process.cwd(), 'bench/baseline.json');
const outPath = path.resolve(process.cwd(), 'bench/out.json');

if (!fs.existsSync(baselinePath) || !fs.existsSync(outPath)) {
  console.error('Thiếu bench/baseline.json hoặc bench/out.json. Hãy chạy benchmark trước.');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as BenchFile;
const current = JSON.parse(fs.readFileSync(outPath, 'utf8')) as BenchFile;

const baseCalib = Math.max(0.1, baseline.calibMs);
const curCalib = Math.max(0.1, current.calibMs);
let regressed = false;

console.log(`=== So sánh Benchmark (calibMs: baseline=${baseCalib.toFixed(2)}ms, current=${curCalib.toFixed(2)}ms) ===`);
for (const [key, baseMs] of Object.entries(baseline.metrics)) {
  const curMs = current.metrics[key];
  if (typeof curMs !== 'number') continue;
  const baseNorm = baseMs / baseCalib;
  const curNorm = curMs / curCalib;
  const ratio = curNorm / Math.max(1e-6, baseNorm);
  console.log(`  ${key}: ${curMs.toFixed(2)}ms (ratio chuẩn hóa: ${ratio.toFixed(2)}x)`);
  if (ratio > 1.5) {
    console.warn(`  [CẢNH BÁO] ${key} chậm hơn 1.5x so với baseline (${ratio.toFixed(2)}x)`);
    regressed = true;
  }
}

if (regressed && process.argv.includes('--strict')) {
  process.exit(1);
}
