const rooms = {};

// Gera código da sala
function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Cria sala
function createRoom(hostId) {
  const code = generateCode();
  rooms[code] = {
    host: hostId,
    players: {},
    order: [] // aqui sim, dentro da sala
  };
  return code;
}

// Jogador entra na sala
function joinRoom(code, playerId, playerName) {
  if (!rooms[code]) return false;
  rooms[code].players[playerId] = { 
    name: playerName, 
    clue: null, 
    card: null 
  };
  return true;
}

// Retorna dados da sala
function getRoom(code) {
  return rooms[code];
}

// Sorteia cartas
function dealCards(code) {
  if (!rooms[code]) return;

  const deck = Array.from({ length: 100 }, (_, i) => i + 1);
  shuffle(deck);

  const players = rooms[code].players;
  Object.keys(players).forEach((id, index) => {
    players[id].card = deck[index];
  });
}

// Embaralhar
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

module.exports = { createRoom, joinRoom, getRoom, dealCards };
