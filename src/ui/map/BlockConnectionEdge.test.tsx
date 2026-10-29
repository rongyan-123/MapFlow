import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BlockConnectionEdge from './BlockConnectionEdge';

const geometry=vi.hoisted(()=>({nodes:[
  {id:'a',type:'skill',position:{x:0,y:0},measured:{width:240,height:104}},
  {id:'b',type:'skill',position:{x:280,y:264},measured:{width:240,height:104}},
]}));
vi.mock('@xyflow/react',()=>({useStore:()=>geometry.nodes}));

it('keeps unfinished ports neutral and only sends colored flow from a completed source',()=>{
  const props={id:'edge',source:'a',target:'b',data:{relation:'outgoing',edgeType:'prerequisite',lane:0,sourceTone:'teal',targetTone:'violet',sourceLit:false,targetLit:false}} as React.ComponentProps<typeof BlockConnectionEdge>;
  const view=render(<svg><BlockConnectionEdge {...props} /></svg>);
  expect(view.container.querySelector('[data-port="source"]')).toHaveStyle({fill:'var(--mf-map-unlit-accent)'});
  expect(view.container.querySelector('[data-port="target"]')).toHaveStyle({fill:'var(--mf-map-unlit-accent)'});
  expect(view.container.querySelectorAll('.mapflow-connection-flow')).toHaveLength(0);
  view.rerender(<svg><BlockConnectionEdge {...props} data={{...props.data!,sourceLit:true}} /></svg>);
  expect(view.container.querySelector('[data-port="source"]')).toHaveStyle({fill:'var(--mf-branch-teal)'});
  expect(view.container.querySelector('[data-port="target"]')).toHaveStyle({fill:'var(--mf-map-unlit-accent)'});
  expect(view.container.querySelectorAll('.mapflow-connection-flow')).toHaveLength(3);
});

it('uses the real orthogonal route for every flow layer and updates ports when a card moves',()=>{
  const props={id:'edge',source:'a',target:'b',data:{relation:'incoming',edgeType:'prerequisite',lane:0,sourceTone:'teal',targetTone:'violet'}} as React.ComponentProps<typeof BlockConnectionEdge>;
  const view=render(<svg><BlockConnectionEdge {...props} /></svg>);
  const base=view.container.querySelector('.mapflow-connection-line')!;
  const original=base.getAttribute('d');
  expect(original).toContain('Q');
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

it('renders distributed ports without losing the shared path of the arrow and flow layers', () => {
  geometry.nodes = [
    { id: 'a', type: 'skill', position: { x: 0, y: 0 }, measured: { width: 240, height: 104 } },
    { id: 'b', type: 'skill', position: { x: 280, y: 264 }, measured: { width: 240, height: 104 } },
  ];
  const props = { id: 'fanout', source: 'a', target: 'b', data: { relation: 'outgoing', edgeType: 'prerequisite', lane: 0, sourcePort: .2, targetPort: .88 } } as React.ComponentProps<typeof BlockConnectionEdge>;
  const view = render(<svg><BlockConnectionEdge {...props} /></svg>);
  expect(view.container.querySelector('[data-port="source"]')).toHaveAttribute('cx', '48');
  expect(view.container.querySelector('[data-port="target"]')).toHaveAttribute('cx', '491.2');
  const main = view.container.querySelector('.mapflow-connection-line')!;
  expect(main).toHaveAttribute('marker-end');
  for (const layer of view.container.querySelectorAll('.mapflow-connection-flow')) expect(layer.getAttribute('d')).toBe(main.getAttribute('d'));
});
