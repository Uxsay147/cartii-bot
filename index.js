const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// =======================
// READY
// =======================
client.once('ready', () => {
    console.log(`🤖 Connecté en tant que ${client.user.tag}`);
});

// =======================
// COMMANDES
// =======================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        message.reply('🏓 Pong !');
    }

    if (message.content === '!help') {
        message.reply('Commandes: !ping');
    }
});

// =======================
// ANTI-SPAM (PRO)
// =======================
const users = new Map();

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const userId = message.author.id;
    const now = Date.now();

    if (!users.has(userId)) {
        users.set(userId, []);
    }

    const timestamps = users.get(userId);

    timestamps.push(now);

    // garder seulement les 5 dernières secondes
    const recent = timestamps.filter(t => now - t < 5000);
    users.set(userId, recent);

    console.log(`[ANTI-SPAM] ${message.author.tag} -> ${recent.length}`);

    // SI SPAM
    if (recent.length >= 5) {
        const member = message.member;

        if (
            member &&
            member.moderatable &&
            member.permissions.has(PermissionsBitField.Flags.ModerateMembers)
        ) {
            try {
                await member.timeout(60_000, "Anti-spam automatique");

                message.channel.send(
                    `⛔ ${message.author} a été timeout pour spam (1 min).`
                );
            } catch (err) {
                console.log("Erreur timeout:", err);
            }
        }

        users.set(userId, []);
    }
});

// =======================
// LOGIN 24/7 (IMPORTANT)
// =======================
client.login(process.env.MTUyMDE3NTQwNjYzOTIxODc2OA.GR8fIr.D3bGD8vCXM3H0PC41h7t6jlNLJEjkUhxXbhmbE);
