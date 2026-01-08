# Scripts

## upload-games.mjs

Uploads all game folders from `/games/` to the R2 bucket.

**Usage:**
```bash
npm run upload-games
```

This will:
1. Scan the `games/` directory for game folders
2. Upload all files (except node_modules and .DS_Store) to the R2 `games` bucket
3. Preserve the folder structure for easy access via `https://games.kaofelix.dev/<game-name>/`

**Adding a new game:**
1. Create a folder in `games/` (e.g., `games/my-new-game/`)
2. Add your game files
3. Run `npm run upload-games`
4. Access at `https://games.kaofelix.dev/my-new-game/`
