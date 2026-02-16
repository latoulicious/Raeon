# Raeon

<img src="./assets/banner.png" alt="Raeon">

## Prerequisites

- Node.js 21+
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

