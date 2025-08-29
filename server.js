const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createRoom, joinRoom, getRoom, dealCards } = require("./rooms");
const { getRandomTheme } = require("./themes");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Novo jogador conectado:", socket.id);

  // Criar sala (já registra o host também)
  socket.on("createRoom", (data, callback) => {
    const { playerName } = data;
    const roomCode = createRoom(socket.id);
    joinRoom(roomCode, socket.id, playerName || "Host");
    socket.join(roomCode);

    io.to(roomCode).emit("updateRoom", getRoom(roomCode));

    if (typeof callback === "function") {
      callback(roomCode);
    }
  });

  // Entrar em sala
  socket.on("joinRoom", (data, callback) => {
    const { roomCode, playerName } = data;
    const success = joinRoom(roomCode, socket.id, playerName || "Jogador");

    if (success) {
      socket.join(roomCode);
      io.to(roomCode).emit("updateRoom", getRoom(roomCode));
      if (typeof callback === "function") callback(true);
    } else {
      if (typeof callback === "function") callback(false);
    }
  });

  // Iniciar rodada
  socket.on("startRound", (roomCode) => {
    dealCards(roomCode);
    const theme = getRandomTheme();
    const room = getRoom(roomCode);

    if (!room) return;

    // Carta individual
    Object.keys(room.players).forEach((playerId) => {
      const card = room.players[playerId].card;
      io.to(playerId).emit("yourCard", card);
    });

    // Tema
    io.to(roomCode).emit("newTheme", theme);

    // Atualiza sala
    io.to(roomCode).emit("updateRoom", room);
  });

  // Jogador envia pista
  socket.on("sendClue", ({ roomCode, clue }) => {
    const room = getRoom(roomCode);
    const player = room?.players[socket.id];
    if (player) {
      io.to(roomCode).emit("newClue", { name: player.name || "SemNome", clue });
    } else {
      io.to(roomCode).emit("newClue", { name: socket.id, clue });
    }
  });

  // Jogador atualiza ordem
  socket.on("updateOrder", ({ roomCode, newOrder }) => {
    const room = getRoom(roomCode);
    if (room) {
      room.order = newOrder;
      io.to(roomCode).emit("orderUpdated", newOrder);
    }
  });

  // Host confirma ordem
  socket.on("confirmOrder", (roomCode) => {
    const room = getRoom(roomCode);
    if (room && room.order) {
      const revealed = room.order.map((playerId) => ({
        name: room.players[playerId].name,
        card: room.players[playerId].card,
      }));
      io.to(roomCode).emit("revealResult", revealed);
    }
  });

  // Desconexão
  socket.on("disconnect", () => {
    console.log("Jogador saiu:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta " + PORT);
});
