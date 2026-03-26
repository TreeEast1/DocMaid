import type { AuditIssue, BlueprintNode, WorkflowResult } from '../types/analysis';
import type { ExtractedDocument, HeadingNode, TocNode } from '../types/document';

function collectCriticalTerms(text: string): string[] {
  const matches = text.match(/\b[A-Z][A-Za-z0-9_-]{2,}\b/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 12);
}

function countPattern(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function createIssue(
  heading: HeadingNode,
  type: AuditIssue['type'],
  severity: AuditIssue['severity'],
  reason: string,
  evidence: string,
  suggestedFix: AuditIssue['suggested_fix']
): AuditIssue {
  return {
    issue_id: `${type}-${heading.id}`,
    severity,
    type,
    location: {
      heading_id: heading.id,
      title: heading.title,
      path: heading.path
    },
    reason,
    evidence,
    suggested_fix: suggestedFix
  };
}

function auditDocument(documentData: ExtractedDocument) {
  const headings = documentData.headings;
  const issues: AuditIssue[] = [];
  const titleCounts = new Map<string, number>();

  headings.forEach((heading, index) => {
    const previous = headings[index - 1];
    const normalizedTitle = heading.title.toLowerCase();
    titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);

    if (previous && heading.level - previous.level > 1) {
      issues.push(
        createIssue(
          heading,
          'heading_skip',
          'high',
          'Heading depth jumps by more than one level, which usually breaks document scanning.',
          `Previous heading is H${previous.level} "${previous.title}", current heading is H${heading.level} "${heading.title}".`,
          {
            action: 'promote',
            target_heading_id: heading.id,
            proposed_title: heading.title,
            proposed_level: previous.level + 1,
            notes: 'Promote this heading upward to preserve a continuous hierarchy.'
          }
        )
      );
    }

    if (heading.wordCount > 320) {
      issues.push(
        createIssue(
          heading,
          'oversized_section',
          'medium',
          'This section is long enough that readers will likely lose the outline thread.',
          `Estimated section length is ${heading.wordCount} words.`,
          {
            action: 'split',
            target_heading_id: heading.id,
            proposed_title: heading.title,
            proposed_level: heading.level,
            notes: 'Split near a natural topic shift and add one or two child headings.'
          }
        )
      );
    }

    if (heading.title.length <= 3 || /^(misc|other|notes|temp)$/i.test(heading.title)) {
      issues.push(
        createIssue(
          heading,
          'underspecified_heading',
          'medium',
          'This heading is too vague to signal what the section contains.',
          `Heading title "${heading.title}" lacks a concrete subject.`,
          {
            action: 'rename',
            target_heading_id: heading.id,
            proposed_title: `${heading.path.slice(-2, -1)[0] ?? 'Section'} - ${heading.title}`,
            proposed_level: heading.level,
            notes: 'Rename using the section topic rather than a placeholder label.'
          }
        )
      );
    }
  });

  headings.forEach((heading) => {
    const duplicateCount = titleCounts.get(heading.title.toLowerCase()) ?? 0;
    if (duplicateCount > 1) {
      issues.push(
        createIssue(
          heading,
          'duplicate_heading',
          'low',
          'Repeated heading names make the table of contents ambiguous.',
          `The title "${heading.title}" appears ${duplicateCount} times in the current outline.`,
          {
            action: 'rename',
            target_heading_id: heading.id,
            proposed_title: `${heading.title} (${heading.path.slice(-2, -1)[0] ?? 'context'})`,
            proposed_level: heading.level,
            notes: 'Add context so each section is distinguishable in the sidebar and TOC.'
          }
        )
      );
    }
  });

  return {
    summary:
      issues.length > 0
        ? `Found ${issues.length} structural issues that can be fixed with minimal outline changes.`
        : 'No major hierarchy issues found. The current outline is structurally coherent.',
    original_hierarchy: headings,
    issues_found: issues,
    risk_checks: {
      contains_code_blocks: countPattern(documentData.markdown, /```/g) > 0,
      contains_latex: countPattern(documentData.markdown, /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g) > 0,
      critical_terms_to_preserve: collectCriticalTerms(documentData.text)
    }
  };
}

function cloneBlueprint(nodes: TocNode[]): BlueprintNode[] {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    level: node.level,
    rationale: 'Retain original placement.',
    children: cloneBlueprint(node.children)
  }));
}

function visitBlueprint(nodes: BlueprintNode[], fn: (node: BlueprintNode) => void): void {
  nodes.forEach((node) => {
    fn(node);
    visitBlueprint(node.children, fn);
  });
}

function exportBlueprintMarkdown(nodes: BlueprintNode[]): string {
  const lines: string[] = [];

  visitBlueprint(nodes, (node) => {
    lines.push(`${'#'.repeat(node.level)} ${node.title}`);
  });

  return lines.join('\n\n');
}

function restructureDocument(documentData: ExtractedDocument, issues: AuditIssue[]) {
  const blueprint = cloneBlueprint(documentData.toc);
  const changeLog: Array<{
    heading_id: string;
    action: AuditIssue['suggested_fix']['action'];
    before: string;
    after: string;
    notes: string;
  }> = [];

  visitBlueprint(blueprint, (node) => {
    const relatedIssues = issues.filter((issue) => issue.location.heading_id === node.id);

    relatedIssues.forEach((issue) => {
      const before = `H${node.level} ${node.title}`;
      if (issue.suggested_fix.proposed_level) {
        node.level = issue.suggested_fix.proposed_level;
      }

      if (issue.suggested_fix.proposed_title) {
        node.title = issue.suggested_fix.proposed_title;
      }

      node.rationale = issue.suggested_fix.notes;
      changeLog.push({
        heading_id: node.id,
        action: issue.suggested_fix.action,
        before,
        after: `H${node.level} ${node.title}`,
        notes: issue.suggested_fix.notes
      });
    });
  });

  return {
    summary:
      changeLog.length > 0
        ? `Prepared ${changeLog.length} outline adjustments while preserving document content.`
        : 'No structural rewrite was necessary; the current outline can be kept as-is.',
    blueprint,
    change_log: changeLog,
    export_markdown: exportBlueprintMarkdown(blueprint)
  };
}

function validateConsistency(documentData: ExtractedDocument, exportMarkdown: string) {
  const termsBefore = collectCriticalTerms(documentData.text);
  const missingTerms = termsBefore.filter((term) => !exportMarkdown.includes(term));
  const codeBefore = countPattern(documentData.markdown, /```/g);
  const latexBefore = countPattern(documentData.markdown, /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g);
  const codeAfter = countPattern(exportMarkdown, /```/g);
  const latexAfter = countPattern(exportMarkdown, /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g);
  const verdict: 'pass' | 'warning' =
    missingTerms.length > 0 || codeBefore !== codeAfter || latexBefore !== latexAfter ? 'warning' : 'pass';

  return {
    verdict,
    summary:
      missingTerms.length > 0
        ? 'Blueprint is outline-only, so some critical terms are absent from the exported structure. Preserve them when editing the source document.'
        : 'No obvious term, code block, or formula preservation issue was detected in the structural export.',
    preserved_terms: termsBefore.filter((term) => exportMarkdown.includes(term)),
    missing_terms: missingTerms,
    code_block_count_before: codeBefore,
    code_block_count_after: codeAfter,
    latex_block_count_before: latexBefore,
    latex_block_count_after: latexAfter
  };
}

export function runLocalWorkflow(documentData: ExtractedDocument): WorkflowResult {
  const auditor = auditDocument(documentData);
  const structuring = restructureDocument(documentData, auditor.issues_found);
  const consistency = validateConsistency(documentData, structuring.export_markdown);

  return {
    auditor,
    structuring,
    consistency,
    generatedAt: new Date().toISOString()
  };
}
