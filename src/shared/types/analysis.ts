import type { HeadingNode } from './document';

export type IssueSeverity = 'low' | 'medium' | 'high';
export type IssueType =
  | 'heading_skip'
  | 'duplicate_heading'
  | 'semantic_mismatch'
  | 'misplaced_section'
  | 'oversized_section'
  | 'underspecified_heading'
  | 'ordering_problem';

export interface SuggestedFix {
  action: 'promote' | 'demote' | 'rename' | 'merge' | 'split' | 'reorder' | 'keep';
  target_heading_id: string | null;
  proposed_title: string | null;
  proposed_level: number | null;
  notes: string;
}

export interface AuditIssue {
  issue_id: string;
  severity: IssueSeverity;
  type: IssueType;
  location: {
    heading_id: string;
    title: string;
    path: string[];
  };
  reason: string;
  evidence: string;
  suggested_fix: SuggestedFix;
}

export interface AuditorOutput {
  summary: string;
  original_hierarchy: HeadingNode[];
  issues_found: AuditIssue[];
  risk_checks: {
    contains_code_blocks: boolean;
    contains_latex: boolean;
    critical_terms_to_preserve: string[];
  };
}

export interface BlueprintNode {
  id: string;
  title: string;
  level: number;
  rationale: string;
  children: BlueprintNode[];
}

export interface StructuringOutput {
  summary: string;
  blueprint: BlueprintNode[];
  change_log: Array<{
    heading_id: string;
    action: SuggestedFix['action'];
    before: string;
    after: string;
    notes: string;
  }>;
  export_markdown: string;
}

export interface ConsistencyOutput {
  verdict: 'pass' | 'warning';
  summary: string;
  preserved_terms: string[];
  missing_terms: string[];
  code_block_count_before: number;
  code_block_count_after: number;
  latex_block_count_before: number;
  latex_block_count_after: number;
}

export interface WorkflowResult {
  auditor: AuditorOutput;
  structuring: StructuringOutput;
  consistency: ConsistencyOutput;
  generatedAt: string;
}
