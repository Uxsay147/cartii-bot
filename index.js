
import os
import re
import json
import unicodedata
from datetime import datetime, date
 
import discord
from discord.ext import commands
 
# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
 
TOKEN = os.environ.get("DISCORD_TOKEN")
NOTIF_CHANNEL_ID = int(os.environ.get("NOTIF_CHANNEL_ID", "0"))
STORAGE_FILE = "appointments.json"  # mettre None pour désactiver la sauvegarde
WAIT_TIMEOUT = 120  # secondes pour répondre après !rdv
 
MONTHS = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5,
    "juin": 6, "juillet": 7, "aout": 8, "septembre": 9,
    "octobre": 10, "novembre": 11, "decembre": 12,
}
 
# ---------------------------------------------------------------------------
# Intents minimaux -> moins de RAM, moins de trafic réseau avec Discord
# ---------------------------------------------------------------------------
 
intents = discord.Intents.none()
intents.guilds = True
intents.guild_messages = True
intents.message_content = True  # nécessaire pour lire le contenu des messages
 
bot = commands.Bot(
    command_prefix="!",
    intents=intents,
    max_messages=100,       # cache de messages réduit
    chunk_guilds_at_startup=False,  # ne télécharge pas tous les membres au boot
)
 
 
# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------
 
def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )
 
 
def parse_rdv(text: str, ref_date: date):
    """
    Parse un texte du type "8 aout 19h", "8 aout 19h30", "8 aout" (sans heure).
    Retourne un datetime, ou None si le parsing échoue.
    """
    text = strip_accents(text.lower().replace("à", "a").strip())
    match = re.match(
        r"(\d{1,2})\s*([a-z]+)\s*(?:(\d{1,2})h(\d{2})?)?",
        text,
    )
    if not match:
        return None
 
    day_str, month_str, hour_str, minute_str = match.groups()
    month = MONTHS.get(month_str)
    if month is None:
        return None
 
    try:
        day = int(day_str)
        hour = int(hour_str) if hour_str else 0
        minute = int(minute_str) if minute_str else 0
        return datetime(ref_date.year, month, day, hour, minute)
    except ValueError:
        return None
 
 
def load_appointments():
    if not STORAGE_FILE or not os.path.exists(STORAGE_FILE):
        return []
    try:
        with open(STORAGE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
 
 
def save_appointment(entry: dict):
    if not STORAGE_FILE:
        return
    data = load_appointments()
    data.append(entry)
    with open(STORAGE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
 
 
def month_dates_list(ref_date: date) -> str:
    """Construit la liste des jours du mois en cours, format compact."""
    import calendar
    days_in_month = calendar.monthrange(ref_date.year, ref_date.month)[1]
    month_name_fr = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ][ref_date.month - 1]
 
    lines = [f"**Dates disponibles — {month_name_fr} {ref_date.year}**"]
    # Affiche les jours par lignes de 7 pour rester compact
    row = []
    for d in range(1, days_in_month + 1):
        row.append(str(d))
        if len(row) == 7:
            lines.append(" · ".join(row))
            row = []
    if row:
        lines.append(" · ".join(row))
    return "\n".join(lines)
 
 
# ---------------------------------------------------------------------------
# Commande !rdv
# ---------------------------------------------------------------------------
 
@bot.command(name="rdv")
async def rdv(ctx: commands.Context):
    today = datetime.now().date()
 
    await ctx.send(
        f"{month_dates_list(today)}\n\n"
        f"{ctx.author.mention}, réponds ici avec ta date + heure, "
        f'ex: `8 aout 19h` (tu as {WAIT_TIMEOUT // 60} min).'
    )
 
    def check(m: discord.Message):
        return m.author.id == ctx.author.id and m.channel.id == ctx.channel.id
 
    try:
        reply = await bot.wait_for("message", check=check, timeout=WAIT_TIMEOUT)
    except Exception:
        await ctx.send(f"{ctx.author.mention} temps écoulé, refais `!rdv` si besoin.")
        return
 
    parsed = parse_rdv(reply.content, today)
    if parsed is None:
        await ctx.send(
            f"{ctx.author.mention} je n'ai pas compris la date. "
            f'Format attendu: `8 aout 19h`. Refais `!rdv` pour réessayer.'
        )
        return
 
    # Sauvegarde optionnelle
    save_appointment({
        "user_id": ctx.author.id,
        "user_name": str(ctx.author),
        "datetime": parsed.isoformat(),
        "created_at": datetime.now().isoformat(),
    })
 
    # Confirmation dans le channel courant
    date_str = parsed.strftime("%-d %B").lower() if os.name != "nt" else parsed.strftime("%d %B").lower()
    heure_str = parsed.strftime("%Hh%M")
    await ctx.send(f"✅ {ctx.author.mention} rendez-vous confirmé le {date_str} à {heure_str}.")
 
    # Notification dans le channel dédié
    notif_channel = bot.get_channel(NOTIF_CHANNEL_ID)
    if notif_channel:
        await notif_channel.send(
            f"📅 {ctx.author.mention} a pris rendez-vous le {date_str} à {heure_str}."
        )
 
 
# ---------------------------------------------------------------------------
# Démarrage
# ---------------------------------------------------------------------------
 
if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Erreur: variable d'environnement DISCORD_TOKEN manquante.")
    if not NOTIF_CHANNEL_ID:
        raise SystemExit("Erreur: variable d'environnement NOTIF_CHANNEL_ID manquante.")
 
    bot.run(TOKEN)
