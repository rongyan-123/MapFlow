(()=>{
  const root=document.documentElement;
  try{const saved=localStorage.getItem('mapflow.theme');root.dataset.mapflowTheme=saved==='dark'||saved==='blue-gray'?'dark':'light';}catch{root.dataset.mapflowTheme='light';}
  document.querySelector('.theme-toggle')?.addEventListener('click',event=>{
    const next=root.dataset.mapflowTheme==='dark'?'light':'dark';
    const apply=()=>{root.dataset.mapflowTheme=next;try{localStorage.setItem('mapflow.theme',next);}catch{}};
    if(!document.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches){apply();return;}
    const rectangle=event.currentTarget.getBoundingClientRect();
    const x=rectangle.x+rectangle.width/2,y=rectangle.y+rectangle.height/2;
    const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
    document.startViewTransition(apply).ready.then(()=>root.animate({clipPath:[`circle(${radius}px at ${x}px ${y}px)`,`circle(0px at ${x}px ${y}px)`]},{duration:500,easing:'ease-in-out',pseudoElement:'::view-transition-old(root)'})).catch(()=>{});
  });
  const directory=document.querySelector('details.public-directory');
  if(directory)directory.open=innerWidth>700;
  directory?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{if(innerWidth<=700)directory.open=false;}));
})();
