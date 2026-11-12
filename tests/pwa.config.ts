import {fileURLToPath} from 'node:url';
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'pwa',timeout:90000,workers:1,use:{baseURL:'http://127.0.0.1:4282',browserName:'chromium',viewport:{width:1440,height:900},reducedMotion:'reduce',trace:'retain-on-failure',storageState:{cookies:[],origins:[{origin:'http://127.0.0.1:4282',localStorage:[{name:'phosphorea:tour-v1',value:'seen'}]}]}},webServer:{cwd:fileURLToPath(new URL('..',import.meta.url)),command:'node tests/fixtures/pwa-server.mjs',url:'http://127.0.0.1:4282',reuseExistingServer:false}});
