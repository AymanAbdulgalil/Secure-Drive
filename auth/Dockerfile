# ============================================
# Stage 1: Base
# ============================================
FROM python:3.14-slim AS base
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ============================================
# Stage 2: Development
# ============================================
FROM base AS development
# app code is bind-mounted in dev; no COPY needed

# ============================================
# Stage 3: Production
# ============================================
FROM base AS production

COPY . .

# CMD is specified per-service in docker-compose so this Dockerfile
# is reusable for both auth and core without modification.