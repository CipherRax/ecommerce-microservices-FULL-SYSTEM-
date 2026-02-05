declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    SERVICE_NAME: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    RABBITMQ_URL: string;
    STRIPE_SECRET_KEY?: string;
    ALLOWED_ORIGINS?: string;
    LOG_LEVEL: string;
  }
}
