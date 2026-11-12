const seenKey='phosphorea:release-seen';
export function lastSeenRelease(){try{return localStorage.getItem(seenKey);}catch{return null;}}
export function shouldShowRelease(existing:boolean){try{const seen=localStorage.getItem(seenKey),version=import.meta.env.VITE_APP_VERSION;if(!seen&&!existing){markReleaseSeen();return false;}if(seen&&/^\d+\.\d+\.\d+$/.test(seen)){const before=seen.split('.').map(Number),after=version.split('.').map(Number);for(let i=0;i<3;i++)if(after[i]!==before[i])return after[i]>before[i];return false;}return seen!==version;}catch{return false;}}
export function markReleaseSeen(){try{localStorage.setItem(seenKey,import.meta.env.VITE_APP_VERSION);}catch{}}
