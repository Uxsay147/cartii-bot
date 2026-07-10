const { Client, GatewayIntentBits } = require('discord.js');
const express = require("express");

// =======================
// EXPRESS (IMPORTANT POUR RENDER/RAILWAY WEB SERVICE)
// =======================
const app = express();
app.get("/", (req, res) => {
    res.send("Cartii Bot is alive");
});
app.listen(3000, () => {
    console.log("🌐 Web server running on port 3000");
});

// =======================
// ANTI CRASH GLOBAL
// =======================
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// =======================
// DISCORD CLIENT
// =======================
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

    // Définit le statut affiché sur Discord
    client.user.setPresence({
        activities: [{ name: 'les spammeurs 👀', type: 3 }], // type 3 = "Watching"
        status: 'online'
    });
});

// =======================
// GESTION DECONNEXION / ERREURS CLIENT
// =======================
client.on('shardDisconnect', () => {
    console.log('⚠️ Bot déconnecté, tentative de reconnexion...');
});

client.on('shardReconnecting', () => {
    console.log('🔄 Reconnexion en cours...');
});

client.on('shardResume', () => {
    console.log('✅ Connexion rétablie.');
});

client.on('error', console.error);

// =======================
// MAP ANTI-SPAM (texte)
// =======================
const users = new Map();

// =======================
// MAP ANTI-SPAM (images)
// =======================
const imageUsers = new Map();

// =======================
// MESSAGE HANDLER
// =======================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ===================
    // COMMANDES
    // ===================
    if (message.content === '!ping') {
        return message.reply('🏓 Pong !').catch(console.error);
    }
    if (message.content === '!help') {
        return message.reply('Commandes: !ping').catch(console.error);
    }

    const userId = message.author.id;
    const now = Date.now();

    // ===================
    // ANTI-SPAM TEXTE
    // ===================
    const timestamps = users.get(userId) || [];
    timestamps.push(now);
    const recent = timestamps.filter(t => now - t < 5000);
    users.set(userId, recent);

    console.log(`[ANTI-SPAM] ${message.author.tag} -> ${recent.length}`);

    // ===================
    // DETECTION IMAGES SPAM
    // ===================
    const hasImages = message.attachments.size > 0;
    let recentImagesCount = 0;

    if (hasImages) {
        const imgTimestamps = imageUsers.get(userId) || [];
        imgTimestamps.push(now);
        const recentImages = imgTimestamps.filter(t => now - t < 10000); // fenêtre de 10 secondes
        imageUsers.set(userId, recentImages);
        recentImagesCount = recentImages.length;
        console.log(`[ANTI-SPAM IMAGES] ${message.author.tag} -> ${recentImagesCount}`);
    }

    // ===================
    // TRIGGER SPAM
    // ===================
    const isSpam = recent.length >= 5;
    const isImageSpam = hasImages && recentImagesCount >= 3; // 3 images en 10s = suspect

    if (isSpam || isImageSpam) {
        // DELETE MESSAGE
        try {
            await message.delete();
            console.log(`🧹 Message supprimé de ${message.author.tag}`);
        } catch (err) {
            console.log("❌ DELETE ERROR:", err);
        }

        // TIMEOUT
        if (isSpam || isImageSpam) {
            const member = await message.guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            try {
                await member.timeout(60_000, "Anti-spam / anti-raid images");

                try {
                    await message.channel.send(
                        `⛔ ${message.author} a été timeout (anti-spam)`
                    );
                } catch (err) {
                    console.log("❌ SEND ERROR:", err);
                }

                console.log(`⛔ Timeout appliqué à ${message.author.tag}`);
            } catch (err) {
                console.log("❌ TIMEOUT ERROR:", err);
            }

            users.set(userId, []);
            imageUsers.set(userId, []);
        }
    }
});

// =======================
// LOGIN BOT
// =======================
client.login(process.env.TOKEN);
