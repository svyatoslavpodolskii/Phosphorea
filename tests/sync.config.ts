import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({testDir:'sync-browser',timeout:180000,workers:1,use:{browserName:'chromium',viewport:{width:390,height:844},trace:'retain-on-failure'},webServer:{command:'node scripts/sync-test-server.mjs',cwd:fileURLToPath(new URL('..',import.meta.url)),url:'http://127.0.0.1:4312',reuseExistingServer:false}});
