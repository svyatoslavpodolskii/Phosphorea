<script lang="ts">
 let {id}:{id:string}=$props();
 const paths:Record<string,string>={
  sound:'M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
  daily:'M4 5h16v16H4zM8 2v6M16 2v6M4 10h16M8 14h3v3H8z',
  templates:'M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6',
  branch:'M12 3v7M5 14v7M19 14v7M5 14v-4h14v4',
  molecule:'M5 6l14 2-7 12Z M5 6l7 14M3 6h4M17 8h4M10 20h4',
  compact:'M4 5h3M17 4h3M10 12h3M3 19h3M18 19h3M6 7l5 4M14 11l4-5M12 14l6 4',
  ambient:'M3 12c4-8 14-8 18 0-4 8-14 8-18 0ZM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  lasso:'M6 17c-7-3-2-14 7-13 12 1 9 14 0 14-4 0-8-3-6-6 2-2 5 0 4 3-1 3-5 5-7 7',
  folders:'M3 6V4h7l2 3h9v14H3ZM3 10h18',
  zoom:'M4 6h16M4 18h16M8 3v6M16 15v6',
  kanban:'M3 4h18v16H3zM9 4v16M15 4v16M5 8h2M11 8h2M17 8h2M5 12h2',
  physics:'M3 12h3l3-7 6 14 3-7h3',
  appearance:'M12 3c-12 0-12 18 0 18 5 0-2-6 3-6 9 0 7-12-3-12ZM7 8h.1M12 6h.1M17 8h.1M6 13h.1',
  obsidian:'m12 2 8 6-3 13H7L4 9ZM12 2 9 12l8 9',
 };
 let path=$derived(paths[id.split('.').pop()||'']||'M8 3h8v5h5v8h-5v5H8v-5H3V8h5z');
</script>
<svg class="plugin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={path}/></svg>
<style>.plugin-icon{width:24px;height:24px;flex:none;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;color:var(--theme-muted)}</style>
