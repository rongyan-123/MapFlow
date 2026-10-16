import { useEffect,useRef,useState } from 'react';
import { flushSync } from 'react-dom';
import { cancelThemeTransition,transitionTheme } from './themeTransition';

export const THEME_STORAGE_KEY='mapflow.theme';
export const THEME_OPTIONS=[{value:'light',label:'温润纸感 · 浅色'},{value:'dark',label:'石墨深色 · 深色'}] as const;
export type MapFlowTheme=(typeof THEME_OPTIONS)[number]['value'];
function parseTheme(value:string|null):MapFlowTheme{
  const normalized=value==='ivory'?'light':value==='blue-gray'?'dark':value;
  return THEME_OPTIONS.find(option=>option.value===normalized)?.value??'light';
}
const THEME_CHANGED_EVENT='mapflow:theme-changed';
export function useTheme(){
  const [theme,changeTheme]=useState<MapFlowTheme>(()=>{try{return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));}catch{return parseTheme(document.documentElement.dataset.mapflowTheme??null);}});
  const requestedTheme=useRef(theme);
  useEffect(()=>{
    const synchronize=(value:string|null)=>{const next=parseTheme(value);requestedTheme.current=next;changeTheme(next);};
    const changed=(event:Event)=>{if(event instanceof CustomEvent&&typeof event.detail==='string')synchronize(event.detail);};
    const stored=(event:StorageEvent)=>{if(event.key===THEME_STORAGE_KEY||event.key===null){cancelThemeTransition();synchronize(event.newValue);}};
    window.addEventListener(THEME_CHANGED_EVENT,changed);window.addEventListener('storage',stored);
    return()=>{window.removeEventListener(THEME_CHANGED_EVENT,changed);window.removeEventListener('storage',stored);};
  },[]);
  useEffect(()=>{
    document.documentElement.dataset.mapflowTheme=theme;
    document.documentElement.style.colorScheme=theme==='dark'?'dark':'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#111319':'#f7f2eb');
    try{localStorage.setItem(THEME_STORAGE_KEY,theme);}catch{/* The theme remains applied when storage is unavailable. */}
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT,{detail:theme}));
  },[theme]);
  return {theme,setTheme:(value:string|((current:MapFlowTheme)=>MapFlowTheme),source?:HTMLElement)=>{
    const next=parseTheme(typeof value==='function'?value(requestedTheme.current):value);
    if(next===requestedTheme.current)return;
    requestedTheme.current=next;
    transitionTheme(()=>flushSync(()=>changeTheme(next)),source);
  }};
}
