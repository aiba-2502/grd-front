#!/usr/bin/env node

/**
 * 開発環境起動時に主要ページをプリコンパイルするスクリプト
 * これにより初回アクセス時の遅延を軽減します
 */

const pages = [
  'http://localhost:3000/',
  'http://localhost:3000/login',
  'http://localhost:3000/signup',
  'http://localhost:3000/chat',
  'http://localhost:3000/history',
  'http://localhost:3000/report',
  'http://localhost:3000/mypage'
];

async function precompilePage(url) {
  try {
    console.log(`Precompiling: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Next.js-Precompiler'
      }
    });
    
    if (response.ok) {
      console.log(`✓ Precompiled: ${url}`);
    } else {
      console.log(`✗ Failed to precompile: ${url} (${response.status})`);
    }
  } catch (error) {
    console.log(`✗ Error precompiling ${url}: ${error.message}`);
  }
}

async function precompileAllPages() {
  console.log('Starting precompilation of main pages...');
  
  // 開発サーバーが完全に起動するまで待つ
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 各ページを並列でプリコンパイル
  await Promise.all(pages.map(precompilePage));
  
  console.log('Precompilation complete!');
}

// サーバーが起動するまで待ってから実行
setTimeout(() => {
  precompileAllPages().catch(console.error);
}, 5000);