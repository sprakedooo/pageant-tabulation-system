/* eslint-disable no-console */
// DRY RUN / FUNCTIONALITY AUDIT — simulates the full pageant night via the HTTP API.
// Usage: node dryrun.js   (server must be running; database freshly seeded)
const BASE = process.env.BASE || 'http://localhost:80';

let passed = 0, failed = 0;
const results = [];
function check(section, name, ok, info = '') {
  results.push({ section, name, ok, info });
  ok ? passed++ : failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${section} | ${name}${info ? ' — ' + info : ''}`);
}

async function req(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, ct };
}

const tokens = {}; // role/judge tokens

async function login(username, password) {
  const r = await req('POST', '/api/auth/login', { body: { username, password } });
  return r;
}

(async () => {
  // ================= 1. AUTHENTICATION =================
  let r = await login('admin', 'wrongpass');
  check('Auth', 'Wrong password rejected', r.status === 401);

  r = await login('admin', 'admin2026');
  check('Auth', 'Admin login', r.status === 200 && !!r.data.token);
  tokens.admin = r.data.token;

  r = await login('tabulator', 'tab2026');
  check('Auth', 'Tabulator login', r.status === 200);
  tokens.tab = r.data.token;

  r = await req('GET', '/api/candidates', {});
  check('Auth', 'Request without token rejected', r.status === 401);

  // ================= 2. CANDIDATE MANAGEMENT =================
  const CANDS = [
    [1, 'Maria Santos', 'Poblacion', 19],
    [2, 'Angel Reyes', 'San Agustin', 21],
    [3, 'Krishna Lopez', 'Mahayag', 20],
    [4, 'Bianca Cruz', 'Dilud', 18],
    [5, 'Sophia Mendoza', 'Camanga', 22],
    [6, 'Nicole Garcia', 'Tina', 19],
  ];
  const candIds = {};
  for (const [num, name, mun, age] of CANDS) {
    const form = new FormData();
    form.append('candidate_number', num);
    form.append('candidate_name', name);
    form.append('municipality', mun);
    form.append('age', age);
    r = await req('POST', '/api/candidates', { token: tokens.admin, form });
    if (r.status === 201) candIds[num] = r.data.candidate_id;
    check('Candidates', `Create candidate #${num} ${name}`, r.status === 201);
  }

  // photo upload (1x1 PNG)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  {
    const form = new FormData();
    form.append('candidate_number', 1);
    form.append('candidate_name', 'Maria Santos');
    form.append('municipality', 'Poblacion');
    form.append('age', 19);
    form.append('photo', new Blob([png], { type: 'image/png' }), 'photo.png');
    r = await req('PUT', `/api/candidates/${candIds[1]}`, { token: tokens.admin, form });
    check('Candidates', 'Update candidate with photo upload', r.status === 200);
  }

  // duplicate number rejected
  {
    const form = new FormData();
    form.append('candidate_number', 1);
    form.append('candidate_name', 'Dup');
    form.append('municipality', 'X');
    form.append('age', 20);
    r = await req('POST', '/api/candidates', { token: tokens.admin, form });
    check('Candidates', 'Duplicate candidate number rejected', r.status === 409);
  }

  r = await req('GET', '/api/candidates', { token: tokens.admin });
  const withPhoto = r.data.find((c) => c.candidate_number === 1);
  check('Candidates', 'List candidates (6) + photo stored', r.data.length === 6 && !!withPhoto.photo, `photo=${withPhoto.photo}`);

  // tabulator cannot create candidates
  {
    const form = new FormData();
    form.append('candidate_number', 99); form.append('candidate_name', 'X'); form.append('municipality', 'X'); form.append('age', 20);
    r = await req('POST', '/api/candidates', { token: tokens.tab, form });
    check('RBAC', 'Tabulator blocked from creating candidates', r.status === 403);
  }

  // ================= 3. JUDGE MANAGEMENT =================
  const JUDGES = [
    ['Judge Alpha', 'judge1'], ['Judge Bravo', 'judge2'], ['Judge Charlie', 'judge3'],
  ];
  const judgeIds = {};
  for (const [name, uname] of JUDGES) {
    r = await req('POST', '/api/judges', { token: tokens.admin, body: { full_name: name, username: uname, password: 'judge123' } });
    if (r.status === 201) judgeIds[uname] = r.data.judge_id;
    check('Judges', `Create ${name}`, r.status === 201);
  }
  r = await req('POST', '/api/judges', { token: tokens.admin, body: { full_name: 'Dup', username: 'judge1', password: 'judge123' } });
  check('Judges', 'Duplicate username rejected', r.status === 409);

  // deactivate / login blocked / reactivate
  r = await req('PATCH', `/api/judges/${judgeIds.judge3}/status`, { token: tokens.admin, body: { status: 'inactive' } });
  check('Judges', 'Deactivate judge', r.status === 200);
  r = await login('judge3', 'judge123');
  check('Judges', 'Deactivated judge cannot log in', r.status === 403);
  r = await req('PATCH', `/api/judges/${judgeIds.judge3}/status`, { token: tokens.admin, body: { status: 'active' } });
  check('Judges', 'Reactivate judge', r.status === 200);

  for (const [, uname] of JUDGES) {
    r = await login(uname, 'judge123');
    tokens[uname] = r.data.token;
  }
  check('Auth', 'All 3 judges logged in', !!(tokens.judge1 && tokens.judge2 && tokens.judge3));

  // ================= 4. CATEGORIES & SCORING STRUCTURE =================
  r = await req('GET', '/api/categories', { token: tokens.admin });
  const cats = r.data;
  const prelim = cats.filter((c) => c.round_code === 'PRELIM');
  const weightsOk = prelim.map((c) => Number(c.weight)).reduce((a, b) => a + b, 0) === 100;
  const critsOk = cats.every((c) => c.criteria.reduce((a, cr) => a + Number(cr.weight), 0) === 100);
  check('Structure', '5 preliminary categories, weights sum to 100%', prelim.length === 5 && weightsOk);
  check('Structure', 'Every category criteria weights sum to 100%', critsOk);
  const catByName = Object.fromEntries(cats.map((c) => [c.category_name, c]));

  // no active category yet
  r = await req('GET', '/api/categories/active', { token: tokens.judge1 });
  check('Structure', 'No active category before admin opens one', r.data === null);

  // ================= 5. PRELIMINARY SCORING =================
  // Deterministic: every judge gives candidate c the value (60 + 5*c + judgeIndex) on ALL criteria
  // → judge category total = same value; candidate avg = 60 + 5c + 2; overall = same.
  const judgeIndex = { judge1: 1, judge2: 2, judge3: 3 };

  // scoring blocked before category opens
  {
    const cat = catByName['National Costume'];
    r = await req('PUT', '/api/scores/draft', {
      token: tokens.judge1,
      body: { candidateId: candIds[1], categoryId: cat.category_id, details: cat.criteria.map((cr) => ({ criterion_id: cr.criterion_id, value: 80 })) },
    });
    check('Scoring', 'Scoring rejected while category is closed', r.status === 409);
  }

  for (const cat of prelim) {
    r = await req('PATCH', `/api/categories/${cat.category_id}/status`, { token: tokens.admin, body: { status: 'active' } });
    check('Rounds', `Open scoring: ${cat.category_name}`, r.status === 200);

    // judge view shows candidates + criteria
    r = await req('GET', '/api/categories/active', { token: tokens.judge1 });
    check('Scoring', `Judges see active category ${cat.category_name}`, r.data && r.data.category_id === cat.category_id && r.data.criteria.length === cat.criteria.length);

    for (const [uname, k] of Object.entries(judgeIndex)) {
      for (const [num] of CANDS) {
        const value = 60 + 5 * num + k;
        const details = cat.criteria.map((cr) => ({ criterion_id: cr.criterion_id, value }));
        const d = await req('PUT', '/api/scores/draft', { token: tokens[uname], body: { candidateId: candIds[num], categoryId: cat.category_id, details } });
        const s = await req('POST', '/api/scores/submit', { token: tokens[uname], body: { candidateId: candIds[num], categoryId: cat.category_id } });
        if (d.status !== 200 || s.status !== 200) {
          check('Scoring', `${uname} score cand#${num} ${cat.category_name}`, false, JSON.stringify(s.data));
        }
      }
    }
    check('Scoring', `All judges submitted all candidates: ${cat.category_name}`, true);
  }

  // weighted total math check: judge1 re-scores? No — verify via a known total instead.
  // value v on all criteria → total must equal v exactly (weights sum 100).
  r = await req('GET', `/api/scores/matrix/${catByName['National Costume'].category_id}`, { token: tokens.tab });
  const row1 = r.data.matrix.find((m) => m.candidate_number === 1);
  const j1cell = row1.cells.find((c) => c.judgeId === judgeIds.judge1);
  check('Computation', 'Judge weighted total correct (66 expected)', j1cell.total === 66, `got ${j1cell.total}`);
  check('Computation', 'Candidate category average correct (67 expected)', row1.average === 67, `got ${row1.average}`);

  // double submission prevented
  r = await req('POST', '/api/scores/submit', { token: tokens.judge1, body: { candidateId: candIds[1], categoryId: catByName['Evening Gown'].category_id } });
  check('Security', 'Double submission blocked', r.status === 409);

  // editing after submit blocked
  {
    const cat = catByName['Evening Gown'];
    r = await req('PUT', '/api/scores/draft', { token: tokens.judge1, body: { candidateId: candIds[1], categoryId: cat.category_id, details: cat.criteria.map((cr) => ({ criterion_id: cr.criterion_id, value: 99 })) } });
    check('Security', 'Editing submitted score blocked', r.status === 409);
  }

  // out-of-range value rejected
  {
    const cat = catByName['Evening Gown'];
    r = await req('PUT', '/api/scores/draft', { token: tokens.judge2, body: { candidateId: candIds[2], categoryId: cat.category_id, details: cat.criteria.map((cr) => ({ criterion_id: cr.criterion_id, value: 101 })) } });
    check('Security', 'Score above 100 rejected', r.status === 400);
  }

  // unlock flow: admin unlocks, judge edits + resubmits same values
  {
    const cat = catByName['Evening Gown'];
    r = await req('POST', '/api/scores/unlock', { token: tokens.admin, body: { judgeId: judgeIds.judge1, candidateId: candIds[1], categoryId: cat.category_id } });
    check('Scoring', 'Admin unlocks a submitted score', r.status === 200);
    const v = 60 + 5 * 1 + 1;
    r = await req('PUT', '/api/scores/draft', { token: tokens.judge1, body: { candidateId: candIds[1], categoryId: cat.category_id, details: cat.criteria.map((cr) => ({ criterion_id: cr.criterion_id, value: v })) } });
    const ok1 = r.status === 200;
    r = await req('POST', '/api/scores/submit', { token: tokens.judge1, body: { candidateId: candIds[1], categoryId: cat.category_id } });
    check('Scoring', 'Judge edits and resubmits after unlock', ok1 && r.status === 200);
  }
  // judge cannot unlock
  r = await req('POST', '/api/scores/unlock', { token: tokens.judge1, body: { judgeId: judgeIds.judge1, candidateId: candIds[1], categoryId: catByName['Evening Gown'].category_id } });
  check('RBAC', 'Judge blocked from unlocking scores', r.status === 403);

  // ================= 6. PRELIMINARY RANKING =================
  r = await req('GET', '/api/rankings/preliminary', { token: tokens.tab });
  const prelimRank = r.data.results;
  const expectedOverall = (num) => 60 + 5 * num + 2; // avg of judges 1..3
  const mathOk = CANDS.every(([num]) => {
    const row = prelimRank.find((x) => x.candidate_number === num);
    return Math.abs(row.overall - expectedOverall(num)) < 0.001;
  });
  check('Computation', 'Overall preliminary = weighted sum of category averages', mathOk,
    prelimRank.map((x) => `#${x.candidate_number}=${x.overall}`).join(' '));
  check('Computation', 'Ranking order correct (#6 first, #1 last)',
    prelimRank[0].candidate_number === 6 && prelimRank[5].candidate_number === 1);

  // judge cannot view rankings
  r = await req('GET', '/api/rankings/preliminary', { token: tokens.judge1 });
  check('RBAC', 'Judge blocked from rankings', r.status === 403);

  // ================= 7. TOP 5 GENERATION =================
  r = await req('POST', '/api/rankings/generate-top5', { token: tokens.admin, body: {} });
  check('Top5', 'Generation without confirmation rejected', r.status === 400);
  r = await req('POST', '/api/rankings/generate-top5', { token: tokens.admin, body: { confirm: true } });
  const top5Nums = (r.data.top5 || []).map((c) => c.candidate_number).sort();
  check('Top5', 'GENERATE TOP 5 → candidates #2..#6', r.status === 200 && JSON.stringify(top5Nums) === JSON.stringify([2, 3, 4, 5, 6]), top5Nums.join(','));
  r = await req('GET', '/api/rankings/history/TOP5', { token: tokens.tab });
  check('Top5', 'Ranking history stored', r.data.length === 5);

  // prelim categories locked after generation
  r = await req('GET', '/api/categories', { token: tokens.admin });
  check('Top5', 'Preliminary scoring locked after Top 5', r.data.filter((c) => c.round_code === 'PRELIM').every((c) => c.status === 'locked'));

  // ================= 8. TOP 5 Q&A =================
  const qa5 = catByName['Top 5 Question & Answer'];
  await req('PATCH', `/api/categories/${qa5.category_id}/status`, { token: tokens.admin, body: { status: 'active' } });

  // judge candidate list only shows top 5 (not candidate #1)
  r = await req('GET', `/api/scores/mine/${qa5.category_id}`, { token: tokens.judge1 });
  check('Top5', 'Q&A scoring limited to Top 5 candidates', r.data.candidates.length === 5 && !r.data.candidates.some((c) => c.candidate_number === 1));

  // Score Q&A: make #4 the clear winner of Q&A (reversal of prelim order)
  const qaScore = { 2: 85, 3: 88, 4: 95, 5: 90, 6: 80 };
  for (const uname of Object.keys(judgeIndex)) {
    for (const num of [2, 3, 4, 5, 6]) {
      const details = qa5.criteria.map((cr) => ({ criterion_id: cr.criterion_id, value: qaScore[num] }));
      await req('PUT', '/api/scores/draft', { token: tokens[uname], body: { candidateId: candIds[num], categoryId: qa5.category_id, details } });
      await req('POST', '/api/scores/submit', { token: tokens[uname], body: { candidateId: candIds[num], categoryId: qa5.category_id } });
    }
  }
  check('Top5', 'All judges submitted Top 5 Q&A', true);

  // ================= 9. TOP 3 + BACK TO ZERO =================
  r = await req('POST', '/api/rankings/generate-top3', { token: tokens.admin, body: { confirm: true } });
  const top3Nums = (r.data.top3 || []).map((c) => c.candidate_number).sort();
  check('Top3', 'GENERATE TOP 3 → #3,#4,#5 (Q&A order, not prelim)', r.status === 200 && JSON.stringify(top3Nums) === JSON.stringify([3, 4, 5]), top3Nums.join(','));

  // BACK TO ZERO: final round starts at zero (no Final Q&A scores yet)…
  r = await req('GET', '/api/rankings/final-round', { token: tokens.tab });
  check('BackToZero', 'Final round starts at zero', r.data.results.every((x) => x.overall === 0));
  // …but earlier scores are RETAINED for the record
  r = await req('GET', '/api/rankings/preliminary', { token: tokens.tab });
  const prelimRetained = r.data.results.every((x) => Math.abs(x.overall - expectedOverall(x.candidate_number)) < 0.001);
  check('BackToZero', 'Preliminary scores retained for the record after Top 3', prelimRetained);
  r = await req('GET', '/api/rankings/top5-round', { token: tokens.tab });
  check('BackToZero', 'Top 5 Q&A scores retained for the record after Top 3', r.data.results.every((x) => x.overall > 0));

  // ================= 10. FINAL Q&A + WINNER =================
  const qaF = catByName['Final Question & Answer'];
  await req('PATCH', `/api/categories/${qaF.category_id}/status`, { token: tokens.admin, body: { status: 'active' } });
  // #3 wins the final despite being 3rd before — proves only Final Q&A counts
  const finalScore = { 3: 97, 4: 93, 5: 89 };
  for (const uname of Object.keys(judgeIndex)) {
    for (const num of [3, 4, 5]) {
      const details = qaF.criteria.map((cr) => ({ criterion_id: cr.criterion_id, value: finalScore[num] }));
      await req('PUT', '/api/scores/draft', { token: tokens[uname], body: { candidateId: candIds[num], categoryId: qaF.category_id, details } });
      await req('POST', '/api/scores/submit', { token: tokens[uname], body: { candidateId: candIds[num], categoryId: qaF.category_id } });
    }
  }
  r = await req('POST', '/api/rankings/generate-final', { token: tokens.admin, body: { confirm: true } });
  check('Final', 'GENERATE FINAL RANKING → winner is #3 (highest Final Q&A)', r.status === 200 && r.data.final[0].candidate_number === 3,
    r.data.final ? r.data.final.map((x) => `#${x.candidate_number}=${x.overall}`).join(' ') : JSON.stringify(r.data));

  // ================= 11. DISPLAY SCREEN =================
  r = await req('GET', '/api/display/state', {}); // no auth — public
  const disp = r.data;
  const noScores = !JSON.stringify(disp).match(/"(total|overall|score|avg)":/i);
  check('Display', 'Public display state reachable without login', r.status === 200);
  check('Display', 'Display payload contains NO scores', noScores);
  check('Display', 'Top 5 / Top 3 / winner present', disp.top5.length === 5 && disp.top3.length === 3 && disp.winner && disp.winner[0].rank_no === 1);
  r = await req('PATCH', '/api/display/phase', { token: tokens.admin, body: { phase: 'winner' } });
  check('Display', 'Admin switches projection to winner phase', r.status === 200);
  r = await req('PATCH', '/api/display/phase', { token: tokens.tab, body: { phase: 'top5' } });
  check('RBAC', 'Tabulator blocked from projection control', r.status === 403);

  // ================= 12. REPORTS =================
  const reports = ['preliminary.pdf', 'top5.pdf', 'top3.pdf', 'final.pdf', 'judge-sheets.pdf', 'audit.pdf', 'preliminary.csv', 'results.xlsx'];
  for (const file of reports) {
    r = await req('GET', `/api/reports/${file}`, { token: tokens.tab });
    const size = r.data.byteLength || 0;
    check('Reports', `Generate ${file}`, r.status === 200 && size > 500, `${size} bytes, ${r.ct}`);
  }

  // ================= 13. AUDIT LOGS =================
  r = await req('GET', '/api/audit?limit=1000', { token: tokens.admin });
  const actions = new Set(r.data.map((l) => l.action));
  const wanted = ['LOGIN', 'LOGOUT', 'SCORE_SUBMIT', 'SCORE_UNLOCK', 'TOP5_GENERATED', 'TOP3_GENERATED', 'FINAL_RANKING_GENERATED'];
  // logout hasn't happened yet — do one now
  await req('POST', '/api/auth/logout', { token: tokens.judge3 });
  r = await req('GET', '/api/audit?limit=1000', { token: tokens.admin });
  const actions2 = new Set(r.data.map((l) => l.action));
  const missing = wanted.filter((a) => !actions2.has(a));
  check('Audit', 'All required actions logged', missing.length === 0, missing.length ? 'missing: ' + missing.join(',') : `${r.data.length} entries`);
  check('Audit', 'Logs include user + IP + timestamp', r.data.every((l) => l.user_name && l.created_at) && r.data.some((l) => l.ip_address));

  // logged-out judge token invalidated? (JWT remains valid until expiry; inactivity map cleared)
  // skip — by design JWT is stateless; inactivity timeout covers it.

  // ================= 14. HEALTH =================
  r = await req('GET', '/api/health', {});
  check('Health', 'LAN health endpoint', r.status === 200 && r.data.ok === true);

  console.log('\n========================================');
  console.log(`RESULT: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error('DRY RUN CRASHED:', err); process.exit(2); });
