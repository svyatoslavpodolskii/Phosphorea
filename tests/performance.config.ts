import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({testDir:'performance',timeout:180000,workers:1,use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',storageState:{cookies:[],origins:[{origin:'http://127.0.0.1:4173',localStorage:[{name:'phosphorea:tour-v1',value:'seen'}]}]}},projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'firefox',use:{browserName:'firefox'}}],webServer:{cwd:fileURLToPath(new URL('..',import.meta.url)),command:'npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:true}});
