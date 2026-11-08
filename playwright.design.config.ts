import {defineConfig} from '@playwright/test';
const browser=process.env.PHOSPHORA_AUDIT_BROWSER==='firefox'?'firefox':'chromium';
export default defineConfig({
 testDir:'tests/e2e',timeout:90000,workers:1,
 use:{baseURL:'http://127.0.0.1:4290',headless:true,trace:'retain-on-failure'},
 webServer:{command:'npm run preview -- --port 4290 --strictPort',url:'http://127.0.0.1:4290',reuseExistingServer:true},
 projects:[{name:browser,use:{browserName:browser}}]
});
