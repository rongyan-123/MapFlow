export type RecommendedDepth =
  | 'Recognize'
  | 'Understand'
  | 'Use'
  | 'Transfer'
  | 'DeepMastery';

export type LearningStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'mastered';

export type TreeDisplayMode = 'showcase' | 'personal';

export interface SkillTree {
  id: string;
  topic: string;
  title: string;
  description: string | null;
  difficulty_level: string;
  total_nodes: number;
}

export interface SkillNode {
  id: string;
  tree_id: string;
  title: string;
  description: string | null;
  icon: string;
  category: string;
  difficulty: number;
  estimated_minutes: number;
  depth_level: number;
  position_x: number;
  position_y: number;
  order_in_level: number;
  learning_objectives: string | null;
  key_concepts: string | null;
  recommended_depth: RecommendedDepth;
  depth_rationale: string;
  observable_evidence: string;
}

export interface SkillEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  label: string | null;
}

export interface NodeLearningProgress {
  node_id: string;
  status: LearningStatus;
  evidence: string;
}

export interface LearningTreeSnapshot {
  tree: SkillTree;
  nodes: SkillNode[];
  edges: SkillEdge[];
  current_node_id: string | null;
  progress: NodeLearningProgress[];
  /** 演示数据来源标识（如 'nestjs' / 'agent'），后端真实数据无此字段 */
  demo_source?: string | null;
}
