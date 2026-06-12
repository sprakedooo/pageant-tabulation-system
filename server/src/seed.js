// Creates the default admin, tabulator, and display accounts.
// Run once after importing schema.sql:  npm run seed
const bcrypt = require('bcryptjs');
const pool = require('./db');

const ACCOUNTS = [
  { username: 'admin', password: 'admin2026', full_name: 'System Administrator', role: 'admin' },
  { username: 'tabulator', password: 'tab2026', full_name: 'Official Tabulator', role: 'tabulator' },
  { username: 'display', password: 'display2026', full_name: 'Projection Screen', role: 'display' },
];

(async () => {
  for (const acc of ACCOUNTS) {
    const hash = await bcrypt.hash(acc.password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role_id)
       VALUES (?, ?, ?, (SELECT role_id FROM roles WHERE role_name = ?))
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [acc.username, hash, acc.full_name, acc.role]
    );
    console.log(`✔ ${acc.role.padEnd(10)} username: ${acc.username}  password: ${acc.password}`);
  }
  console.log('\nIMPORTANT: change these passwords before the event.');
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
