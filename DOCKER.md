# Docker Setup

## Quick Start

1. **Setup environment:**

   ```bash
   cp .env.example .env
   ```

2. **Build and run:**

   ```bash
   docker-compose up -d --build
   ```

3. **View logs:**

   ```bash
   docker-compose logs -f raeon-bot
   ```

## Environment Variables

Required in `.env`:

```bash
DISCORD_TOKEN=your_discord_bot_token
DATABASE_URL=postgresql://raeon:password@postgres:5432/raeon
YTDLP_COOKIES_PATH=/app/cookies.txt  # Optional
NODE_ENV=production
LOG_LEVEL=info
```

## Common Commands

```bash
# View logs
docker-compose logs -f raeon-bot

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build

# Connect to database
docker-compose exec postgres psql -U raeon -d raeon

# Backup database
docker-compose exec postgres pg_dump -U raeon raeon > backup.sql

# Restore database
docker-compose exec -T postgres psql -U raeon raeon < backup.sql
```

## Troubleshooting

- **Database connection:** Ensure DATABASE_URL uses `postgres:5432`
- **yt-dlp failures:** Check cookies file mounting at `/app/cookies.txt`
- **Permission errors:** Verify non-root user permissions

## Services Overview

- **raeon-bot:** Main Discord bot with FFmpeg and yt-dlp
- **postgres:** PostgreSQL 15 database with persistent storage
