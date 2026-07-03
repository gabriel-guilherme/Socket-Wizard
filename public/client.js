const socket = io();
let currentMatchId = null;

const screens = {
  login: document.getElementById("loginScreen"),
  lobby: document.getElementById("lobbyScreen"),
  room: document.getElementById("roomScreen"),
  game: document.getElementById("gameScreen"),
};

function showScreen(screenName) {
  Object.values(screens).forEach((s) => s.classList.add("hidden"));
  screens[screenName].classList.remove("hidden");
}

function login() {
  const username = document.getElementById("usernameInput").value;
  if (!username || username.trim() === "") {
    return alert("Por favor, insira um nome de usuário.");
  }
  socket.emit("register_or_login", { username });
}

socket.on("auth_success", () => showScreen("lobby"));
socket.on("auth_error", (err) => alert(err));

function sendChat() {
  const input = document.getElementById("chatInput");
  if (input.value.trim() !== "") {
    socket.emit("send_chat", input.value);
    input.value = "";
  }
}

socket.on("chat_message", ({ sender, msg }) => {
  const chat = document.getElementById("chat");
  chat.innerHTML += `<div><b>${sender}:</b> ${msg}</div>`;
  chat.scrollTop = chat.scrollHeight;
});

function createMatch() {
  socket.emit("create_match", "Arena " + Math.floor(Math.random() * 100));
}

socket.on("update_matches", (matches) => {
  const list = document.getElementById("matchesList");
  list.innerHTML = "";
  matches.forEach((m) => {
    if (m.status === "criada") {
      const li = document.createElement("li");
      li.innerHTML = `${m.name} (${m.players.length}/2) <button onclick="joinMatch('${m.id}')">Entrar</button>`;
      list.appendChild(li);
    }
  });
});

function joinMatch(matchId) {
  socket.emit("join_match", matchId);
}

socket.on("match_joined", ({ match, isCreator }) => {
  currentMatchId = match.id;
  showScreen("room");
  if (isCreator) document.getElementById("btnStart").classList.remove("hidden");
});

function startMatch() {
  socket.emit("start_match", currentMatchId);
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let keys = { w: false, a: false, s: false, d: false };
let mouseX = 0,
  mouseY = 0;

window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});
canvas.addEventListener("mousedown", (e) => {
  socket.emit("player_input", {
    keys,
    mouseX,
    mouseY,
    shoot: e.button === 0,
    barrier: e.button === 2,
  });
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

socket.on("game_started", () => {
  showScreen("game");
  setInterval(() => {
    socket.emit("player_input", { keys, mouseX, mouseY });
  }, 1000 / 60);
});

socket.on("state_update", (state) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.crystals.forEach((c) => {
    ctx.fillStyle = c.type === "mana" ? "blue" : "lightblue";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "gray";
  state.barriers.forEach((b) => ctx.fillRect(b.x, b.y, b.width, b.height));

  ctx.fillStyle = "yellow";
  state.projectiles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  Object.values(state.players).forEach((p) => {
    if (p.hp <= 0) return;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.fillText(`${p.username}`, p.x - 15, p.y - 30);
    ctx.fillStyle = "red";
    ctx.fillRect(p.x - 20, p.y + 25, (p.hp / 100) * 40, 5);
    ctx.fillStyle = "blue";
    ctx.fillRect(p.x - 20, p.y + 32, (p.mana / 100) * 40, 5);

    if (p.shield) {
      ctx.strokeStyle = "cyan";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
});
