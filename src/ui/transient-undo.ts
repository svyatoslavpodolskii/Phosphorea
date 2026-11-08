/** One deadline per successful mutation; camera and gesture renders never extend it. */
export function transientUndo<T>(changed:(value:T|null)=>void,lifetime=3200){
 let timer:ReturnType<typeof setTimeout>|undefined;
 function dismiss(){clearTimeout(timer);timer=undefined;changed(null);}
 return {show(value:T){clearTimeout(timer);changed(value);timer=setTimeout(dismiss,lifetime);},dismiss,dispose(){clearTimeout(timer);timer=undefined;}};
}
