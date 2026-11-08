import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
import './ui/design-polish.css';
performance.mark('phosphora:boot');
mount(App, {target: document.getElementById('app')!});

// Fetch the optional GPU engine while SQLite opens, before the map needs its first frame.
void import('./graph/gpu-renderer').catch(()=>{});
