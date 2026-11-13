<script lang="ts">
 import {onMount} from 'svelte';
 import {Editor} from '@tiptap/core';
 import {MarkdownSession,richExtensions} from './rich-markdown';
 import type {Format} from './text-edit';
 let {value,onchange,onwiki,disabled=false}:{value:string;onchange:(markdown:string)=>void;onwiki:(target:string)=>void;disabled?:boolean}=$props();
 let host:HTMLDivElement;let editor:Editor|undefined;let lastValue='';let ready=$state(false);
 const session=new MarkdownSession();
 // A native click/Home can move the DOM caret before ProseMirror receives its
 // asynchronous selectionchange. A stale atomic-block selection would replace
 // that whole block on the first printable key. Reconcile only that case.
 function syncCaret(force=false){
  if(!editor||editor.view.composing||!force&&editor.state.selection.empty)return;
  const view=editor.view,selection=view.dom.ownerDocument.getSelection(),node=selection?.anchorNode;
  if(!selection?.isCollapsed||!node||!view.dom.contains(node))return;
  const element=node.nodeType===3?node.parentElement:node as Element;
  if(element?.closest('[data-source-block]'))return;
  try{const position=view.posAtDOM(node,selection.anchorOffset);if(view.state.doc.resolve(position).parent.inlineContent)editor.commands.setTextSelection(position);}catch{/* A detached DOM selection is handled by ProseMirror's observer. */}
 }
 function load(markdown:string){if(!editor?.markdown)return;lastValue=markdown;editor.commands.setContent(session.load(markdown,editor.markdown),{emitUpdate:false});editor.view.dispatch(editor.state.tr.setStoredMarks([]));session.capture(editor.getJSON());}
 function revealSource(){
  if(!editor?.markdown)return false;const {$from:from,empty}=editor.state.selection;if(!empty||from.parentOffset!==0||editor.isActive('taskItem')||from.depth<1)return false;
  const block=from.node(1),json=block.toJSON();if(block.type.name==='paragraph'&&!block.firstChild?.marks.length)return false;
  const raw=session.blockMarkdown(json,editor.markdown),text=from.parent.textContent,cursor=text?Math.max(0,raw.indexOf(text)):0;
  return editor.commands.insertContentAt({from:from.before(1),to:from.after(1)},{type:'sourceBlock',attrs:{raw,sourceKey:block.attrs.sourceKey,editing:true,cursor}});
 }
 $effect(()=>{const content=value,blocked=disabled;if(ready&&editor){if(editor.isEditable===blocked)editor.setEditable(!blocked,false);if(content!==lastValue&&!editor.isFocused)load(content);}});
 export function focus(){editor?.view.focus();}
 export function format(kind:Format){
  if(!editor)return;editor.view.focus();const chain=editor.chain().focus();
  if(kind==='bold')chain.toggleBold().run();
  else if(kind==='italic')chain.toggleItalic().run();
  else if(kind==='heading')chain.toggleHeading({level:2}).run();
  else if(kind==='list')chain.toggleBulletList().run();
  else if(kind==='quote')chain.toggleBlockquote().run();
  else if(kind==='code')chain.toggleCode().run();
  else if(kind==='table')chain.insertTable({rows:3,cols:2,withHeaderRow:true}).run();
  else if(kind==='checkbox'||kind==='task'){
   if(!editor.isActive('taskItem'))chain.toggleTaskList().run();
   editor.commands.updateAttributes('taskItem',{noteTask:kind==='task'});
  }

 }
 export function insertWiki(raw:string,target:string,label:string){editor?.view.focus();editor?.chain().focus().insertContent({type:'wikiReference',attrs:{raw,target,label}}).run();}
 function wiki(e:MouseEvent|KeyboardEvent){if(e instanceof KeyboardEvent&&e.key!=='Enter')return;const target=(e.target as Element).closest<HTMLElement>('[data-wiki-reference]');if(target){e.preventDefault();onwiki(target.dataset.wikiReference!);}}
 onMount(()=>{
  editor=new Editor({element:host,extensions:richExtensions(),content:{type:'doc',content:[{type:'paragraph'}]},editorProps:{
   attributes:{role:'textbox','aria-label':'Визуальный текст','aria-multiline':'true'},
   handleKeyDown(_view,event){if(event.isComposing||editor?.view.composing)return false;if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey)syncCaret();if(event.key==='Backspace'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){syncCaret(true);return revealSource();}return false;},
   handleDOMEvents:{beforeinput(_view,event){if(!event.cancelable||event.isComposing||!editor||editor.view.composing)return false;if(!['insertParagraph','deleteContentBackward'].includes(event.inputType))return false;syncCaret(true);let handled=false;if(event.inputType==='insertParagraph'&&editor.isActive('taskItem'))handled=editor.commands.splitListItem('taskItem');else if(event.inputType==='deleteContentBackward'){const selection=editor.state.selection;if(selection.empty&&selection.$from.parentOffset===0&&editor.isActive('taskItem'))handled=editor.commands.liftListItem('taskItem');else handled=revealSource();}if(handled)event.preventDefault();return handled;}},
   handlePaste(view,event){const text=event.clipboardData?.getData('text/plain');if(!text||!editor?.markdown)return false;const fragment=new MarkdownSession();editor.commands.insertContent(fragment.load(text,editor.markdown).content||[]);return true;},
  },onUpdate(){if(!editor?.markdown)return;const markdown=session.serialize(editor.getJSON(),editor.markdown);lastValue=markdown;onchange(markdown);}});
  load(value);ready=true;
  return()=>{ready=false;editor?.destroy();editor=undefined;};
 });
</script>
<!-- svelte-ignore a11y_click_events_have_key_events (Wiki links also handle Enter.) -->
<!-- svelte-ignore a11y_no_static_element_interactions (Delegates native editor and wiki-link input.) -->
<div class="rich-text note-content" bind:this={host} onclick={wiki} onkeydown={wiki}></div>
<style>
 .rich-text{overflow:auto;border:0;border-radius:0;padding:4px 0;background:var(--theme-surface);color:var(--theme-text);resize:none}
 .rich-text :global(table){border-collapse:collapse;width:100%;table-layout:fixed;margin:12px 0}
 .rich-text :global(th),.rich-text :global(td){border:1px solid var(--theme-border);padding:8px 10px;vertical-align:top;position:relative;min-width:60px}
 .rich-text :global(th){background:var(--theme-surfaceAlt);font-weight:600;text-align:left}
 .rich-text :global(.selectedCell){background:color-mix(in srgb,var(--theme-accent),transparent 85%)}
 .rich-text :global(img){max-width:100%;height:auto;border-radius:10px}
 .rich-text:focus-within{outline:none}
 .rich-text :global(.tiptap){outline:none;min-height:100%;overflow-wrap:anywhere;white-space:pre-wrap}
 .rich-text :global(.tiptap>p:first-child){margin-top:0}
 .rich-text :global(.tiptap p){color:var(--theme-text);font-size:inherit;line-height:inherit;margin:.5em 0}
 .rich-text :global(.tiptap h2){font-size:1.5em;margin:.75em 0 .4em}
 .rich-text :global(.tiptap a),.rich-text :global([data-wiki-reference]){color:var(--theme-accent);text-decoration:underline;cursor:pointer}
 .rich-text :global(.tiptap blockquote){border-left:3px solid var(--theme-accent);padding-left:14px;margin-left:0}
 .rich-text :global(.tiptap code){font-family:monospace;background:var(--theme-surfaceAlt);border-radius:4px;padding:2px 4px}
 .rich-text :global(.tiptap pre){background:var(--theme-surfaceAlt);padding:12px;white-space:pre-wrap;border-radius:8px}
 .rich-text :global(ul[data-type=taskList]){list-style:none;padding-left:0}
 .rich-text :global(li[data-type=taskItem]){display:flex;gap:10px;align-items:flex-start}
 .rich-text :global(li[data-type=taskItem]>label){flex:none;display:flex;align-items:center;gap:3px;padding-top:5px}
 .rich-text :global(li[data-type=taskItem]>label input){min-height:17px;min-width:17px;width:17px;height:17px;margin:0;accent-color:var(--theme-accent)}
 .rich-text :global(.task-indicator){display:none;color:var(--theme-accent);line-height:1}
 .rich-text :global([data-note-task=true] .task-indicator){display:inline-flex}
 .rich-text :global(li[data-type=taskItem]>div>p){margin:2px 0}
 .rich-text :global(li[data-type=taskItem]>div){flex:1;min-width:0}
 .rich-text :global([data-source-block]){border:1px dashed var(--theme-border);padding:10px;border-radius:8px;margin:12px 0;background:var(--theme-surfaceAlt)}
 .rich-text :global([data-source-block] small){color:var(--theme-muted);font-size:11px}
 .rich-text :global([data-source-block] pre){margin:6px 0 0;padding:0}
 .rich-text :global([data-source-block] button){font-size:11px;padding:4px 8px;min-height:28px;color:var(--theme-muted);background:transparent;border:0}
 .rich-text :global([data-source-block] textarea){width:100%;min-height:80px;padding:4px;border:0;border-radius:0;font:inherit;font-family:monospace;background:transparent;color:var(--theme-text);resize:vertical;outline:none}
 .rich-text :global([data-source-block] [hidden]){display:none}
</style>
