import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, 'public/config.json');
const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Helper to slugify
const toSlug = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

// 1. Update APIs
if (data.apis) {
    data.apis.forEach(api => {
        let key = toSlug(api.name);
        // e.g. "User Service" -> "user-service"
        api.urlKey = key;
    });
}

// 2. Update Envs
if (data.envs) {
    data.envs.forEach(env => {
        // Old: https://api.region-01.prd1.example.com
        // New: https://{api}.region-01.prd1.example.com

        // We only replace if we find the pattern, to be safe.
        if (env.baseUrl && env.baseUrl.includes('https://api.')) {
            env.urlPattern = env.baseUrl.replace('https://api.', 'https://{api}.');
            delete env.baseUrl;
        } else if (env.baseUrl) {
            // Fallback if it doesn't match expected pattern, just append or something? 
            // User said "Currently all APIs use the same base url is wrong".
            // Let's assume the user wants the pattern everywhere.
            // If the pattern doesn't match 'https://api.', maybe it's custom. 
            // Let's just create a generic pattern from the existing one.
            // But for this specific codebase, we know they look like that.
            // For safety, let's just use the known replacement.
            env.urlPattern = env.baseUrl; // Keep as is if no match, renaming key
            delete env.baseUrl;
        }
    });
}

fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
console.log('Migration complete.');
