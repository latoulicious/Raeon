# Raeon Discord Music Bot

A production-ready Discord music bot built with TypeScript and clean architecture principles.

## Features

- Clean Architecture with dependency injection
- Streaming audio pipeline (yt-dlp → ffmpeg → Discord)
- YouTube cookies support for bypassing restrictions
- Graceful shutdown handling
- Structured logging with Pino
- Per-guild queue management
- No buffering or temp files

## Prerequisites

- Node.js 18+
- yt-dlp installed system-wide
- ffmpeg installed system-wide

## Setup

1. Clone and install dependencies:
   ```bash
   npm install
   ```

2. Copy environment template:
   ```bash
   cp .env.example .env
   ```

3. Fill in your environment variables:
   ```
   DISCORD_TOKEN=your_bot_token_here
   YTDLP_COOKIES_PATH=/path/to/your/cookies.txt
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Run the bot:
   ```bash
   npm start
   ```

## Development

- `npm run dev` - Watch mode for development
- `npm run build` - Compile TypeScript
- `npm run clean` - Clean build directory

## Architecture

```
src/
├── main.ts                    # Application entry point
├── config/                    # Environment configuration
├── domain/                    # Core business logic
├── infrastructure/            # External integrations
├── application/services/      # Service layer
├── handler/                   # Event handlers
├── commands/                  # Slash commands
└── presence/                  # Discord presence management
```

## License

MIT
