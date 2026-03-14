.PHONY: help dev dev-bg prod prod-bg \
        build build-nc build-vite build-vite-nc build-api build-api-nc \
        logs vite-logs api-logs postgres-logs minio-logs \
        ps down restart restart-vite restart-api restart-postgres restart-minio \
        shell-api shell-postgres clean nuke

# Default target
.DEFAULT_GOAL := help

#==============================================================================
# VARIABLES
#==============================================================================

# MODE can be set via: make dev MODE=prod
MODE ?= dev

# Compose file and env file selection based on MODE
ifeq ($(MODE),prod)
    COMPOSE_FILE := docker-compose-prod.yml
    ENV_FILE := .env.prod
else
    COMPOSE_FILE := docker-compose-dev.yml
    ENV_FILE := .env.dev
endif

# Docker compose command with selected file and env file
DC := docker compose -f $(COMPOSE_FILE) --env-file $(ENV_FILE)

#==============================================================================
# HELPER FUNCTION
#==============================================================================

# Check if containers are running
define check_running
	@if ! $(DC) ps -q | grep -q .; then \
		echo "ERROR: No containers running in $(MODE) mode"; \
		exit 1; \
	fi
endef

#==============================================================================
# HELP
#==============================================================================

help:
	@echo "=========================================================="
	@echo "                    Available Commands"
	@echo "=========================================================="
	@echo ""
	@echo "  make  |  make help     - Show this help message"
	@echo ""
	@echo "Starting:"
	@echo "  make dev               - Start in dev mode (foreground)"
	@echo "  make dev-bg            - Start in dev mode (background)"
	@echo "  make prod              - Start in prod mode (foreground)"
	@echo "  make prod-bg           - Start in prod mode (background)"
	@echo ""
	@echo "Building:"
	@echo "  make build             - Build all services"
	@echo "  make build-nc          - Build all services without cache"
	@echo "  make build-vite        - Build vite with cache"
	@echo "  make build-vite-nc     - Build vite without cache"
	@echo "  make build-api         - Build api with cache"
	@echo "  make build-api-nc      - Build api without cache"
	@echo ""
	@echo "Logs:"
	@echo "  make logs              - View all logs"
	@echo "  make vite-logs         - View vite logs"
	@echo "  make api-logs          - View api logs"
	@echo "  make postgres-logs     - View postgres logs"
	@echo "  make minio-logs        - View minio logs"
	@echo ""
	@echo "Operations:"
	@echo "  make ps                - Show container status"
	@echo "  make down              - Stop all containers"
	@echo "  make restart           - Restart all containers"
	@echo "  make restart-vite      - Restart vite container"
	@echo "  make restart-api       - Restart api container"
	@echo "  make restart-postgres  - Restart postgres container"
	@echo "  make restart-minio     - Restart minio container"
	@echo "  make shell-api         - Open bash in the api container"
	@echo "  make shell-postgres    - Open psql in postgres container"
	@echo "  make clean             - Stop & remove volumes (deletes data!)"
	@echo ""
	@echo "Mode Selection:"
	@echo "  All commands use dev mode by default"
	@echo "  Add MODE=prod to use production mode, e.g.:"
	@echo "    make logs MODE=prod"
	@echo "    make down MODE=prod"
	@echo "    make build MODE=prod"
	@echo ""
	@echo "=========================================================="

#==============================================================================
# START TARGETS
#==============================================================================

dev:
	@echo "Starting in development mode..."
	@$(DC) up

dev-bg:
	@echo "Starting in development mode (background)..."
	@$(DC) up -d
	@echo "Containers started. Use 'make logs' to view logs"

prod:
	@$(MAKE) dev MODE=prod

prod-bg:
	@$(MAKE) dev-bg MODE=prod

#==============================================================================
# BUILD TARGETS
#==============================================================================

build:
	@echo "Building all services in $(MODE) mode..."
	@$(DC) build

build-nc:
	@echo "Building all services without cache in $(MODE) mode..."
	@$(DC) build --no-cache

build-vite:
	@echo "Building vite in $(MODE) mode..."
	@$(DC) build vite

build-vite-nc:
	@echo "Building vite without cache in $(MODE) mode..."
	@$(DC) build --no-cache vite

build-api:
	@echo "Building api in $(MODE) mode..."
	@$(DC) build api

build-api-nc:
	@echo "Building api without cache in $(MODE) mode..."
	@$(DC) build --no-cache api

#==============================================================================
# LOG TARGETS
#==============================================================================

logs:
	$(call check_running)
	@echo "Showing all logs in $(MODE) mode..."
	@$(DC) logs -f

vite-logs:
	$(call check_running)
	@echo "Showing vite logs in $(MODE) mode..."
	@$(DC) logs -f vite

api-logs:
	$(call check_running)
	@echo "Showing api logs in $(MODE) mode..."
	@$(DC) logs -f api

postgres-logs:
	$(call check_running)
	@echo "Showing postgres logs in $(MODE) mode..."
	@$(DC) logs -f postgres

minio-logs:
	$(call check_running)
	@echo "Showing minio logs in $(MODE) mode..."
	@$(DC) logs -f minio

#==============================================================================
# OPERATION TARGETS
#==============================================================================

ps:
	$(call check_running)
	@echo "================================================================="
	@echo "              Container Status ($(MODE) mode)"
	@echo "================================================================="
	@echo ""
	@$(DC) ps
	@echo ""
	@echo "================================================================="

down:
	@echo "Stopping all containers in $(MODE) mode..."
	@$(DC) down
	@echo "Containers stopped"

restart:
	$(call check_running)
	@echo "Restarting all containers in $(MODE) mode..."
	@$(DC) restart

restart-vite:
	$(call check_running)
	@echo "Restarting vite in $(MODE) mode..."
	@$(DC) restart vite

restart-api:
	$(call check_running)
	@echo "Restarting api in $(MODE) mode..."
	@$(DC) restart api

restart-postgres:
	$(call check_running)
	@echo "Restarting postgres in $(MODE) mode..."
	@$(DC) restart postgres

restart-minio:
	$(call check_running)
	@echo "Restarting minio in $(MODE) mode..."
	@$(DC) restart minio

shell-api:
	$(call check_running)
	@echo "Opening shell in api container..."
	@$(DC) exec api bash

shell-postgres:
	$(call check_running)
	@echo "Opening psql in postgres container..."
	@set -a && . $(ENV_FILE) && set +a && \
		$(DC) exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB

#==============================================================================
# CLEANUP TARGETS
#==============================================================================

clean:
	@echo "WARNING: This will DELETE ALL DATA including the database!"
	@echo -n "Are you sure you want to continue? [y/N] " && read confirm && \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		echo "Cleaning everything in $(MODE) mode..."; \
		$(DC) down -v; \
		echo "SUCCESS: Cleaned!"; \
	else \
		echo "CANCELLED: No changes made"; \
	fi