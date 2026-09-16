# ReplyAI

ReplyAI is an AI-powered reply assistant project.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Start the services using Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. The backend API will be available at `http://localhost:8000`.

## Environment Setup

Configure your environment variables in the `.env` file. You will need to provide valid API keys for the AI providers you intend to use.

## Project Structure

- `/backend`: Contains the FastAPI backend application.
- `/docker-compose.yml`: Infrastructure configuration for Postgres, Redis, and the Backend.

## Development

- To run migrations:
  ```bash
  docker-compose exec backend alembic upgrade head
  ```
