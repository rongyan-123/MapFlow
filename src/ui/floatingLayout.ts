export function floatingLayout(anchor: {left:number;right:number;top:number;bottom:number}, viewport: {width:number;height:number;x?:number;y?:number}, desiredWidth:number, contentHeight:number, preference:'left'|'right') {
  const margin=12, gap=10, x=viewport.x??0, y=viewport.y??0;
  const width=Math.min(desiredWidth,viewport.width-margin*2);
  const below=y+viewport.height-margin-anchor.bottom-gap;
  const above=anchor.top-y-margin-gap;
  const leftFits=anchor.left-x>=width+gap+margin;
  const rightFits=x+viewport.width-anchor.right>=width+gap+margin;
  const beside=preference==='left'?leftFits:rightFits;
  const downward=below>=Math.min(contentHeight,300)||below>=above;
  const room=Math.max(above,below)<180?viewport.height-margin*2:downward?below:above;
  const height=Math.max(80,Math.min(contentHeight,700,room,viewport.height-margin*2));
  const desiredLeft=beside?(preference==='left'?anchor.left-gap-width:anchor.right+gap):anchor.left;
  const left=Math.max(x+margin,Math.min(desiredLeft,x+viewport.width-margin-width));
  const top=Math.max(y+margin,Math.min(downward?anchor.bottom+gap:anchor.top-gap-height,y+viewport.height-margin-height));
  return {left,top,width,height,originX:(anchor.left+anchor.right)/2-left,originY:(anchor.top+anchor.bottom)/2-top};
}
