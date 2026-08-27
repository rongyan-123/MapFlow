import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, Sparkles } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Group, Mesh } from 'three';

interface DemoSkillNode {
  id: string;
  label: string;
  detail: string;
  category: string;
  position: [number, number, number];
  color: string;
  size: number;
}

const DEMO_NODES: DemoSkillNode[] = [
  {
    id: 'goal',
    label: '你的目标',
    detail: '生产级 Agent',
    category: '从目标开始',
    position: [0, 2.3, 0],
    color: '#67e8f9',
    size: 0.36,
  },
  {
    id: 'foundation',
    label: '基础能力',
    detail: '框架与依赖',
    category: '前置能力',
    position: [-1.8, 0.95, 0.15],
    color: '#60a5fa',
    size: 0.29,
  },
  {
    id: 'reasoning',
    label: '问题拆解',
    detail: '理解边界',
    category: '核心能力',
    position: [0, 0.95, -0.2],
    color: '#a78bfa',
    size: 0.29,
  },
  {
    id: 'practice',
    label: '动手实践',
    detail: '最小闭环',
    category: '实践节点',
    position: [1.8, 0.95, 0.15],
    color: '#fbbf24',
    size: 0.29,
  },
  {
    id: 'context',
    label: '上下文',
    detail: '知道前因后果',
    category: '理解',
    position: [-1.5, -0.55, -0.1],
    color: '#22d3ee',
    size: 0.23,
  },
  {
    id: 'tools',
    label: '工具调用',
    detail: '只读地查资料',
    category: '应用',
    position: [0, -0.55, 0.2],
    color: '#34d399',
    size: 0.23,
  },
  {
    id: 'evidence',
    label: '可验证证据',
    detail: '能解释 · 能实现',
    category: '完成标准',
    position: [1.5, -0.55, -0.1],
    color: '#fb7185',
    size: 0.23,
  },
  {
    id: 'ship',
    label: '交付能力',
    detail: '把知识做出来',
    category: '迁移',
    position: [0, -1.9, 0],
    color: '#f0abfc',
    size: 0.27,
  },
];

const DEMO_EDGES: Array<[string, string]> = [
  ['goal', 'foundation'],
  ['goal', 'reasoning'],
  ['goal', 'practice'],
  ['foundation', 'context'],
  ['reasoning', 'context'],
  ['reasoning', 'tools'],
  ['practice', 'tools'],
  ['practice', 'evidence'],
  ['context', 'ship'],
  ['tools', 'ship'],
  ['evidence', 'ship'],
];

const nodeById = new Map(DEMO_NODES.map((node) => [node.id, node]));

export default function SkillTree3D() {
  const [selectedNodeId, setSelectedNodeId] = useState('goal');
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const selectedNode = nodeById.get(selectedNodeId) ?? DEMO_NODES[0];
  const canRenderWebGL =
    typeof window !== 'undefined' && typeof window.WebGLRenderingContext !== 'undefined';

  return (
    <div className="relative mx-auto w-full max-w-[42rem]" aria-label="可交互的 3D 技能树展示">
      <div
        data-testid="skill-tree-3d"
        className="relative aspect-[0.92] overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-[#081827] shadow-[0_30px_100px_-28px_rgba(34,211,238,0.55)] sm:aspect-square"
      >
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_48%,transparent_23%,rgba(2,6,23,0.18)_75%)]" />
        <div className="pointer-events-none absolute inset-5 z-10 rounded-[1.5rem] border border-dashed border-cyan-300/15 sm:inset-7" />

        {canRenderWebGL ? (
          <Canvas
            camera={{ position: [0, 0.2, 8.6], fov: 42 }}
            dpr={[1, 1.75]}
            gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
            fallback={<SkillTreeFallback />}
          >
            <color attach="background" args={['#081827']} />
            <ambientLight intensity={1.2} />
            <pointLight position={[2, 4, 5]} intensity={18} distance={12} color="#67e8f9" />
            <pointLight position={[-4, -2, 2]} intensity={10} distance={10} color="#6366f1" />
            <Suspense fallback={null}>
              <TreeGraphModel selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
              <Sparkles count={45} scale={[7, 5, 4]} size={1.4} speed={0.22} color="#67e8f9" opacity={0.45} />
            </Suspense>
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enablePan
              enableDamping
              dampingFactor={0.08}
              minDistance={5.6}
              maxDistance={12}
              minPolarAngle={0.65}
              maxPolarAngle={2.45}
            />
          </Canvas>
        ) : (
          <SkillTreeFallback />
        )}

        <div className="pointer-events-none absolute inset-x-6 top-6 z-20 flex items-start justify-between gap-4 sm:inset-x-9 sm:top-8">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-300">SKILL TREE / 3D</p>
            <p className="mt-1 text-xs text-slate-500">一棵可以自由探索的技能树</p>
          </div>
          <span className="rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[10px] font-semibold text-slate-400 backdrop-blur-sm">
            {canRenderWebGL ? '拖动旋转 · 滚轮缩放' : '静态预览'}
          </span>
        </div>

        <button
          type="button"
          aria-label="重置技能树视角"
          onClick={() => controlsRef.current?.reset()}
          className="absolute bottom-6 right-6 z-20 rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-300 backdrop-blur-md transition hover:border-cyan-300/60 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:bottom-8 sm:right-9"
        >
          重置视角
        </button>

        <div className="absolute bottom-6 left-6 z-20 max-w-[15rem] rounded-2xl border border-white/15 bg-slate-950/65 px-4 py-3 backdrop-blur-md sm:bottom-8 sm:left-9">
          <p className="text-[10px] font-bold tracking-[0.16em] text-cyan-300">{selectedNode.category}</p>
          <p className="mt-1 text-sm font-bold text-white">{selectedNode.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{selectedNode.detail}</p>
        </div>
      </div>
      <p className="mt-4 text-center text-sm font-semibold text-slate-300">
        旋转、拖动，找到你真正想学的那个节点。
      </p>
      <p className="mt-1 text-center text-xs text-slate-500">
        点击节点查看它在学习路径中的位置
      </p>
    </div>
  );
}

function TreeGraphModel({
  selectedNodeId,
  onSelect,
}: {
  selectedNodeId: string;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <group rotation={[0.06, -0.18, 0]}>
      {DEMO_EDGES.map(([sourceId, targetId]) => {
        const source = nodeById.get(sourceId);
        const target = nodeById.get(targetId);
        if (!source || !target) return null;
        return (
          <Line
            key={`${sourceId}-${targetId}`}
            points={[source.position, target.position]}
            color="#67e8f9"
            lineWidth={1.1}
            transparent
            opacity={0.42}
          />
        );
      })}
      {DEMO_NODES.map((node) => (
        <SkillNode3D
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function SkillNode3D({
  node,
  selected,
  onSelect,
}: {
  node: DemoSkillNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const haloRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (group) {
      const pulse = selected ? Math.sin(clock.getElapsedTime() * 2.2 + node.position[0]) * 0.035 : 0;
      group.scale.setScalar(1 + pulse);
    }
    if (haloRef.current) {
      const haloScale = selected ? 1.04 + Math.sin(clock.getElapsedTime() * 1.8) * 0.08 : 0.82;
      haloRef.current.scale.setScalar(haloScale);
    }
  });

  return (
    <group
      ref={groupRef}
      position={node.position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      <mesh ref={haloRef} scale={0.82}>
        <sphereGeometry args={[node.size * 1.8, 20, 20]} />
        <meshBasicMaterial color={node.color} transparent opacity={selected ? 0.12 : 0.04} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[node.size, 2]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={selected ? 0.95 : 0.45}
          metalness={0.35}
          roughness={0.24}
        />
      </mesh>
      <Html center distanceFactor={8} position={[0, -node.size - 0.18, 0]}>
        <button
          type="button"
          aria-label={`选择技能节点：${node.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node.id);
          }}
          className={`min-w-[5.8rem] rounded-xl border px-2.5 py-1.5 text-center shadow-lg backdrop-blur-md transition ${
            selected
              ? 'border-cyan-200/80 bg-cyan-300/20 text-cyan-50 shadow-cyan-300/20'
              : 'border-white/15 bg-slate-950/75 text-slate-300 hover:border-cyan-300/60 hover:text-cyan-100'
          }`}
        >
          <span className="block whitespace-nowrap text-[10px] font-bold">{node.label}</span>
          <span className="mt-0.5 block whitespace-nowrap text-[9px] text-slate-500">{node.detail}</span>
        </button>
      </Html>
    </group>
  );
}

function SkillTreeFallback() {
  return (
    <div data-testid="skill-tree-3d-fallback" className="absolute inset-0 grid place-items-center p-8">
      <div className="relative h-full w-full max-w-[22rem]">
        <div className="absolute left-1/2 top-[17%] h-[66%] w-px -translate-x-1/2 bg-gradient-to-b from-cyan-300/70 via-cyan-300/25 to-transparent" />
        <div className="absolute left-[14%] right-[14%] top-[48%] h-px bg-cyan-300/35" />
        {DEMO_NODES.slice(0, 7).map((node, index) => (
          <div
            key={node.id}
            className="absolute w-[7.5rem] -translate-x-1/2 rounded-xl border border-white/15 bg-slate-950/80 px-2 py-2 text-center shadow-lg"
            style={{
              left: index === 0 ? '50%' : index < 4 ? `${22 + (index - 1) * 28}%` : `${28 + ((index - 4) % 3) * 22}%`,
              top: index === 0 ? '12%' : index < 4 ? '42%' : '67%',
              borderColor: `${node.color}66`,
            }}
          >
            <span className="block text-[10px] font-bold text-slate-200">{node.label}</span>
            <span className="mt-0.5 block text-[9px] text-slate-500">{node.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
