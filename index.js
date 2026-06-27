const { Client, GatewayIntentBits } = require('discord.js');

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
// MAP ANTI-SPAM
// =======================
const users = new Map();

// =======================
// MESSAGE HANDLER UNIQUE
// =======================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ===================
    // COMMANDES
    // ===================
    if (message.content === '!ping') {
        return message.reply('🏓 Pong !');
    }

    if (message.content === '!help') {
        return message.reply('Commandes: !ping');
    }

    // ===================
    // ANTI-SPAM
    // ===================
    const userId = message.author.id;
    const now = Date.now();

    const timestamps = users.get(userId) || [];
    timestamps.push(now);

    const recent = timestamps.filter(t => now - t < 5000);

    users.set(userId, recent);

    console.log(`[ANTI-SPAM] ${message.author.tag} -> ${recent.length}`);

    // ===================
    // DETECTION IMAGES
    // ===================
    const hasImages = message.attachments.size > 0;

    // ===================
    // RAID / SPAM TRIGGER
    // ===================
    const isSpam = recent.length >= 5;

    if (isSpam || hasImages) {

        // supprimer message (anti scam images)
        try {
            await message.delete();
            console.log(`🧹 Message supprimé de ${message.author.tag}`);
        } catch (err) {
            console.log("❌ DELETE ERROR:", err);
        }

        // timeout si spam
        if (isSpam) {
            const member = await message.guild.members.fetch(userId).catch(() => null);

            if (!member) return;

            try {
                await member.timeout(60_000, "Anti-spam / anti-raid images");

                message.channel.send(
                    `⛔ ${message.author} a été timeout (anti-spam)`
                );

                console.log(`⛔ Timeout appliqué à ${message.author.tag}`);
            } catch (err) {
                console.log("❌ TIMEOUT ERROR:", err);
            }

            users.set(userId, []);
        }
    }
});

// =======================
// LOGIN
// =======================
client.login(process.env.TOKEN);
