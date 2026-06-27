const users = new Map();

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const userId = message.author.id;
    const now = Date.now();

    const timestamps = users.get(userId) || [];

    // ajoute timestamp
    timestamps.push(now);

    // garde seulement les messages des 5 dernières secondes
    const recent = timestamps.filter(t => now - t < 5000);

    users.set(userId, recent);

    console.log(`[ANTI-SPAM] ${message.author.tag} -> ${recent.length}`);

    // seuil spam
    if (recent.length >= 5) {
        const member = await message.guild.members.fetch(userId).catch(() => null);

        if (!member) return;

        try {
            await member.timeout(60_000, "Anti-spam automatique");

            message.channel.send(
                `⛔ ${message.author} a été timeout pour spam (1 min).`
            );
        } catch (err) {
            console.log("Erreur timeout:", err);
        }

        // reset propre
        users.set(userId, []);
    } else {
        users.set(userId, recent);
    }
});
