# Raeon

![Banner](./assets/banner.png)

## Prerequisites

- Node.js 21+
- yt-dlp installed system-wide
- ffmpeg installed system-wide

## Setup

### Local Development

1. Clone and install dependencies:

   ```bash
   npm install
   ```

2. Copy environment template:

   ```bash
   cp .env.example .env
   ```

3. Fill in your environment variables:

   ```bash
   DISCORD_TOKEN=your_bot_token_here
   YTDLP_COOKIES_PATH=/path/to/your/cookies.txt
   DATABASE_URL=postgresql://user:password@localhost:5432/raeon
   ```

4. Build the project:

   ```bash
   npm run build
   ```

5. Run the bot:

   ```bash
   npm start
   ```

### Docker Setup (Recommended)

1. Copy environment template:

   ```bash
   cp .env.example .env
   ```

2. Fill in your environment variables:

   ```bash
   DISCORD_TOKEN=your_bot_token_here
   DATABASE_URL=postgresql://raeon:password@postgres:5432/raeon
   ```

3. Build and run:

   ```bash
   docker-compose up -d --build
   ```

For detailed Docker commands and management, see [DOCKER.md](./DOCKER.md).

## Releases

For information about creating releases and version management, see [RELEASE.md](./RELEASE.md).

### Quick Release Commands

```bash
# Patch release (bug fixes)
npm run release:patch

# Minor release (new features)  
npm run release:minor

# Major release (breaking changes)
npm run release:major
```
