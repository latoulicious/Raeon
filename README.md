# Raeon

![Banner](./assets/banner.png)

## Prerequisites

- Node.js 24+
- Docker (runs the Lavalink audio node)

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
   LAVALINK_PASSWORD=shared_with_the_lavalink_node
   DATABASE_URL=postgresql://user:password@localhost:5432/raeon
   ```

4. Start the Lavalink node:

   ```bash
   docker compose up -d lavalink
   ```

5. Build the project:

   ```bash
   npm run build
   ```

6. Run the bot:

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
   LAVALINK_PASSWORD=shared_with_the_lavalink_node
   DATABASE_URL=postgresql://raeon:password@postgres:5432/raeon
   ```

3. Build and run:

   ```bash
   docker-compose up -d --build
   ```

For detailed Docker commands and management, see [DOCKER.md](./docs/DOCKER.md).

## Releases

For information about creating releases and version management, see [RELEASE.md](./docs/RELEASE.md).
