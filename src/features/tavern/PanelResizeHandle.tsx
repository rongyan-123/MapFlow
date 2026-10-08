import {useEffect,useRef} from 'react';

// Update only panel CSS while dragging. React and the tree layout receive no pointer-frame state.
export default function PanelResizeHandle({label,storageKey,minWidth=320,remainingWidth=360,panelSelector}:{label:string;storageKey:string;minWidth?:number;remainingWidth?:number;panelSelector?:string}) {
  const handle=useRef<HTMLDivElement>(null);
  const drag=useRef<{x:number;width:number;pointer:number}|null>(null);
  const panel=()=>panelSelector?handle.current?.parentElement?.querySelector<HTMLElement>(panelSelector):handle.current?.previousElementSibling as HTMLElement|null;
  const clamp=(width:number)=>{
    const available=handle.current?.parentElement?.getBoundingClientRect().width??0;
    return Math.round(Math.max(Math.min(minWidth,available||minWidth),Math.min(width,Math.max(minWidth,available-remainingWidth))));
  };
  function apply(width:number,persist:boolean) {
    const target=panel();if(!target)return;
    const bounded=clamp(width);target.style.setProperty('--panel-width',`${bounded}px`);
    handle.current?.setAttribute('aria-valuenow',String(bounded));
    if(persist){try{localStorage.setItem(storageKey,String(bounded));}catch{/* Resizing remains available without storage. */}}
  }
  useEffect(()=>{
    const target=panel();if(!target)return;
    try{const saved=Number(localStorage.getItem(storageKey));if(Number.isFinite(saved)&&saved>=minWidth)apply(saved,false);}catch{/* Use CSS defaults. */}
    const resize=()=>{const width=parseFloat(target.style.getPropertyValue('--panel-width'));if(Number.isFinite(width))apply(width,false);};
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);
    if(handle.current?.parentElement)observer?.observe(handle.current.parentElement);
    return()=>{observer?.disconnect();delete document.documentElement.dataset.mapflowResizing;};
  },[storageKey]);
  return <div ref={handle} role="separator" aria-label={label} aria-orientation="vertical" aria-valuemin={minWidth} tabIndex={0}
    className="panel-resize-handle" title="拖动调整宽度；方向键微调；双击恢复默认"
    onPointerDown={event=>{
      if(event.button!==0)return;
      const width=panel()?.getBoundingClientRect().width;if(!width)return;
      drag.current={x:event.clientX,width,pointer:event.pointerId};event.currentTarget.setPointerCapture?.(event.pointerId);
      document.documentElement.dataset.mapflowResizing='true';event.preventDefault();
    }}
    onPointerMove={event=>{const start=drag.current;if(start&&start.pointer===event.pointerId)apply(start.width+event.clientX-start.x,false);}}
    onPointerUp={event=>{const start=drag.current;if(!start)return;apply(start.width+event.clientX-start.x,true);drag.current=null;delete document.documentElement.dataset.mapflowResizing;event.currentTarget.releasePointerCapture?.(event.pointerId);}}
    onPointerCancel={()=>{drag.current=null;delete document.documentElement.dataset.mapflowResizing;}}
    onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();apply((panel()?.getBoundingClientRect().width??minWidth)+(event.key==='ArrowLeft'?-20:20),true);}}}
    onDoubleClick={()=>{panel()?.style.removeProperty('--panel-width');try{localStorage.removeItem(storageKey);}catch{/* Keep CSS defaults. */}}} />;
}
