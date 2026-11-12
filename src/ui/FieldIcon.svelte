<script lang="ts">let {kind='atoms'}:{kind?:string}=$props();</script>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
 {#if kind==='spark'}<path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/>
 {:else if kind==='orbit'}<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><circle cx="19" cy="6" r="1.5" fill="currentColor"/>
 {:else if kind==='flower'}<path d="M12 12C1-2 1 16 12 12c-14 11 4 11 0 0 11 14 11-4 0 0C26 1 8 1 12 12Z"/><circle cx="12" cy="12" r="2"/>
 {:else}<path d="m5 18 7-12 7 12H5Z"/><circle cx="12" cy="6" r="3" fill="currentColor"/><circle cx="5" cy="18" r="2.2" fill="var(--theme-surface)"/><circle cx="19" cy="18" r="2.5" fill="var(--theme-surface)"/>{/if}
</svg>
