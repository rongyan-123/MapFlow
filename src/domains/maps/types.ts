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
  attributions: Record<string, PublicTreeAttribution>;
  next_cursor: string | null;
}

export interface PublicTreeAttribution { publisher_display_name:string; derived_from_public_tree_id:string|null; root_public_tree_id:string|null; derived_from_title:string|null; derived_from_publisher_display_name:string|null }

export interface PublicTreeDetail {
  view_mode: 'showcase';
  graph: TreeGraph;
  attribution: PublicTreeAttribution | null;
}

export interface PersonalLibraryEntry {
  library_entry_id: string;
  tree: SkillTree;
  completed_nodes: number;
  progress_percent?: number;
}

export interface PersonalLibrary {
  entries: PersonalLibraryEntry[];
}

export interface PersonalTreeDetail {
  view_mode: 'personal';
  library_entry_id: string;
  graph: TreeGraph;
  completed_node_ids: string[];
  node_progress?: NodeProgress[];
  progress_percent?: number;
  noted_node_ids?: string[];
}

export interface NodeNote {
  node_id: string;
  markdown: string;
  has_note: boolean;
  version: number;
  updated_at: string | null;
}

export interface PublicationStatus { source_revision:number; public_tree_id:string|null; is_public:boolean }
export interface PublicationPrepare { action:'publish'|'update'|'unpublish'; title:string; publisher_display_name:string; source_revision:number; node_count:number; edge_count:number; block_count:number; excludes:string[]; expected_public_tree_id:string|null; confirmation_token:string; expires_in_seconds:number }
export interface PublicationResult { action:'publish'|'update'|'unpublish'; publication_id:string|null; public_tree_id:string|null; source_revision:number; state:string }

export interface NodeProgress {
  node_id: string;
  progress_percent: number;
}

export interface AddedTree {
  library_entry_id: string;
  tree_id: string;
}
