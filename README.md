# E-commerce Microservices Platform

A scalable microservices-based e-commerce platform built with Node.js.

## Architecture
- **API Gateway**: Fastify-based gateway with rate limiting and circuit breaking
- **Auth Service**: JWT-based authentication with OAuth2 support
- **Product Service**: Product catalog with Redis caching
- **Order Service**: Order processing with Saga pattern
- **Payment Service**: Stripe integration with idempotency
- **Notification Service**: Multi-channel notifications

## Tech Stack
- Node.js 18+
- Fastify/Express
- PostgreSQL
- Redis
- RabbitMQ/Kafka
- Docker & Kubernetes
- Stripe API

## Getting Started

1. **Clone and Install**
   ```bash
   git clone <repo-url>
   cd ecommerce-microservices
   npm install
