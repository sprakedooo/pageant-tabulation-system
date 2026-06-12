// Seeds the 10 official candidates: copies headshots from server/graphics/
// into server/uploads/ with clean names, then applies seed-candidates.sql.
// Run: npm run seed:candidates   (idempotent — safe to re-run)
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const graphicsDir = path.join(__dirname, '..', 'graphics');
const uploadsDir = path.join(__dirname, '..', 'uploads');

// candidate_number → official headshot filename in graphics/
const PHOTOS = {
  1: 'CLUSTER 1 - PRINCESS DIANE R. LIBO-ON.jpg',
  2: 'CLUSTER 2 - JELIAN FAITH B. BELOY.jpg',
  3: 'CLUSTER 3 - JUSTINE M. SINGUE.jpg',
  4: 'CLUSTER 4 - JHONIE LOU BALBUENA.jpg',
  5: 'CLUSTER 5 - MARIZ S. ORAPA.jpg',
  6: 'CLUSTER 6 - MECEL MAE L. CAPAROSO.jpg',
  7: 'CLUSTER 7 - JANAH MAE F. ABRENICA.jpg',
  8: 'CLUSTER 8 - MARAILLE JHULAIZA O. AWA.jpg',
  9: 'LGU - ROSEMAE CABASURA.jpg',
  10: 'NGA - JALAINE O. ROSAL.jpg',
};

(async () => {
  for (const [num, file] of Object.entries(PHOTOS)) {
    const src = path.join(graphicsDir, file);
    if (!fs.existsSync(src)) {
      console.error(`✘ missing photo: ${file}`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(uploadsDir, `candidate-${num}.jpg`));
    console.log(`✔ photo candidate-${num}.jpg ← ${file}`);
  }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'seed-candidates.sql'), 'utf8');
  for (const stmt of sql.split(';').map((s) => s.trim()).filter((s) => s && !s.startsWith('--') && !/^USE\s/i.test(s))) {
    await pool.query(stmt);
  }
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM candidates');
  console.log(`\n✔ ${n} candidates in database.`);
  console.log('REMINDER: ages are placeholders (18) — update real ages in Admin → Candidates.');
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
