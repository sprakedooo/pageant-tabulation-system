const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { SECRET } = require('./auth');

let io = null;

function initSockets(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    // Display screens connect anonymously; staff connect with a token.
    const token = socket.handshake.auth && socket.handshake.auth.token;
    let role = 'display';
    if (token) {
      try { role = jwt.verify(token, SECRET).role; } catch { role = 'display'; }
    }
    socket.join(role);
    socket.join('all');
    socket.emit('connected', { role });
  });

  return io;
}

// Broadcast helpers — staff rooms get data, display room gets only safe payloads.
function emitToStaff(event, payload) {
  if (!io) return;
  io.to('admin').to('tabulator').emit(event, payload);
}
function emitToJudges(event, payload) {
  if (io) io.to('judge').emit(event, payload);
}
function emitToAll(event, payload) {
  if (io) io.to('all').emit(event, payload);
}
function emitToDisplay(event, payload) {
  if (io) io.to('display').emit(event, payload);
}

module.exports = { initSockets, emitToStaff, emitToJudges, emitToAll, emitToDisplay };
