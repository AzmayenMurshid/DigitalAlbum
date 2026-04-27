#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
ENV_FILE="$BACKEND_DIR/.env"
IMAGE_NAME="digitalalbum-backend"
CONTAINER_NAME="digitalalbum-backend"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI not found. Install Docker first."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing backend/.env file. Copy backend/.env.example to backend/.env and set DATABASE_URL."
  exit 1
fi

echo "Building Docker image..."
docker build -t "$IMAGE_NAME" "$BACKEND_DIR"

echo "Removing old container (if any)..."
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "Starting container on http://localhost:3001 ..."
docker run --name "$CONTAINER_NAME" --rm -p 3001:3001 --env-file "$ENV_FILE" "$IMAGE_NAME"
