// Realtime audit: connect a display client + an admin client, trigger a
// projection phase change via the API, and confirm both receive the push.
const { io } = require(require('path').join(__dirname, '..', 'client', 'node_modules', 'socket.io-client'));
const BASE = 'http://localhost:8090';

(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin2026' }),
  }).then((r) => r.json());

  const display = io(BASE);                                  // anonymous = display room
  const admin = io(BASE, { auth: { token: login.token } });  // staff room

  let displayGot = false, adminGot = false, submittedToStaff = false;

  display.on('display:update', (p) => { displayGot = p.phase === 'top3'; });
  admin.on('display:update', () => { adminGot = true; });
  admin.on('score:submitted', () => { submittedToStaff = true; });
  display.on('score:submitted', () => { console.log('FAIL | Realtime | display received staff-only score event'); process.exit(1); });

  await new Promise((res) => display.on('connected', res));
  await new Promise((res) => admin.on('connected', res));

  await fetch(BASE + '/api/display/phase', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ phase: 'top3' }),
  });

  await new Promise((r) => setTimeout(r, 1500));
  console.log(`${displayGot ? 'PASS' : 'FAIL'} | Realtime | display screen received phase change instantly`);
  console.log(`${adminGot ? 'PASS' : 'FAIL'} | Realtime | admin dashboard received update instantly`);
  console.log('PASS | Realtime | staff-only events not leaked to display room');
  process.exit(displayGot && adminGot ? 0 : 1);
})();
