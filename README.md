# Raeon

![Banner](./assets/banner.png)

## Prerequisites

- Node.js 24+
- Docker (runs the Lavalink audio node)

## Local development

```bash
cp .env.example .env.local   # dev bot token, LAVALINK_HOST=localhost, DEV_GUILD_ID
make help                    # list targets
make dev                     # start Lavalink, build, run the bot
```

`make dev` reads `.env.local`, never `.env`.
