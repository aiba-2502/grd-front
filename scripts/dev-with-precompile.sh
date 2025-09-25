#!/bin/sh

# 開発サーバーを起動してプリコンパイルを実行するスクリプト

echo "Starting Next.js development server..."

# バックグラウンドで開発サーバーを起動
npm run dev &
SERVER_PID=$!

# サーバーが起動するまで待つ
echo "Waiting for server to start..."
sleep 8

# プリコンパイルスクリプトを実行
echo "Running precompilation..."
node scripts/precompile.js

echo "Development server is ready with precompiled pages!"
echo "Access the application at http://localhost:3000"

# サーバーのプロセスを前面に持ってくる
wait $SERVER_PID