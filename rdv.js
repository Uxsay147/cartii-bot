const fs = require("fs");

const file = "./rdv.json";

if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
        "7 décembre 19h00": null,
        "7 décembre 20h00": null,
        "8 décembre 18h00": null
    }, null, 4));
}

function getRDV() {
    return JSON.parse(fs.readFileSync(file));
}

function saveRDV(data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

module.exports = (client) => {

    client.on("messageCreate", async (message) => {

        if (message.author.bot) return;
        if (!message.guild) return;


        if (message.content === "!rdv") {

            const rdv = getRDV();

            let msg = "📅 **Rendez-vous disponibles :**\n\n";

            let i = 1;

            for (const date in rdv) {

                if (rdv[date]) {
                    msg += `❌ ${i}. ${date}\n`;
                } else {
                    msg += `✅ ${i}. ${date}\n`;
                }

                i++;
            }

            msg += "\nPour réserver : `!prendre numéro`";

            return message.reply(msg);
        }


        if (message.content.startsWith("!prendre")) {

            const num = Number(message.content.split(" ")[1]);

            const rdv = getRDV();

            const dates = Object.keys(rdv);

            const choix = dates[num - 1];


            if (!choix) {
                return message.reply("❌ Rendez-vous invalide.");
            }


            if (rdv[choix]) {
                return message.reply("❌ Ce créneau est déjà pris.");
            }


            rdv[choix] = message.author.id;

            saveRDV(rdv);


            return message.reply(
                `✅ Rendez-vous réservé : **${choix}**`
            );

        }

    });

};
