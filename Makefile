INFRA_DIR ?= ../Infrastructure/lavalink
COMPOSE := docker compose -f $(INFRA_DIR)/docker-compose.yml
LAVALINK_CONTAINER ?= shared-lavalink

.DEFAULT_GOAL := help
.PHONY: help dev require-env-local infra-up wait-lavalink infra-down infra-logs yt-check clean

help:
	@echo "Raeon — local development"
	@echo ""
	@echo "  make dev          build and run the bot on this host (.env.local)"
	@echo "  make infra-up     start Lavalink + yt-cipher"
	@echo "  make infra-down   stop Lavalink + yt-cipher"
	@echo "  make infra-logs   follow Lavalink logs"
	@echo "  make yt-check     probe YouTube playability per client from this IP"
	@echo "  make clean        remove dist and stop infra"
	@echo ""
	@echo "  INFRA_DIR=$(INFRA_DIR)"

dev: require-env-local infra-up wait-lavalink
	npm run build
	set -a && . ./.env.local && set +a && node dist/main.js

# .env.local, never .env: .env holds the production Discord token, and booting
# it here would put a second live instance of the same bot on Discord.
require-env-local:
	@test -f .env.local || { \
		echo "missing .env.local — local runs must not use .env (production token)."; \
		echo ""; \
		echo "  cp .env.example .env.local"; \
		echo ""; \
		echo "then set in .env.local:"; \
		echo "  DISCORD_TOKEN=<a SEPARATE dev bot token, not the one in .env>"; \
		echo "  LAVALINK_HOST=localhost"; \
		echo "  DEV_GUILD_ID=<your test guild id>"; \
		echo "  NODE_ENV=development"; \
		exit 1; \
	}

infra-up:
	@test -f $(INFRA_DIR)/.env || { \
		echo "missing $(INFRA_DIR)/.env — Lavalink needs LAVALINK_PASSWORD and YT_CIPHER_TOKEN."; \
		echo ""; \
		echo "  cp $(INFRA_DIR)/.env.example $(INFRA_DIR)/.env"; \
		exit 1; \
	}
	@docker network inspect lavalink-net >/dev/null 2>&1 || docker network create lavalink-net
	$(COMPOSE) up -d

wait-lavalink:
	@docker inspect $(LAVALINK_CONTAINER) >/dev/null 2>&1 || { \
		echo "$(LAVALINK_CONTAINER) does not exist — run 'make infra-up' first."; \
		exit 1; \
	}
	@printf "waiting for %s to report healthy (first run downloads plugin jars, ~2min)" $(LAVALINK_CONTAINER)
	@for i in $$(seq 1 90); do \
		if [ "$$(docker inspect --format '{{.State.Health.Status}}' $(LAVALINK_CONTAINER) 2>/dev/null)" = "healthy" ]; then \
			echo " healthy"; \
			exit 0; \
		fi; \
		printf "."; \
		sleep 2; \
	done; \
	echo ""; \
	echo "$(LAVALINK_CONTAINER) not healthy after 180s — check 'make infra-logs'."; \
	exit 1

infra-down:
	$(COMPOSE) down

infra-logs:
	$(COMPOSE) logs -f lavalink

yt-check:
	./scripts/yt-ipcheck.sh

clean: infra-down
	rm -rf dist
