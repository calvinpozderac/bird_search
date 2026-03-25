# 🐦 Bird Search — Multiplayer Web Game

A 2-player real-time deduction game. Find the hidden bird before your opponent!

## How to Play

1. One player creates a game (or types a room code) and shares the code with their friend
2. Both players join the same room code
3. On your turn, click a cell on **your own grid** to scan it
4. Edge labels show the **range of possible distances** to the nearest target
5. **Green cells (🌿)** = Range Upgrade — extends how far you can scan
6. **Blue cells (🔬)** = Precision Upgrade — narrows the distance range shown
7. **First player to click the 🐦 cell wins!**

---

## Hosting for Free

### Option A: Railway (Recommended — easiest)

1. Create a free account at [railway.app](https://railway.app)
2. Install the Railway CLI: `npm install -g @railway/cli`
3. In this project folder, run:
   ```bash
   railway login
   railway init
   railway up
   ```
4. Railway will give you a public URL. Share it with your friend!

**Free tier:** 500 hours/month (plenty for playing with a friend)

---

### Option B: Render

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) and create a free account
3. Click **New → Web Service** and connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Deploy! Render gives you a free `.onrender.com` URL.

**Note:** Free Render services spin down after 15 min of inactivity — first load may be slow.

---

### Option C: Run Locally (LAN play)

```bash
npm install
npm start
```

Then share your local IP with a friend on the same network:
- Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- Your friend visits: `http://YOUR_IP:3000`

---

### Option D: Fly.io

```bash
npm install -g flyctl
flyctl auth signup
flyctl launch
flyctl deploy
```

Free tier includes 3 shared VMs.

---

## Project Structure

```
bird-search/
├── package.json          # Node.js config
├── server/
│   └── server.js         # WebSocket game server
├── client/
│   └── index.html        # Full game client (single file)
└── README.md
```

## Technical Notes

- **No database needed** — game state lives in server memory
- **WebSockets** for real-time sync between players
- Each player only sees their own edge labels (private info)
- Room codes are 5 characters — share with friend to connect
