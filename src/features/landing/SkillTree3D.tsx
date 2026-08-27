import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls, RoundedBox, Sparkles } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Group, Mesh } from 'three';
import {
  getNodeBodyDimensions,
  getNodeLabelPosition,
  getNodePlateDimensions,
} from './skillTree3dPresentation';

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
            camera={{ position: [0.7, 0.3, 8.6], fov: 42 }}
            dpr={[1, 1.75]}
            gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
            fallback={<SkillTreeFallback />}
          >
            <color attach="background" args={['#081827']} />
            <fog attach="fog" args={['#081827', 7, 16]} />
            <ambientLight intensity={1.2} />
            <pointLight position={[2, 4, 5]} intensity={18} distance={12} color="#67e8f9" />
            <pointLight position={[-4, -2, 2]} intensity={10} distance={10} color="#6366f1" />
            <Suspense fallback={null}>
              <SceneAtmosphere />
              <TreeGraphModel selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
              <Sparkles count={62} scale={[7, 5, 4]} size={1.4} speed={0.22} color="#67e8f9" opacity={0.42} />
              <Sparkles count={18} scale={[4.5, 3.5, 2]} size={2.2} speed={0.12} color="#a78bfa" opacity={0.2} />
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

function SceneAtmosphere() {
  const atmosphereRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!atmosphereRef.current) return;
    const elapsed = clock.getElapsedTime();
    atmosphereRef.current.rotation.y = Math.sin(elapsed * 0.12) * 0.06;
    atmosphereRef.current.rotation.z = elapsed * 0.018;
  });

  return (
    <group ref={atmosphereRef} position={[0, 0, -1.45]}>
      <mesh rotation={[Math.PI / 2.35, 0.08, 0]}>
        <torusGeometry args={[3.1, 0.014, 8, 96]} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={0.24} />
      </mesh>
      <mesh rotation={[Math.PI / 2.1, -0.12, 0.24]} scale={0.76}>
        <torusGeometry args={[3.1, 0.01, 8, 96]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.24} />
      </mesh>
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
  const bodyRef = useRef<Mesh>(null);
  const plateRef = useRef<Mesh>(null);
  const bodyDimensions = getNodeBodyDimensions(node.size);
  const plateDimensions = getNodePlateDimensions(node.size);
  const labelPosition = getNodeLabelPosition(node.size);
  const platePosition: [number, number, number] = [
    0,
    labelPosition[1],
    bodyDimensions[2] * 0.34,
  ];

  useFrame(({ clock }) => {
    const group = groupRef.current;
    const elapsed = clock.getElapsedTime();
    if (group) {
      const pulse = selected ? Math.sin(elapsed * 2.2 + node.position[0]) * 0.035 : 0;
      group.scale.setScalar(1 + pulse);
    }
    if (haloRef.current) {
      const haloScale = selected ? 1.04 + Math.sin(elapsed * 1.8) * 0.08 : 0.82;
      haloRef.current.scale.setScalar(haloScale);
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.y = Math.sin(elapsed * 0.8 + node.position[1]) * (selected ? 0.06 : 0.025);
      bodyRef.current.rotation.x = Math.cos(elapsed * 0.65 + node.position[0]) * 0.018;
    }
    if (plateRef.current) {
      plateRef.current.rotation.y = bodyRef.current?.rotation.y ?? 0;
      plateRef.current.rotation.x = bodyRef.current?.rotation.x ?? 0;
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
      <RoundedBox
        position={[0, 0, -bodyDimensions[2] * 0.38]}
        args={[bodyDimensions[0] * 1.04, bodyDimensions[1] * 1.08, bodyDimensions[2] * 0.5]}
        radius={node.size * 0.16}
        smoothness={4}
        bevelSegments={4}
      >
        <meshStandardMaterial
          color="#071525"
          emissive={node.color}
          emissiveIntensity={selected ? 0.24 : 0.07}
          metalness={0.78}
          roughness={0.3}
        />
        <Edges color={node.color} threshold={15} lineWidth={selected ? 1.4 : 0.75} />
      </RoundedBox>
      <RoundedBox ref={bodyRef} args={bodyDimensions} radius={node.size * 0.16} smoothness={4} bevelSegments={4}>
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={selected ? 1.05 : 0.62}
          metalness={0.22}
          roughness={0.2}
        />
        <Edges color={selected ? '#ecfeff' : node.color} threshold={15} lineWidth={selected ? 2 : 1} />
      </RoundedBox>
      <mesh position={[0, 0, bodyDimensions[2] * 0.52]}>
        <planeGeometry args={[bodyDimensions[0] * 0.72, bodyDimensions[1] * 0.48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={selected ? 0.1 : 0.035} />
      </mesh>
      <RoundedBox
        ref={plateRef}
        position={platePosition}
        args={plateDimensions}
        radius={node.size * 0.12}
        smoothness={4}
        bevelSegments={3}
      >
        <meshStandardMaterial
          color="#071525"
          emissive={node.color}
          emissiveIntensity={selected ? 0.16 : 0.04}
          metalness={0.68}
          roughness={0.34}
        />
        <Edges color={node.color} threshold={15} lineWidth={selected ? 1.1 : 0.6} />
      </RoundedBox>
      <Html transform sprite={false} center distanceFactor={8} position={labelPosition}>
        <button
          type="button"
          aria-label={`选择技能节点：${node.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node.id);
          }}
          className={`min-w-[6.2rem] rounded-xl border px-2.5 py-1.5 text-center shadow-lg transition ${
            selected
              ? 'border-cyan-200/80 bg-cyan-300/20 text-cyan-50 shadow-cyan-300/20'
              : 'border-white/25 bg-transparent text-slate-200 hover:border-cyan-300/60 hover:text-cyan-100'
          }`}
        >
          <span className="block whitespace-nowrap text-[10px] font-bold">{node.label}</span>
          <span className="mt-0.5 block whitespace-nowrap text-[9px] text-slate-300/80">{node.detail}</span>
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
