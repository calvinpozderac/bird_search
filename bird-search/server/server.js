const WebSocket = require("ws");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Serve the client HTML file
  if (req.url === "/" || req.url === "/index.html") {
    const filePath = path.join(__dirname, "../client/index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const wss = new WebSocket.Server({ server });

// Game rooms: roomCode -> GameState
const rooms = {};

function createGameState() {
  const ROWS = 16;
  const COLS = 16;

  const allCells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) allCells.push([r, c]);

  shuffle(allCells);

  const numA = randomInt(2, 5) * 2;
  const numB = randomInt(2, 5) * 2;

  const cellsA = new Set(allCells.slice(0, numA).map(cellKey));
  const cellsB = new Set(allCells.slice(numA, numA + numB).map(cellKey));

  let cellC;
  while (true) {
    const r = randomInt(0, ROWS - 1);
    const c = randomInt(0, COLS - 1);
    const key = cellKey([r, c]);
    if (!cellsA.has(key) && !cellsB.has(key)) {
      cellC = key;
      break;
    }
  }

  return {
    rows: ROWS,
    cols: COLS,
    cellsA: [...cellsA],
    cellsB: [...cellsB],
    cellC,
    turn: 0,
    gameOver: false,
    winner: null,
    players: [
      {
        id: 0,
        name: "Player 1",
        color: "#87CEEB",
        range: 3,
        narrowRange: 0,
        selectedCells: [],
        edgeLabels: {},
      },
      {
        id: 1,
        name: "Player 2",
        color: "#DD1717",
        range: 3,
        narrowRange: 0,
        selectedCells: [],
        edgeLabels: {},
      },
    ],
  };
}

function cellKey([r, c]) {
  return `${r},${c}`;
}
function parseKey(key) {
  const [r, c] = key.split(",").map(Number);
  return [r, c];
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getWindow(range, narrowRange, actualDistance, maxPossible) {
  if (actualDistance > range) return null;

  const windowLength = Math.max(range - narrowRange, 0);
  const possible = [];
  const start = Math.max(actualDistance - windowLength, 0);
  const maxIdx = Math.min(range - windowLength + 1, actualDistance);

  for (let i = start; i < maxIdx; i++) {
    let aRange;
    if (windowLength <= 1) {
      aRange = [i + 1, i + 1];
    } else {
      aRange = [i + 1, i + windowLength];
    }
    if (maxPossible !== undefined) {
      if (aRange[0] <= maxPossible) {
        aRange = [aRange[0], Math.min(aRange[1], maxPossible)];
        possible.push(aRange);
      }
    } else {
      possible.push(aRange);
    }
  }

  if (possible.length === 0) return null;
  return possible[Math.floor(Math.random() * possible.length)];
}

function calcDistance(gs, player, row, col, direction) {
  const { rows, cols, cellsA, cellsB, cellC } = gs;
  const cellsASet = new Set(cellsA);
  const cellsBSet = new Set(cellsB);
  const selectedSet = new Set(player.selectedCells);

  const isTarget = (r, c) => {
    const k = cellKey([r, c]);
    return cellsASet.has(k) || cellsBSet.has(k) || k === cellC;
  };

  if (direction === "north") {
    for (let r = row - 1; r >= Math.max(row - 1 - player.range, -1); r--) {
      if (selectedSet.has(cellKey([r, col]))) continue;
      if (isTarget(r, col)) return row - r;
    }
  } else if (direction === "south") {
    for (let r = row + 1; r < Math.min(rows, row + 1 + player.range); r++) {
      if (selectedSet.has(cellKey([r, col]))) continue;
      if (isTarget(r, col)) return r - row;
    }
  } else if (direction === "west") {
    for (let c = col - 1; c >= Math.max(col - 1 - player.range, -1); c--) {
      if (selectedSet.has(cellKey([row, c]))) continue;
      if (isTarget(row, c)) return col - c;
    }
  } else if (direction === "east") {
    for (let c = col + 1; c < Math.min(cols, col + 1 + player.range); c++) {
      if (selectedSet.has(cellKey([row, c]))) continue;
      if (isTarget(row, c)) return c - col;
    }
  }
  return null;
}

function updateEdgeLabels(gs, player, row, col) {
  const maxDists = {
    north: row,
    south: gs.rows - row - 1,
    west: col,
    east: gs.cols - col - 1,
  };

  for (const dir of ["north", "south", "west", "east"]) {
    const dist = calcDistance(gs, player, row, col, dir);
    if (dist !== null) {
      const window = getWindow(
        player.range,
        player.narrowRange,
        dist,
        maxDists[dir]
      );
      if (window) {
        player.edgeLabels[`${row},${col},${dir}`] = window;
      }
    }
  }
}

function removeRedundantLabels(player, row, col) {
  const neighbors = [
    [[row - 1, col], "south"],
    [[row + 1, col], "north"],
    [[row, col - 1], "east"],
    [[row, col + 1], "west"],
  ];
  const selectedSet = new Set(player.selectedCells);
  for (const [[nr, nc], oppDir] of neighbors) {
    if (selectedSet.has(cellKey([nr, nc]))) {
      delete player.edgeLabels[`${nr},${nc},${oppDir}`];
    }
  }

  const redundant = {
    north: [row - 1, col, "north"],
    south: [row + 1, col, "south"],
    west: [row, col - 1, "west"],
    east: [row, col + 1, "east"],
  };
  for (const [dir, [cr, cc, cd]] of Object.entries(redundant)) {
    if (selectedSet.has(cellKey([cr, cc]))) {
      if (player.edgeLabels[`${cr},${cc},${cd}`] !== undefined) {
        delete player.edgeLabels[`${row},${col},${dir}`];
      }
    }
  }
}

function handleCellClick(gs, playerId, row, col) {
  if (gs.gameOver || gs.turn !== playerId) return gs;

  const player = gs.players[playerId];
  const key = cellKey([row, col]);

  if (key === gs.cellC) {
    gs.gameOver = true;
    gs.winner = player.name;
    return gs;
  }

  const selectedSet = new Set(player.selectedCells);
  if (selectedSet.has(key)) {
    player.selectedCells = player.selectedCells.filter((k) => k !== key);
    for (const dir of ["north", "south", "west", "east"]) {
      delete player.edgeLabels[`${row},${col},${dir}`];
    }
  } else {
    player.selectedCells.push(key);
    updateEdgeLabels(gs, player, row, col);
    removeRedundantLabels(player, row, col);
  }

  if (new Set(gs.cellsA).has(key)) player.range += 1;
  else if (new Set(gs.cellsB).has(key)) player.narrowRange += 1;

  gs.turn = (gs.turn + 1) % 2;
  return gs;
}

// Rooms: roomCode -> { state, clients: [ws|null, ws|null] }
function broadcast(room, msg) {
  const json = JSON.stringify(msg);
  for (const ws of room.clients) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

function sendState(room) {
  const gs = room.state;
  // Send each player their own view
  for (let i = 0; i < 2; i++) {
    const ws = room.clients[i];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "state",
          gs,
          myPlayerId: i,
        })
      );
    }
  }
}

wss.on("connection", (ws) => {
  let roomCode = null;
  let playerId = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "join") {
      roomCode = msg.roomCode.toUpperCase().trim();

      if (!rooms[roomCode]) {
        rooms[roomCode] = {
          state: createGameState(),
          clients: [null, null],
        };
      }

      const room = rooms[roomCode];

      // Assign player slot
      if (room.clients[0] === null || room.clients[0]?.readyState > 1) {
        playerId = 0;
        room.clients[0] = ws;
      } else if (
        room.clients[1] === null ||
        room.clients[1]?.readyState > 1
      ) {
        playerId = 1;
        room.clients[1] = ws;
      } else {
        ws.send(JSON.stringify({ type: "error", message: "Room is full!" }));
        return;
      }

      ws.send(
        JSON.stringify({ type: "joined", playerId, roomCode })
      );

      // If both players joined, send initial state
      if (room.clients[0] && room.clients[1]) {
        sendState(room);
      } else {
        ws.send(
          JSON.stringify({
            type: "waiting",
            message: "Waiting for opponent to join...",
          })
        );
      }
    } else if (msg.type === "click") {
      const room = rooms[roomCode];
      if (!room) return;
      handleCellClick(room.state, playerId, msg.row, msg.col);
      sendState(room);
    } else if (msg.type === "reset") {
      const room = rooms[roomCode];
      if (!room) return;
      room.state = createGameState();
      sendState(room);
    } else if (msg.type === "toggleLabels") {
      const room = rooms[roomCode];
      if (!room) return;
      room.state.showLabels = !room.state.showLabels;
      sendState(room);
    }
  });

  ws.on("close", () => {
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];
      if (playerId !== null) room.clients[playerId] = null;
      broadcast(room, {
        type: "playerLeft",
        message: `Player ${playerId + 1} disconnected.`,
      });
      // Clean up empty rooms
      if (!room.clients[0] && !room.clients[1]) {
        delete rooms[roomCode];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Bird Search server running on port ${PORT}`);
});
