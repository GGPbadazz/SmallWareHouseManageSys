#!/bin/bash

# Start the Spare Parts Warehouse Management System

echo "🚀 Starting Spare Parts Warehouse Management System..."

# Check if we're in the right directory
if [ ! -f "server/server.js" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install server dependencies if needed
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server && npm install && cd ..
fi

# Start the server
echo "🌐 Starting server on http://localhost:3003"
echo "📱 Web interface available at: http://localhost:3003"
echo "🔗 API documentation available at: http://localhost:3003/api/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd server && npm run dev
