/**
 * Multiplayer relay server — Phase 4
 *
 * Simple WebSocket broadcast server. Receives player state messages and
 * relays them to all other connected clients. No game logic — just a relay.
 *
 * Run: node server/multiplayer-server.js
 * Default port: 8787
 */
import { WebSocketServer } from 'ws';

const PORT = process.env.MP_PORT || 8787;
const wss = new WebSocketServer({ port: PORT });

const clients = new Map(); // ws → { id, name }

console.log(`[Multiplayer] Relay server running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log(`[Multiplayer] Client connected (total: ${wss.clients.size})`);
  let clientId = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === 'join') {
      clientId = msg.id;
      clients.set(ws, { id: msg.id, name: msg.name });
      console.log(`[Multiplayer] ${msg.name} (${msg.id}) joined`);
      broadcastCount();
      return;
    }

    if (msg.type === 'leave') {
      for (const [otherWs] of clients) {
        if (otherWs !== ws && otherWs.readyState === 1) {
          otherWs.send(JSON.stringify({ type: 'leave', id: msg.id }));
        }
      }
      return;
    }

    if (msg.type === 'state') {
      const payload = JSON.stringify(msg);
      for (const [otherWs] of clients) {
        if (otherWs !== ws && otherWs.readyState === 1) {
          otherWs.send(payload);
        }
      }
      return;
    }
  });

  ws.on('close', () => {
    if (clientId) {
      console.log(`[Multiplayer] ${clients.get(ws)?.name} (${clientId}) left`);
      for (const [otherWs] of clients) {
        if (otherWs !== ws && otherWs.readyState === 1) {
          otherWs.send(JSON.stringify({ type: 'leave', id: clientId }));
        }
      }
    }
    clients.delete(ws);
    broadcastCount();
  });
});

function broadcastCount() {
  const count = clients.size;
  const payload = JSON.stringify({ type: 'count', count });
  for (const [ws] of clients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}
