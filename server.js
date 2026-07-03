const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const GameEngine = require("./gameEngine");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Banco de dados em memória
const usersDB = new Set();
const activePlayers = new Map(); // socket.id -> username
const matches = new Map(); // matchId -> matchData
const gameEngines = new Map(); // matchId -> GameEngine instance

io.on("connection", (socket) => {
  console.log(`Novo usuário conectado: ${socket.id}`);

  socket.on("register_or_login", ({ username }) => {
    if (!username || username.trim() === "") {
      return socket.emit("auth_error", "Nome inválido!");
    }

    const isOnline = Array.from(activePlayers.values()).includes(username);
    if (isOnline) {
      return socket.emit(
        "auth_error",
        "Este usuário já está online no momento!",
      );
    }

    if (!usersDB.has(username)) {
      usersDB.add(username);
    }

    activePlayers.set(socket.id, username);
    socket.join("lobby");
    socket.emit("auth_success", username);
    io.to("lobby").emit("chat_message", {
      sender: "Sistema",
      msg: `${username} entrou no lobby.`,
    });
    socket.emit("update_matches", Array.from(matches.values()));
  });

  socket.on("send_chat", (msg) => {
    const username = activePlayers.get(socket.id);
    if (username)
      io.to("lobby").emit("chat_message", { sender: username, msg });
  });

  socket.on("create_match", (matchName) => {
    const matchId = `match_${Date.now()}`;
    const match = {
      id: matchId,
      name: matchName,
      status: "criada",
      players: [],
    };
    matches.set(matchId, match);
    io.to("lobby").emit("update_matches", Array.from(matches.values()));
  });

  socket.on("join_match", (matchId) => {
    const match = matches.get(matchId);
    const username = activePlayers.get(socket.id);
    if (match && match.status === "criada") {
      socket.leave("lobby");
      socket.join(matchId);
      match.players.push({ id: socket.id, username });

      io.to(matchId).emit("match_joined", {
        match,
        isCreator: match.players.length === 1,
      });
      io.to("lobby").emit("update_matches", Array.from(matches.values()));
    }
  });

  socket.on("start_match", (matchId) => {
    const match = matches.get(matchId);
    if (match && match.players.length >= 2) {
      match.status = "iniciada";
      const engine = new GameEngine(io, matchId, match.players);
      gameEngines.set(matchId, engine);
      engine.start();
      io.to("lobby").emit("update_matches", Array.from(matches.values()));
    }
  });

  socket.on("player_input", (inputData) => {
    const matchId = Array.from(socket.rooms).find((room) =>
      room.startsWith("match_"),
    );
    const engine = gameEngines.get(matchId);
    if (engine) engine.handleInput(socket.id, inputData);
  });

  socket.on("disconnect", () => {
    const username = activePlayers.get(socket.id);
    if (username) {
      activePlayers.delete(socket.id);
      io.to("lobby").emit("chat_message", {
        sender: "Sistema",
        msg: `${username} saiu.`,
      });
    }
  });
});

server.listen(3000, () => console.log("Servidor rodando na porta 3000"));
