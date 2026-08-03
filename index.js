const { Client, GatewayIntentBits } = require('discord.js');
const express = require("express");
const fs = require("fs");

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

    client.user.setPresence({
        activities: [
            {
                name: 'les spammeurs 👀',
                type: 3
            }
        ],
        status: 'online'
    });

});


// =======================
// RECONNEXION / ERREURS
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
// SYSTEME RENDEZ-VOUS
// =======================

const rdvFile = "./rdv.json";


if (!fs.existsSync(rdvFile)) {

    fs.writeFileSync(
        rdvFile,
        JSON.stringify({

            "7 décembre 19h00": null,
            "7 décembre 20h00": null,
            "8 décembre 18h00": null,
            "10 décembre 19h30": null

        }, null, 4)
    );

}


function getRDV() {

    return JSON.parse(
        fs.readFileSync(rdvFile)
    );

}


function saveRDV(data) {

    fs.writeFileSync(
        rdvFile,
        JSON.stringify(data, null, 4)
    );

}// =======================
// MAP ANTI-SPAM
// =======================

const users = new Map();
const imageUsers = new Map();


// =======================
// MESSAGE HANDLER
// =======================

client.on('messageCreate', async (message) => {

    if (message.author.bot) return;
    if (!message.guild) return;


    // ===================
    // COMMANDES DE BASE
    // ===================

    if (message.content === '!ping') {

        return message.reply('🏓 Pong !')
            .catch(console.error);

    }


    if (message.content === '!help') {

        return message.reply(
            `
📌 **Commandes Cartii Bot**

🏓 !ping
📅 !rdv
✅ !prendre numéro
❌ !annulerrdv numéro (Admin)
`
        ).catch(console.error);

    }



    // ===================
    // SYSTEME RENDEZ-VOUS
    // ===================


    if (message.content === "!rdv") {


        const rdv = getRDV();


        let liste = "📅 **Rendez-vous disponibles :**\n\n";

        let index = 1;


        for (const date in rdv) {


            if (rdv[date] === null) {

                liste += `**${index}️⃣** ${date}\n`;

            } else {

                liste += `❌ ${date} - Réservé par <@${rdv[date]}>\n`;

            }


            index++;

        }


        liste += "\nPour réserver : `!prendre numéro`";


        return message.channel.send(liste);

    }



    if (message.content.startsWith("!prendre")) {


        const args = message.content.split(" ");

        const choix = Number(args[1]);


        if (!choix) {

            return message.reply(
                "❌ Utilise : `!prendre numéro`"
            );

        }


        const rdv = getRDV();

        const dates = Object.keys(rdv);

        const dateChoisie = dates[choix - 1];



        if (!dateChoisie) {

            return message.reply(
                "❌ Ce rendez-vous n'existe pas."
            );

        }



        if (rdv[dateChoisie] !== null) {

            return message.reply(
                "❌ Ce créneau est déjà réservé."
            );

        }



        rdv[dateChoisie] = message.author.id;


        saveRDV(rdv);



        return message.reply(
            `✅ Ton rendez-vous est confirmé pour **${dateChoisie}**`
        );


    }




    if (message.content.startsWith("!annulerrdv")) {


        if (!message.member.permissions.has("Administrator")) {

            return message.reply(
                "❌ Tu dois être administrateur."
            );

        }


        const args = message.content.split(" ");

        const numero = Number(args[1]);



        const rdv = getRDV();

        const dates = Object.keys(rdv);



        if (!dates[numero - 1]) {

            return message.reply(
                "❌ Numéro invalide."
            );

        }



        rdv[dates[numero - 1]] = null;


        saveRDV(rdv);



        return message.reply(
            `✅ Le rendez-vous **${dates[numero - 1]}** est disponible à nouveau.`
        );


    }



    // ===================
    // ANTI-SPAM TEXTE
    // ===================

    const userId = message.author.id;
    const now = Date.now();


    const timestamps = users.get(userId) || [];

    timestamps.push(now);


    const recent = timestamps.filter(
        t => now - t < 5000
    );


    users.set(userId, recent);



    console.log(
        `[ANTI-SPAM] ${message.author.tag} -> ${recent.length}`
    );



    // ===================
    // ANTI-SPAM IMAGES
    // ===================


    const hasImages = message.attachments.size > 0;

    let recentImagesCount = 0;



    if (hasImages) {


        const imgTimestamps =
            imageUsers.get(userId) || [];


        imgTimestamps.push(now);



        const recentImages =
            imgTimestamps.filter(
                t => now - t < 10000
            );



        imageUsers.set(
            userId,
            recentImages
        );


        recentImagesCount =
            recentImages.length;



        console.log(
            `[ANTI-SPAM IMAGES] ${message.author.tag} -> ${recentImagesCount}`
        );


    }



    // ===================
    // DETECTION SPAM
    // ===================


    const isSpam = recent.length >= 5;

    const isImageSpam =
        hasImages && recentImagesCount >= 3;



    if (isSpam || isImageSpam) {


        try {

            await message.delete();

            console.log(
                `🧹 Message supprimé de ${message.author.tag}`
            );


        } catch(err) {

            console.log(
                "❌ DELETE ERROR:",
                err
            );

        }



        const member =
// =======================
// LOGIN BOT
// =======================

console.log("🚀 Arrivé avant le login Discord");

client.login(process.env.TOKEN)
    .then(() => {
        console.log("✅ Login Discord réussi");
    })
    .catch(err => {
        console.log("❌ Erreur Discord :", err);
    });client.login(process.env.TOKEN);
            await message.guild.members.fetch(userId)
            .catch(() => null);



        if (!member) return;



        try {


            await member.timeout(
                60000,
                "Anti-spam / anti-raid images"
            );



            await message.channel.send(
                `⛔ ${message.author} a été timeout (anti-spam)`
            );


            console.log(
                `⛔ Timeout appliqué à ${message.author.tag}`
            );



        } catch(err) {

            console.log(
                "❌ TIMEOUT ERROR:",
                err
            );

        }



        users.set(userId, []);

        imageUsers.set(userId, []);


    }


});
