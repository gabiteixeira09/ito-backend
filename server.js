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
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Novo jogador conectado:", socket.id);

  // Criar sala
  socket.on("createRoom", (data, callback) => {
    const { playerName } = data;
    const roomCode = createRoom(socket.id);
    joinRoom(roomCode, socket.id, playerName || "Host");
    socket.join(roomCode);

    io.to(roomCode).emit("updateRoom", getRoom(roomCode));
    if (typeof callback === "function") callback(roomCode);
  });

  // Entrar em sala (com retorno detalhado)
  socket.on("joinRoom", (data, callback) => {
    const { roomCode, playerName } = data;
    const room = getRoom(roomCode);

    if (!room) {
      if (typeof callback === "function") callback("notFound");
      return;
    }

    if (room.started) {
      if (typeof callback === "function") callback("alreadyStarted");
      return;
    }

    const success = joinRoom(roomCode, socket.id, playerName || "Jogador");
    if (success) {
      socket.join(roomCode);
      io.to(roomCode).emit("updateRoom", getRoom(roomCode));
      if (typeof callback === "function") callback("ok");
    } else {
      if (typeof callback === "function") callback("notFound");
    }
  });

  // Host inicia partida
  socket.on("startGame", (roomCode) => {
    const room = getRoom(roomCode);
    if (!room) return;

    room.started = true;
    io.to(roomCode).emit("gameStarted");
    io.to(roomCode).emit("updateRoom", room);
  });

  // Iniciar rodada com tema sorteado
  socket.on("startRound", (roomCode) => {
    const room = getRoom(roomCode);
    if (!room) return;

    dealCards(roomCode);
    const theme = getRandomTheme();

    Object.keys(room.players).forEach((playerId) => {
      const card = room.players[playerId].card;
      io.to(playerId).emit("yourCard", card);
    });

    io.to(roomCode).emit("newTheme", theme);
    io.to(roomCode).emit("updateRoom", room);
  });

  // Host define tema manual
  socket.on("customTheme", ({ roomCode, title, low, high }) => {
    const room = getRoom(roomCode);
    if (!room) return;

    dealCards(roomCode);
    const theme = { title, low, high };

    Object.keys(room.players).forEach((playerId) => {
      const card = room.players[playerId].card;
      io.to(playerId).emit("yourCard", card);
    });

    io.to(roomCode).emit("newTheme", theme);
    io.to(roomCode).emit("updateRoom", room);
  });

  // Jogador envia pista
  socket.on("sendClue", ({ roomCode, clue }) => {
    const room = getRoom(roomCode);
    const player = room?.players[socket.id];
    if (player) {
      io.to(roomCode).emit("newClue", { name: player.name || "SemNome", clue });
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
        card: room.players[playerId].card
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
