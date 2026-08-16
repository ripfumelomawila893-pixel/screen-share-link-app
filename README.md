# ShareLink — consent-based screen sharing

A small link-based screen-sharing website using WebRTC and WebSocket signaling.

## What it does

- Device A creates a room and gets a shareable link.
- Device B opens the link.
- The browser requires Device B/the sharing user to explicitly choose what to share.
- The screen is sent peer-to-peer using WebRTC.
- A room is limited to two connected devices.

## Run locally

Requirements: Node.js 18+.

```bash
npm install
npm start
```

Open:

http://localhost:3000

For two devices on the same network, use the computer's LAN address, for example:

http://192.168.1.20:3000

For production use, deploy behind HTTPS/WSS. Screen capture APIs require a secure context in supporting browsers.

## Deploying

A Node-compatible host can run:

npm install
npm start

Set the PORT environment variable if your host provides one.

## Important

This project intentionally does NOT attempt to hide screen sharing or bypass browser permissions. `getDisplayMedia()` requires a user interaction and a browser permission/selection prompt.
