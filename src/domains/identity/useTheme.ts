import { useEffect,useState } from 'react';

export const THEME_STORAGE_KEY='mapflow.theme';
export const THEME_OPTIONS=[{value:'light',label:'浅色'},{value:'dark',label:'深色'},{value:'ivory',label:'米色'},{value:'blue-gray',label:'蓝灰'}] as const;
export type MapFlowTheme=(typeof THEME_OPTIONS)[number]['value'];
function parseTheme(value:string|null):MapFlowTheme{return THEME_OPTIONS.find(option=>option.value===value)?.value??'light';}
export function useTheme(){
  const [theme,changeTheme]=useState<MapFlowTheme>(()=>{try{return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));}catch{return 'light';}});
  useEffect(()=>{
    document.documentElement.dataset.mapflowTheme=theme;
    document.documentElement.style.colorScheme=theme==='dark'||theme==='blue-gray'?'dark':'light';
    try{localStorage.setItem(THEME_STORAGE_KEY,theme);}catch{/* The theme remains applied when storage is unavailable. */}
  },[theme]);
  return {theme,setTheme:(value:string)=>changeTheme(parseTheme(value))};
}
