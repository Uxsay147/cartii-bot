const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
} = require("discord.js");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TOKEN = process.env.DISCORD_TOKEN;
const NOTIF_CHANNEL_ID = process.env.NOTIF_CHANNEL_ID;
const STORAGE_FILE = path.join(__dirname, "appointments.json"); // null pour désactiver
const WAIT_TIMEOUT_MS = 120_000; // 2 min pour répondre après !rdv

const MONTHS = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

const MONTH_NAMES_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// ---------------------------------------------------------------------------
// Client avec intents minimaux -> moins de RAM, moins de trafic réseau
// ---------------------------------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseRdv(text, refDate) {
  const cleaned = stripAccents(text.toLowerCase().replace(/à/g, "a").trim());
  const match = cleaned.match(/(\d{1,2})\s*([a-z]+)\s*(?:(\d{1,2})h(\d{2})?)?/);
  if (!match) return null;

  const [, dayStr, monthStr, hourStr, minuteStr] = match;
  const month = MONTHS[monthStr];
  if (!month) return null;

  const day = parseInt(dayStr, 10);
  const hour = hourStr ? parseInt(hourStr, 10) : 0;
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;

  const date = new Date(refDate.getFullYear(), month - 1, day, hour, minute);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  return date;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function monthDatesList(refDate) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1;
  const total = daysInMonth(year, month);
  const monthName = MONTH_NAMES_FR[month - 1];

  const lines = [`**Dates disponibles — ${monthName} ${year}**`];
  let row = [];
  for (let d = 1; d <= total; d++) {
    row.push(String(d));
    if (row.length === 7) {
      lines.push(row.join(" · "));
      row = [];
    }
  }
  if (row.length) lines.push(row.join(" · "));
  return lines.join("\n");
}

function saveAppointment(entry) {
  if (!STORAGE_FILE) return;
  let data = [];
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      data = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8"));
    }
  } catch {
    data = [];
  }
  data.push(entry);
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function formatDateHeure(date) {
  const day = date.getDate();
  const monthName = MONTH_NAMES_FR[date.getMonth()];
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return { dateStr: `${day} ${monthName}`, heureStr: `${hh}h${mm}` };
}

// ---------------------------------------------------------------------------
// Commande !rdv
// ---------------------------------------------------------------------------

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.trim() !== "!rdv") return;

  const today = new Date();

  await message.channel.send(
    `${monthDatesList(today)}\n\n` +
    `${message.author}, réponds ici avec ta date + heure, ` +
    `ex: \`8 aout 19h\` (tu as ${WAIT_TIMEOUT_MS / 60000} min).`
  );

  const filter = (m) => m.author.id === message.author.id;
  const collector = message.channel.createMessageCollector({
    filter,
    max: 1,
    time: WAIT_TIMEOUT_MS,
  });

  collector.on("collect", async (reply) => {
    const parsed = parseRdv(reply.content, today);

    if (!parsed) {
      await message.channel.send(
        `${message.author} je n'ai pas compris la date. ` +
        `Format attendu: \`8 aout 19h\`. Refais \`!rdv\` pour réessayer.`
      );
      return;
    }

    saveAppointment({
      userId: message.author.id,
      userName: message.author.tag,
      datetime: parsed.toISOString(),
      createdAt: new Date().toISOString(),
    });

    const { dateStr, heureStr } = formatDateHeure(parsed);

    await message.channel.send(
      `✅ ${message.author} rendez-vous confirmé le ${dateStr} à ${heureStr}.`
    );

    if (NOTIF_CHANNEL_ID) {
      const notifChannel = await client.channels.fetch(NOTIF_CHANNEL_ID).catch(() => null);
      if (notifChannel) {
        await notifChannel.send(
          `📅 ${message.author} a pris rendez-vous le ${dateStr} à ${heureStr}.`
        );
      }
    }
  });

  collector.on("end", (collected) => {
    if (collected.size === 0) {
      message.channel.send(`${message.author} temps écoulé, refais \`!rdv\` si besoin.`);
    }
  });
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

client.once("ready", () => {
  console.log(`DXT Bot connecté en tant que ${client.user.tag}`);
});

if (!TOKEN) {
  console.error("Erreur: variable d'environnement DISCORD_TOKEN manquante.");
  process.exit(1);
}
if (!NOTIF_CHANNEL_ID) {
  console.warn("Attention: NOTIF_CHANNEL_ID non défini, les notifs ne seront pas envoyées.");
}

client.login(TOKEN);
