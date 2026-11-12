export type Format='bold'|'italic'|'heading'|'list'|'checkbox'|'task'|'quote'|'code'|'table';
export function formatText(text:string,start:number,end:number,format:Format){
 if(format==='table'){const table='\n\n| Заголовок | Заголовок |\n| --- | --- |\n| Текст | Текст |\n\n';return{text:text.slice(0,start)+table+text.slice(end),start:start+table.length,end:start+table.length};}
 const selected=text.slice(start,end);const markers={bold:'**',italic:'*',code:'`'};
 if(format in markers){const marker=markers[format as keyof typeof markers];const body=selected||'текст';return{text:text.slice(0,start)+marker+body+marker+text.slice(end),start:start+marker.length,end:start+marker.length+body.length};}
 const lineStart=start===0?0:text.lastIndexOf('\n',start-1)+1;
 const prefix={heading:'## ',list:'- ',checkbox:'- [ ] ',task:'- [ ] #task ',quote:'> '}[format as 'heading'|'list'|'checkbox'|'task'|'quote'];
 const body=text.slice(lineStart,end);const inserted=body.split('\n').map(line=>prefix+line).join('\n');
 return{text:text.slice(0,lineStart)+inserted+text.slice(end),start:start+prefix.length,end:end+inserted.length-body.length};
}
