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
   # optional, enables DB log mirroring:
   DATABASE_URL=postgresql://raeon:your_db_password@localhost:5432/raeon
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
   DB_PASSWORD=postgres_password_for_the_stack
   ```

   In-stack `LAVALINK_HOST` and `DATABASE_URL` are injected by compose.

3. Build and run:

   ```bash
   docker compose up -d --build
   ```

For detailed Docker commands and management, see [DOCKER.md](./docs/DOCKER.md).

## Releases

For information about creating releases and version management, see [RELEASE.md](./docs/RELEASE.md).
