import {defineConfig} from '@playwright/test';
import base from './media.config';
/** Production editor checks in both engines, sharing the isolated preview server. */
export default defineConfig({...base,testDir:'e2e',testMatch:['rich-editor.spec.ts','editor-cleanup.spec.ts']});
