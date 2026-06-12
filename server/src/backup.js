const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const backupDir = path.join(__dirname, '..', 'backups');
const intervalMs = Number(process.env.BACKUP_INTERVAL_MINUTES || 5) * 60 * 1000;
const MAX_BACKUPS = 100;

function runBackup() {
  const dumpPath = process.env.MYSQLDUMP_PATH || 'mysqldump';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(backupDir, `backup-${stamp}.sql`);
  const args = [
    `-h${process.env.DB_HOST || 'localhost'}`,
    `-P${process.env.DB_PORT || 3306}`,
    `-u${process.env.DB_USER || 'root'}`,
    `-p${process.env.DB_PASSWORD || ''}`,
    '--single-transaction',
    process.env.DB_NAME || 'miss_dumalinao_2026',
  ];
  execFile(dumpPath, args, { maxBuffer: 100 * 1024 * 1024 }, (err, stdout) => {
    if (err) {
      console.error(`[backup] failed: ${err.message} — check MYSQLDUMP_PATH in .env`);
      return;
    }
    fs.writeFile(outFile, stdout, (werr) => {
      if (werr) return console.error('[backup] write failed:', werr.message);
      console.log(`[backup] saved ${path.basename(outFile)}`);
      pruneOld();
    });
  });
}

function pruneOld() {
  fs.readdir(backupDir, (err, files) => {
    if (err) return;
    const backups = files.filter((f) => f.startsWith('backup-') && f.endsWith('.sql')).sort();
    while (backups.length > MAX_BACKUPS) {
      const oldest = backups.shift();
      fs.unlink(path.join(backupDir, oldest), () => {});
    }
  });
}

function startBackupSchedule() {
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  setInterval(runBackup, intervalMs);
  console.log(`[backup] automatic database backup every ${intervalMs / 60000} minutes → ${backupDir}`);
}

module.exports = { startBackupSchedule, runBackup };
