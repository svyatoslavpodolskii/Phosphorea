import {marked} from 'marked';
import {sanitizeHTML} from './markdown';

/** Sharing never writes back to the note or rewrites its Markdown source. */
export function noteText(title:string,content:string,markdown:boolean){
 if(markdown)return `${title?'# '+title+'\n\n':''}${content}`;
 const doc=new DOMParser().parseFromString(sanitizeHTML(marked.parse(content,{async:false})),'text/html');
 for(const node of doc.querySelectorAll('.task-mark'))node.remove();
 for(const node of doc.querySelectorAll('input[type=checkbox]'))node.replaceWith(doc.createTextNode(node.hasAttribute('checked')?'[x] ':'[ ] '));
 for(const node of doc.querySelectorAll('br'))node.replaceWith(doc.createTextNode('\n'));
 for(const node of doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,tr'))node.append(doc.createTextNode('\n'));
 const text=(doc.body.textContent||'').replace(/\n{3,}/g,'\n\n').trim();
 return [title.trim(),text].filter(Boolean).join('\n\n');
}
