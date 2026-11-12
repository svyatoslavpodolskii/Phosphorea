const seenKey='phosphorea:release-seen';
export function shouldShowRelease(existing:boolean){try{const seen=localStorage.getItem(seenKey);if(!seen&&!existing){markReleaseSeen();return false;}return seen!==import.meta.env.VITE_APP_VERSION;}catch{return false;}}
export function markReleaseSeen(){try{localStorage.setItem(seenKey,import.meta.env.VITE_APP_VERSION);}catch{}}
