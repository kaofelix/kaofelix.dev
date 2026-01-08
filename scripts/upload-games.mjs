#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BUCKET_NAME = 'games';
const GAMES_DIR = join(process.cwd(), 'games');

function uploadFile(filePath, remotePath) {
  console.log(`  ↑ ${filePath} → ${remotePath}`);
  execSync(`npx wrangler r2 object put ${BUCKET_NAME}/${remotePath} --file "${filePath}" --remote`, {
    stdio: 'inherit'
  });
}

function uploadDirectory(dirPath, remoteBasePath) {
  const files = readdirSync(dirPath);

  for (const file of files) {
    const fullPath = join(dirPath, file);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      uploadDirectory(fullPath, `${remoteBasePath}/${file}`);
    } else if (stats.isFile()) {
      // Skip node_modules and .DS_Store
      if (fullPath.includes('node_modules') || file === '.DS_Store') continue;
      uploadFile(fullPath, `${remoteBasePath}/${file}`);
    }
  }
}

function uploadAllGames() {
  if (!existsSync(GAMES_DIR)) {
    console.error(`Games directory not found: ${GAMES_DIR}`);
    process.exit(1);
  }

  const games = readdirSync(GAMES_DIR).filter(name => {
    const gamePath = join(GAMES_DIR, name);
    return statSync(gamePath).isDirectory();
  });

  if (games.length === 0) {
    console.log('No games found in games directory.');
    return;
  }

  console.log(`\n🎮 Found ${games.length} game(s) to upload:\n`);
  games.forEach((game, i) => console.log(`  ${i + 1}. ${game}`));

  console.log(`\n📤 Uploading to R2 bucket "${BUCKET_NAME}"...\n`);

  for (const game of games) {
    const gamePath = join(GAMES_DIR, game);
    console.log(`\n--- ${game} ---`);
    uploadDirectory(gamePath, game);
    console.log(`✅ ${game} uploaded`);
  }

  console.log(`\n🎉 All games uploaded!\n`);
  console.log('Games available at: https://games.kaofelix.dev/\n');
}

uploadAllGames();
