const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initSockets } = require('./sockets');
const { startBackupSchedule } = require('./backup');

const app = express();
const server = http.createServer(app);
initSockets(server);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/candidates', require('./routes/candidates.routes'));
app.use('/api/judges', require('./routes/judges.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/scores', require('./routes/scores.routes'));
app.use('/api/rankings', require('./routes/rankings.routes'));
app.use('/api/display', require('./routes/display.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/audit', require('./routes/audit.routes'));

// LAN health check
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now(), uptime: process.uptime() }));

// Serve the built React app
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api|\/uploads).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = Number(process.env.PORT || 80);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Miss Dumalinao 2026 Tabulation System running on http://0.0.0.0:${PORT}`);
  startBackupSchedule();
});
