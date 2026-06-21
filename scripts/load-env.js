// Loads .env then .env.local before any Prisma module is evaluated.
// Must be the first import in any standalone Node.js/tsx script.
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env') });
config({ path: resolve(root, '.env.local'), override: true });
