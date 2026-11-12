import {fileURLToPath} from 'node:url';
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'e2e',testMatch:'release-ui.spec.ts',timeout:45000,workers:1,use:{baseURL:'http://127.0.0.1:5173',browserName:'chromium',reducedMotion:'reduce',trace:'retain-on-failure',storageState:{cookies:[],origins:[{origin:'http://127.0.0.1:5173',localStorage:[{name:'phosphorea:tour-v1',value:'seen'}]}]}},webServer:{cwd:fileURLToPath(new URL('..',import.meta.url)),command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true}});
