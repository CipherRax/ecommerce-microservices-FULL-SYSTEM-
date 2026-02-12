#!/bin/bash

echo "🚀 Deploying Payment Service to Production..."

# Build
echo "📦 Building application..."
npm run build

# Check environment variables
if [ -z "$MPESA_CONSUMER_KEY" ]; then
    echo "❌ MPESA_CONSUMER_KEY is not set"
    exit 1
fi

if [ -z "$MPESA_CONSUMER_SECRET" ]; then
    echo "❌ MPESA_CONSUMER_SECRET is not set"
    exit 1
fi

# Start the service
echo "▶️  Starting service..."
pm2 start dist/index.js --name "payment-service" --time

echo "✅ Deployment complete!"
echo "📊 Check logs: pm2 logs payment-service"
echo "🔄 Restart: pm2 restart payment-service"
echo "🛑 Stop: pm2 stop payment-service"