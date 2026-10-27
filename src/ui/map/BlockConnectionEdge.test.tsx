import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BlockConnectionEdge from './BlockConnectionEdge';

const geometry=vi.hoisted(()=>({nodes:[
  {id:'a',type:'skill',position:{x:0,y:0},measured:{width:240,height:104}},
  {id:'b',type:'skill',position:{x:280,y:264},measured:{width:240,height:104}},
]}));
vi.mock('@xyflow/react',()=>({useStore:()=>geometry.nodes}));

it('uses the real orthogonal route for every flow layer and updates ports when a card moves',()=>{
  const props={id:'edge',source:'a',target:'b',data:{relation:'incoming',edgeType:'prerequisite',lane:0,sourceTone:'teal',targetTone:'violet'}} as React.ComponentProps<typeof BlockConnectionEdge>;
  const view=render(<svg><BlockConnectionEdge {...props} /></svg>);
  const base=view.container.querySelector('.mapflow-connection-line')!;
  const original=base.getAttribute('d');
  expect(original).not.toMatch(/[CQSA]/i);
  const flow=view.container.querySelectorAll('.mapflow-connection-flow');
  expect(flow.length).toBeGreaterThan(0);
  for(const layer of flow)expect(layer.getAttribute('d')).toBe(original);
  expect(view.container.querySelector('[data-port="source"]')).toHaveAttribute('cy','104');
  expect(view.container.querySelector('[data-port="target"]')).toHaveAttribute('cx','400');
  geometry.nodes=geometry.nodes.map(node=>node.id==='b'?{...node,position:{x:600,y:350}}:node);
  view.rerender(<svg><BlockConnectionEdge {...props} data={{...props.data!}} /></svg>);
  const moved=view.container.querySelector('.mapflow-connection-line')!.getAttribute('d');
  expect(moved).not.toBe(original);
  for(const layer of view.container.querySelectorAll('.mapflow-connection-flow'))expect(layer.getAttribute('d')).toBe(moved);
  expect(view.container.querySelector('[data-port="target"]')).toHaveAttribute('cx','720');
  expect(view.container.querySelector('[data-port="target"]')).toHaveAttribute('cy','350');
});
