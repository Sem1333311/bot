const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const HOST = 'Guzele6521.aternos.me';
const PORT = 39746;
const USERNAME = 'AFK_Bot';
const VERSION = '1.21.10';

let bot = null;
let reconnectTimeout = null;
let jumpInterval = null;
let walkActive = false;
let followTarget = null;
let followInterval = null;

function createBot() {
  if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }

  console.log(`[BOT] Подключение к ${HOST}:${PORT}...`);

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: VERSION,
    hideErrors: false,
  });

  bot.loadPlugin(pathfinder);

  // ─── Спавн ───────────────────────────────────────────────────────────────
  bot.once('spawn', () => {
    console.log('[BOT] Заспавнился!');
    setupMovements();
    startWalkAndJump();
  });

  // ─── Авто-возрождение ────────────────────────────────────────────────────
  bot.on('death', () => {
    console.log('[BOT] Умер — возрождаюсь через 1 сек...');
    stopAll();
    setTimeout(() => { try { bot.respawn(); } catch(_){} }, 1000);
  });

  bot.on('respawn', () => {
    console.log('[BOT] Возродился!');
    setupMovements();
    if (!followTarget) startWalkAndJump();
  });

  // ─── Команды из чата ─────────────────────────────────────────────────────
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const args = message.trim().split(' ');
    const cmd = args[0].toLowerCase();

    switch (cmd) {

      case '!stop':
        stopAll();
        bot.chat('Остановился.');
        break;

      case '!start':
        stopAll();
        startWalkAndJump();
        bot.chat('Иду вперёд!');
        break;

      case '!jump':
        if (jumpInterval) {
          clearInterval(jumpInterval); jumpInterval = null;
          bot.chat('Прыжки выключены.');
        } else {
          startJumping();
          bot.chat('Прыжки включены!');
        }
        break;

      case '!follow': {
        const targetName = args[1] || username;
        startFollow(targetName);
        bot.chat(`Следую за ${targetName}!`);
        break;
      }

      case '!unfollow':
        stopFollow();
        startWalkAndJump();
        bot.chat('Прекратил следовать. Иду прямо.');
        break;

      case '!attack': {
        const nearby = bot.nearestEntity(e => e.type === 'mob');
        if (nearby) { bot.attack(nearby); bot.chat('Атакую!'); }
        else bot.chat('Нет мобов рядом.');
        break;
      }

      case '!say':
        if (args.length > 1) bot.chat(args.slice(1).join(' '));
        break;

      case '!help':
        bot.chat('Команды: !stop !start !jump !follow [ник] !unfollow !attack !say <текст> !help');
        break;
    }
  });

  // ─── Логи чата ───────────────────────────────────────────────────────────
  bot.on('message', (msg) => {
    console.log(`[CHAT] ${msg.toAnsi ? msg.toAnsi() : msg.toString()}`);
  });

  // ─── Ошибки / дисконнект ─────────────────────────────────────────────────
  bot.on('error', (err) => { console.error(`[ERROR] ${err.message}`); stopAll(); });

  bot.on('kicked', (reason) => {
    console.warn(`[KICKED] ${reason}`);
    stopAll(); scheduleReconnect();
  });

  bot.on('end', (reason) => {
    console.warn(`[END] Отключён: ${reason || '?'}`);
    stopAll(); scheduleReconnect();
  });
}

// ─── Pathfinder movements ─────────────────────────────────────────────────────
function setupMovements() {
  try {
    const move = new Movements(bot);
    move.allowSprinting = true;
    bot.pathfinder.setMovements(move);
  } catch(_) {}
}

// ─── Ходьба вперёд + прыжки ──────────────────────────────────────────────────
function startWalkAndJump() {
  stopAll();
  bot.setControlState('forward', true);
  walkActive = true;
  startJumping();
  console.log('[BOT] Ходьба + прыжки запущены.');
}

function startJumping() {
  if (jumpInterval) clearInterval(jumpInterval);
  jumpInterval = setInterval(() => {
    if (!bot || !bot.entity) return;
    bot.setControlState('jump', true);
    setTimeout(() => { if (bot && bot.entity) bot.setControlState('jump', false); }, 250);
  }, 1500);
}

// ─── Следование за игроком ───────────────────────────────────────────────────
function startFollow(targetName) {
  stopAll();
  followTarget = targetName;

  followInterval = setInterval(() => {
    if (!bot || !bot.entity) return;
    const player = bot.players[followTarget];
    if (!player || !player.entity) return;
    bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true);
  }, 1000);

  console.log(`[BOT] Следую за ${targetName}`);
}

function stopFollow() {
  followTarget = null;
  if (followInterval) { clearInterval(followInterval); followInterval = null; }
  try { bot.pathfinder.setGoal(null); } catch(_) {}
}

// ─── Стоп всё ────────────────────────────────────────────────────────────────
function stopAll() {
  walkActive = false;
  if (jumpInterval) { clearInterval(jumpInterval); jumpInterval = null; }
  stopFollow();
  try {
    if (bot) {
      bot.setControlState('forward', false);
      bot.setControlState('jump', false);
    }
  } catch(_) {}
}

// ─── Реконнект ───────────────────────────────────────────────────────────────
function scheduleReconnect(delay = 5000) {
  if (reconnectTimeout) return;
  console.log(`[BOT] Переподключение через ${delay / 1000} сек...`);
  reconnectTimeout = setTimeout(() => { reconnectTimeout = null; createBot(); }, delay);
}

// ─── Старт ───────────────────────────────────────────────────────────────────
createBot();