#!/bin/bash

echo "🚀 Starting Spare Parts Management System..."
echo "================================================="

# Kill any existing processes on our ports to avoid conflicts
echo "🧹 Cleaning up any existing processes..."
lsof -ti:3003 | xargs kill -9 2>/dev/null || true
lsof -ti:5715 | xargs kill -9 2>/dev/null || true
sleep 2

# Check if node_modules exist
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server && npm install && cd ..
fi

if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing client dependencies..."
    cd client && npm install && cd ..
fi

# Initialize database if needed
echo "🗄️  Initializing database..."
cd server && npm run init-db && cd ..

# Start both servers
echo "🚀 Starting backend server..."
cd server && npm run dev &
SERVER_PID=$!

echo "🚀 Starting frontend client..."
cd client && npm run dev &
CLIENT_PID=$!

echo "✅ Both servers started!"
echo "📱 Frontend: http://localhost:5715"
echo "� Backend API: http://localhost:3003"
echo "================================================="
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait $SERVER_PID
wait $CLIENT_PID
