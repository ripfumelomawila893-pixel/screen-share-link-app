const $ = (id) => document.getElementById(id);

let ws;
let pc;
let room = "";
let role = "";
let localStream = null;

const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = false;
}

function clearError() {
  $("error").hidden = true;
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function connect(roomCode) {
  clearError();
  room = roomCode.toUpperCase();
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => ws.send(JSON.stringify({ type: "join", room }));

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "room-full") {
      showError("That room already has two devices.");
      return;
    }

    if (msg.type === "joined") {
      role = msg.role;
      $("home").hidden = true;
      $("room").hidden = false;
      $("roomCode").textContent = room;
      $("shareLink").value = `${location.origin}/?room=${encodeURIComponent(room)}`;
      $("status").textContent = role === "viewer"
        ? "Waiting for another device to join…"
        : "Connected. You can share your screen after the other device joins.";
      return;
    }

    if (msg.type === "peer-ready") {
      $("status").textContent = "Both devices are connected.";
      $("shareBtn").disabled = role !== "sharer";
      await setupPeer();
      if (role === "sharer") await makeOffer();
      return;
    }

    if (msg.type === "offer") {
      await setupPeer();
      await pc.setRemoteDescription(msg.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: "answer", answer }));
      return;
    }

    if (msg.type === "answer") {
      await pc.setRemoteDescription(msg.answer);
      return;
    }

    if (msg.type === "candidate") {
      if (pc) {
        try { await pc.addIceCandidate(msg.candidate); } catch (e) { console.warn(e); }
      }
      return;
    }

    if (msg.type === "peer-left") {
      $("status").textContent = "The other device left the room.";
      $("shareBtn").disabled = true;
      $("remoteVideo").srcObject = null;
      if (pc) { pc.close(); pc = null; }
    }
  };

  ws.onclose = () => {
    $("status").textContent = "Connection closed.";
  };
}

async function setupPeer() {
  if (pc) return;

  pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
    }
  };

  pc.ontrack = (event) => {
    $("remoteVideo").srcObject = event.streams[0];
    $("status").textContent = "Screen is being shared.";
  };

  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
      $("status").textContent = `Connection: ${pc.connectionState}`;
    }
  };
}

async function makeOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: "offer", offer }));
}

$("createBtn").onclick = () => connect(makeRoomCode());

$("joinBtn").onclick = () => {
  const code = $("roomInput").value.trim();
  if (!code) return showError("Enter a room code.");
  connect(code);
};

$("copyBtn").onclick = async () => {
  await navigator.clipboard.writeText($("shareLink").value);
  $("copyBtn").textContent = "Copied!";
  setTimeout(() => $("copyBtn").textContent = "Copy link", 1500);
};

$("shareBtn").onclick = async () => {
  clearError();
  if (!pc) return showError("Wait until the other device joins.");

  try {
    // The browser MUST show a screen-selection/permission prompt.
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      selfBrowserSurface: "exclude"
    });

    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    // Renegotiate after adding the screen tracks.
    await makeOffer();

    $("stopBtn").disabled = false;
    $("shareBtn").disabled = true;
    $("status").textContent = "Your screen is being shared.";

    localStream.getVideoTracks()[0].addEventListener("ended", stopSharing);
  } catch (err) {
    showError("Screen sharing was cancelled or blocked by the browser.");
  }
};

function stopSharing() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  $("stopBtn").disabled = true;
  $("shareBtn").disabled = role !== "sharer";
  $("status").textContent = "Screen sharing stopped.";
}

$("stopBtn").onclick = stopSharing;

$("leaveBtn").onclick = () => {
  stopSharing();
  if (ws) ws.close();
  if (pc) pc.close();
  location.href = location.pathname;
};

// Auto-join when a link like /?room=ABCD1234 is opened.
const params = new URLSearchParams(location.search);
const invitedRoom = params.get("room");
if (invitedRoom) connect(invitedRoom);