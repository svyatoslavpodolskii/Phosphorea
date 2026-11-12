import type {Atom} from '../core/model';
export function lensFocus(state:string,lens:string){return lens==='all'?state!=='archived':state===(lens==='now'?'now':'archived');}
/** Folder geometry follows foreground content, not invisible or ambient context. */
export function folderLensAtoms(atoms:Atom[],lens:string){return atoms.filter(a=>lensFocus(a.state,lens)&&(lens!=='now'||!a.paused));}
