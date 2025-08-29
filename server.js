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
  //console.log("🔗 Novo jogador conectado:", socket.id);

  // Criar sala
  socket.on("createRoom", (data, callback) => {
    const { playerName } = data;
    const roomCode = createRoom(socket.id);
    joinRoom(roomCode, socket.id, playerName || "Host");
    socket.join(roomCode);

    //console.log(`📦 Sala criada: ${roomCode} pelo host ${socket.id}`);

    io.to(roomCode).emit("updateRoom", getRoom(roomCode));
    if (typeof callback === "function") callback(roomCode);
  });

  // Entrar em sala
  socket.on("joinRoom", (data, callback) => {
    const { roomCode, playerName } = data;
    const room = getRoom(roomCode);

    if (!room) {
      //console.log(`⚠️ Tentativa de entrada em sala inexistente: ${roomCode}`);
      if (typeof callback === "function") callback("notFound");
      return;
    }

    if (room.started) {
      //console.log(`⛔ Sala ${roomCode} já iniciada, bloqueando entrada de ${socket.id}`);
      if (typeof callback === "function") callback("alreadyStarted");
      return;
    }

    const success = joinRoom(roomCode, socket.id, playerName || "Jogador");
    if (success) {
      socket.join(roomCode);
      //console.log(`👤 Jogador ${playerName} (${socket.id}) entrou na sala ${roomCode}`);
      io.to(roomCode).emit("updateRoom", getRoom(roomCode));
      if (typeof callback === "function") callback("ok");
    } else {
      if (typeof callback === "function") callback("notFound");
    }
  });

  // Iniciar partida
  socket.on("startGame", (roomCode) => {
    const room = getRoom(roomCode);
    if (!room) return;

    room.started = true;
    console.log(`🚀 Partida iniciada na sala ${roomCode}`);
    io.to(roomCode).emit("gameStarted");
    io.to(roomCode).emit("updateRoom", room);
  });

  // Iniciar rodada (tema sorteado)
  socket.on("startRound", (roomCode) => {
    const room = getRoom(roomCode);
    if (!room) return;

    dealCards(roomCode);
    const theme = getRandomTheme();

    Object.keys(room.players).forEach((playerId) => {
      const card = room.players[playerId].card;
      io.to(playerId).emit("yourCard", card);
    });

    //console.log(`🎲 Nova rodada sorteada na sala ${roomCode}, tema: ${theme.title}`);

    io.to(roomCode).emit("newTheme", theme);
    io.to(roomCode).emit("updateRoom", room);
  });

  // Tema livre
  socket.on("customTheme", ({ roomCode, title, low, high }) => {
    const room = getRoom(roomCode);
    if (!room) return;

    dealCards(roomCode);
    const theme = { title, low, high };

    Object.keys(room.players).forEach((playerId) => {
      const card = room.players[playerId].card;
      io.to(playerId).emit("yourCard", card);
    });

    //console.log(`✍️ Tema livre definido na sala ${roomCode}: ${title} (1=${low}, 100=${high})`);

    io.to(roomCode).emit("newTheme", theme);
    io.to(roomCode).emit("updateRoom", room);
  });

  // Jogador envia pista
  socket.on("sendClue", ({ roomCode, clue }) => {
    const room = getRoom(roomCode);
    const player = room?.players[socket.id];
    if (player) {
      //console.log(`💡 Pista recebida na sala ${roomCode} de ${player.name}: ${clue}`);
      io.to(roomCode).emit("newClue", { name: player.name || "SemNome", clue });
    }
  });

  // Atualizar ordem
  socket.on("updateOrder", ({ roomCode, newOrder }) => {
    const room = getRoom(roomCode);
    if (room) {
      room.order = newOrder;
      //console.log(`📊 Ordem atualizada na sala ${roomCode}:`, newOrder);
      io.to(roomCode).emit("orderUpdated", newOrder);
    }
  });

  // Confirmar ordem (fim da rodada)
  socket.on("confirmOrder", (roomCode) => {
    const room = getRoom(roomCode);
    if (room && room.order) {
      const revealed = room.order.map((playerId) => ({
        name: room.players[playerId].name,
        card: room.players[playerId].card,
      }));

      //console.log(`✅ Ordem confirmada na sala ${roomCode}:`, revealed);

      io.to(roomCode).emit("revealResult", revealed);
    }
  });

  // Nova partida
  socket.on("newGame", (roomCode) => {
    //console.log("♻️ Evento newGame recebido de:", socket.id, "na sala:", roomCode);

    const room = getRoom(roomCode);
    if (!room) {
      //console.log("⚠️ Sala não encontrada:", roomCode);
      return;
    }

    // resetar variáveis
    room.order = [];
    room.theme = null;
    Object.keys(room.players).forEach((id) => {
      room.players[id].clue = null;
      room.players[id].card = null;
    });

    //console.log("🎮 Nova partida iniciada na sala:", roomCode);

    io.to(roomCode).emit("newGameStarted");
    io.to(roomCode).emit("updateRoom", room);
  });

  // Desconexão
  socket.on("disconnect", () => {
    //console.log("❌ Jogador saiu:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  //console.log("Servidor rodando na porta " + PORT);
});
