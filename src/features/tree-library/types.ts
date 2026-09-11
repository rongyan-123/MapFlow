import type {
  SkillBlock,
  SkillEdge,
  SkillNode,
  SkillNodeBlockAssignment,
  SkillTree,
} from '../../types/learning';

export interface TreeGraph {
  tree: SkillTree;
  nodes: SkillNode[];
  edges: SkillEdge[];
  /** 旧版接口可能没有块字段，客户端按空数组兼容。 */
  blocks?: SkillBlock[];
  node_block_assignments?: SkillNodeBlockAssignment[];
}

export interface PublicTreeCatalog {
  trees: SkillTree[];
}

export interface PublicTreeDetail {
  view_mode: 'showcase';
  graph: TreeGraph;
}

export interface PersonalLibraryEntry {
  library_entry_id: string;
  tree: SkillTree;
  completed_nodes: number;
}

export interface PersonalLibrary {
  entries: PersonalLibraryEntry[];
}

export interface PersonalTreeDetail {
  view_mode: 'personal';
  library_entry_id: string;
  graph: TreeGraph;
  completed_node_ids: string[];
}

export interface AddedTree {
  library_entry_id: string;
  tree_id: string;
}
