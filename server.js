const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function send(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

wss.on("connection", (ws) => {
  let roomId = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "join") {
      roomId = String(msg.room || "").trim().toUpperCase();
      if (!roomId || roomId.length > 32) return;

      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      const room = rooms.get(roomId);

      if (room.size >= 2) {
        send(ws, { type: "room-full" });
        return;
      }

      room.add(ws);
      ws.roomId = roomId;

      send(ws, {
        type: "joined",
        room: roomId,
        role: room.size === 1 ? "viewer" : "sharer"
      });

      if (room.size === 2) {
        for (const peer of room) send(peer, { type: "peer-ready" });
      }
      return;
    }

    if (!roomId || !rooms.has(roomId)) return;

    for (const peer of rooms.get(roomId)) {
      if (peer !== ws) send(peer, msg);
    }
  });

  ws.on("close", () => {
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    room.delete(ws);
    for (const peer of room) send(peer, { type: "peer-left" });
    if (room.size === 0) rooms.delete(roomId);
  });
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Screen-share app running on port ${PORT}`);
});