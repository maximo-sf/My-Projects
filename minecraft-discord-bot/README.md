# 🎮 Minecraft Discord Bot

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=venom&height=160&color=0:0d1117,100:00ff88&text=MINECRAFT%20BOT&fontColor=00ff88&fontSize=36" width="100%" alt="Minecraft Discord Bot"/>
</p>

<p align="center">
  <strong>Discord integration for Minecraft server monitoring and administration.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"/>
  <img src="https://img.shields.io/badge/Minecraft-62B47A?style=for-the-badge&logo=minecraft&logoColor=white" alt="Minecraft"/>
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux"/>
</p>

## 📌 About

A Python-based Discord bot developed to monitor and administer a Minecraft Java server through Discord slash commands.

This project is part of my journey as an ASIR student, exploring Python automation, Linux administration and server management.

## ⚙️ Features

- 📡 Server status and player count.
- 👥 Online player queries.
- 🔄 Automatic status panel updates.
- 🛡️ Administrative commands for kicking, banning and unbanning players.
- ✅ Whitelist management.
- 🖥️ RCON command execution.
- 📝 Administrative logging.

## 🧰 Technologies

- Python
- discord.py
- mcstatus
- mcrcon
- python-dotenv
- Linux

## 🚀 Setup

### 1. Clone the repository

```bash
git clone https://github.com/maximo-sf/minecraft-discord-bot.git
cd minecraft-discord-bot
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install discord.py mcstatus mcrcon python-dotenv
```

### 4. Configure environment variables

Create a `.env` file in the project directory:

```env
DISCORD_TOKEN=your_discord_bot_token
MINECRAFT_HOST=your_minecraft_host
MINECRAFT_PORT=your_minecraft_port
RCON_HOST=your_rcon_host
RCON_PORT=your_rcon_port
RCON_PASSWORD=your_rcon_password
STATUS_CHANNEL_ID=your_status_channel_id
LOG_CHANNEL_ID=your_log_channel_id
```

Replace the example values with your own configuration. Never publish your `.env` file or share your bot token and RCON password.

### 5. Run the bot

```bash
python3 bot.py
```

## 🔐 Security

- Keep credentials in environment variables.
- Restrict administrative commands to authorized users.
- Never commit tokens, passwords or private server information.
- Use RCON only over a properly secured connection.

## 🗺️ Roadmap

- [ ] Improved server monitoring and outage alerts.
- [ ] In-game event notifications.
- [ ] Death message integration.
- [ ] Extended administration panel.
- [ ] Improved error handling and documentation.

## 👨‍💻 Author

**maximo-sf** — ASIR student interested in Linux, networking, automation and cybersecurity.

[GitHub Profile](https://github.com/maximo-sf)

---

<p align="center">
  <code>BUILD • AUTOMATE • SECURE</code>
</p>
