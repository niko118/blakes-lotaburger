"use client";

import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Sigma,
  Scissors,
  GripVertical,
} from "lucide-react";
import { Card } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { fetchGraphQL } from "@lib/graphql/client";
import type { ReportGroup } from "@app-types";

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL
// ─────────────────────────────────────────────────────────────────────────────

const QUERY_REPORT_GROUPS = /* GraphQL */ `
  query ReportGroups($reportType: String) {
    reportGroups(reportType: $reportType) {
      id name parentId reportType sortOrder subtotalAfter contributesAs eliminateCommissary
      children { id name parentId reportType sortOrder subtotalAfter contributesAs eliminateCommissary }
    }
  }
`;

const MUTATION_CREATE_GROUP = /* GraphQL */ `
  mutation CreateReportGroup($input: CreateReportGroupInput!) {
    createReportGroup(input: $input) { id }
  }
`;

const MUTATION_UPDATE_GROUP = /* GraphQL */ `
  mutation UpdateReportGroup($id: ID!, $input: UpdateReportGroupInput!) {
    updateReportGroup(id: $id, input: $input) {
      id name subtotalAfter contributesAs eliminateCommissary
    }
  }
`;

const MUTATION_REORDER_GROUPS = /* GraphQL */ `
  mutation ReorderReportGroups($items: [ReportGroupOrderInput!]!) {
    reorderReportGroups(items: $items)
  }
`;

const MUTATION_DELETE_GROUP = /* GraphQL */ `
  mutation DeleteReportGroup($id: ID!) {
    deleteReportGroup(id: $id)
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  page: "space-y-6",
  header: "space-y-1",
  title: "text-3xl font-bold text-steel tracking-tight",
  subtitle: "text-dark-grey text-lg",

  typeToggle: "inline-flex items-center gap-1 p-1 rounded-lg bg-fog border border-cloud",
  typeBtnActive: "h-8 px-4 text-sm font-medium bg-white text-primary shadow-sm",
  typeBtnInactive: "h-8 px-4 text-sm font-medium text-silver hover:text-steel",

  layout: "flex gap-6 items-start",
  treeColumn: "w-[440px] flex-shrink-0 space-y-3",
  previewColumn: "flex-1 min-w-0",

  card: "border-cloud overflow-hidden",
  cardHeader: "flex items-center justify-between px-4 py-3 border-b border-cloud bg-fog",
  cardHeaderTitle: "text-xs font-semibold text-silver uppercase tracking-wide",

  // Tree
  treeSection: "border-b border-cloud last:border-b-0 bg-white",
  treeSectionHeader: "flex items-center gap-1.5 px-3 py-2.5 group hover:bg-fog/60 transition-colors",
  treeSectionName: "text-sm font-semibold text-steel flex-1 truncate",
  treeGroupList: "min-h-[8px]",
  treeGroupListEmpty: "px-8 py-2 text-xs text-rain italic",
  treeGroupItem: "flex items-center gap-1.5 pl-6 pr-3 py-1.5 group hover:bg-fog/40 transition-colors bg-white",
  treeGroupName: "text-sm text-dark-grey flex-1 truncate flex items-center gap-1.5",
  treeActions: "hidden group-hover:flex items-center gap-0.5",

  dragHandle: "flex items-center justify-center w-5 h-6 text-rain hover:text-steel cursor-grab active:cursor-grabbing touch-none",
  dragging: "opacity-40",
  overlayRow: "flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary/40 rounded-md shadow-lg text-sm text-steel",

  subtotalBadge: "inline-flex items-center gap-1 text-xs font-medium text-primary",
  subtotalIcon: "h-3 w-3",

  // P&L section flag chips (contributesAs / eliminateCommissary)
  flagChip: "inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-semibold uppercase tracking-wide leading-none transition-colors",
  flagChipRevenue: "bg-green/10 text-green hover:bg-green/20",
  flagChipCost: "bg-fog text-dark-grey hover:bg-cloud",
  flagChipOn: "bg-primary/10 text-primary hover:bg-primary/20",
  flagChipOff: "bg-transparent text-rain hover:bg-fog hover:text-dark-grey",
  flagChipIcon: "h-2.5 w-2.5",

  inlineEditRow: "flex items-center gap-1 px-2 py-1",
  inlineEditInput: "h-7 text-sm flex-1",

  addForm: "px-3 py-2 space-y-2 border-t border-cloud bg-fog/30",
  addLabel: "text-xs font-medium text-silver",
  addRow: "flex gap-1.5",
  addInput: "h-8 text-sm flex-1",

  iconBtn: "h-6 w-6 p-0 text-silver hover:text-steel",
  deleteBtn: "h-6 w-6 p-0 text-silver hover:text-red",
  toggleBtnOn: "h-6 w-6 p-0 text-primary",
  toggleBtnOff: "h-6 w-6 p-0 text-rain hover:text-steel",

  // Preview
  previewBody: "p-4 space-y-0.5 font-mono text-sm",
  previewSectionHeader: "py-1.5 font-bold text-steel uppercase text-xs tracking-wide",
  previewGroup: "py-0.5 pl-4 text-dark-grey flex items-center justify-between",
  previewSubtotal: "py-1 pl-2 text-primary font-medium border-t border-cloud/60 flex items-center justify-between",
  previewSectionTotal: "py-1 font-semibold text-steel border-t border-cloud flex items-center justify-between",
  previewGrandTotal: "py-2 mt-2 font-bold text-steel border-t-2 border-steel/30 uppercase",
  previewLineLabel: "truncate",
  previewSubtotalTag: "text-xs font-normal text-rain ml-2",

  loadingState: "flex items-center justify-center py-16",
  loadingSpinner: "h-8 w-8 text-silver animate-spin",
  errorWrapper: "flex items-center gap-3 p-4 rounded-lg bg-red/5 border border-red/20",
  errorIcon: "h-5 w-5 text-red flex-shrink-0",
  errorText: "text-sm text-steel",
  emptyState: "px-4 py-10 text-center text-sm text-silver",
  statusIcon: "h-3.5 w-3.5",
  handleIcon: "h-4 w-4",
} as const;

type ReportType = "pnl" | "bs";

// ─────────────────────────────────────────────────────────────────────────────
// Sortable group row
// ─────────────────────────────────────────────────────────────────────────────

interface SortableGroupProps {
  group: ReportGroup;
  sectionId: string;
  editing: boolean;
  editingName: string;
  onEditingNameChange: (v: string) => void;
  onStartEdit: (id: string, name: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleSubtotal: (group: ReportGroup) => void;
  onDelete: (id: string, label: string) => void;
  saving: boolean;
}

function SortableGroup({
  group, sectionId, editing, editingName, onEditingNameChange,
  onStartEdit, onSaveEdit, onCancelEdit, onToggleSubtotal, onDelete, saving,
}: SortableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    data: { type: "group", sectionId },
  });

  const style = { transform: CSS.Translate.toString(transform), transition };

  if (editing) {
    return (
      <div ref={setNodeRef} style={style} className={styles.inlineEditRow}>
        <Input
          className={styles.inlineEditInput}
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
          autoFocus
        />
        <Button size="sm" variant="ghost" className={styles.iconBtn} onClick={onSaveEdit} disabled={saving}>
          <Check className={styles.statusIcon} />
        </Button>
        <Button size="sm" variant="ghost" className={styles.iconBtn} onClick={onCancelEdit}>
          <X className={styles.statusIcon} />
        </Button>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={`${styles.treeGroupItem} ${isDragging ? styles.dragging : ""}`}>
      <span className={styles.dragHandle} {...attributes} {...listeners}>
        <GripVertical className={styles.handleIcon} />
      </span>
      <span className={styles.treeGroupName}>
        {group.name}
        {group.subtotalAfter && (
          <span className={styles.subtotalBadge} title="Emits an intermediate subtotal after this group">
            <Sigma className={styles.subtotalIcon} />
          </span>
        )}
      </span>
      <div className={styles.treeActions}>
        <Button size="sm" variant="ghost"
          className={group.subtotalAfter ? styles.toggleBtnOn : styles.toggleBtnOff}
          onClick={() => onToggleSubtotal(group)}
          title={group.subtotalAfter ? "Remove intermediate subtotal" : "Add intermediate subtotal after this group"}>
          <Sigma className={styles.statusIcon} />
        </Button>
        <Button size="sm" variant="ghost" className={styles.iconBtn}
          onClick={() => onStartEdit(group.id, group.name)} title="Rename">
          <Pencil className={styles.statusIcon} />
        </Button>
        <Button size="sm" variant="ghost" className={styles.deleteBtn}
          onClick={() => onDelete(group.id, group.name)} title="Delete group">
          <Trash2 className={styles.statusIcon} />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortable section (header drag handle + droppable group list)
// ─────────────────────────────────────────────────────────────────────────────

interface SortableSectionProps {
  section: ReportGroup;
  children: React.ReactNode;
  editing: boolean;
  editingName: string;
  onEditingNameChange: (v: string) => void;
  onStartEdit: (id: string, name: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAddGroup: (sectionId: string) => void;
  onDelete: (id: string, label: string) => void;
  onCycleContributes: (section: ReportGroup) => void;
  onToggleEliminate: (section: ReportGroup) => void;
  saving: boolean;
  hasGroups: boolean;
}

function SortableSection({
  section, children, editing, editingName, onEditingNameChange,
  onStartEdit, onSaveEdit, onCancelEdit, onAddGroup, onDelete,
  onCycleContributes, onToggleEliminate, saving, hasGroups,
}: SortableSectionProps) {
  const isPnl = section.reportType === "pnl";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: "section" },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `dropzone:${section.id}`,
    data: { type: "dropzone", sectionId: section.id },
  });

  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`${styles.treeSection} ${isDragging ? styles.dragging : ""}`}>
      {editing ? (
        <div className={styles.inlineEditRow}>
          <Input
            className={styles.inlineEditInput}
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
            autoFocus
          />
          <Button size="sm" variant="ghost" className={styles.iconBtn} onClick={onSaveEdit} disabled={saving}>
            <Check className={styles.statusIcon} />
          </Button>
          <Button size="sm" variant="ghost" className={styles.iconBtn} onClick={onCancelEdit}>
            <X className={styles.statusIcon} />
          </Button>
        </div>
      ) : (
        <div className={styles.treeSectionHeader}>
          <span className={styles.dragHandle} {...attributes} {...listeners}>
            <GripVertical className={styles.handleIcon} />
          </span>
          <span className={styles.treeSectionName}>{section.name}</span>
          {isPnl && (
            <button
              className={`${styles.flagChip} ${section.contributesAs === "revenue" ? styles.flagChipRevenue : styles.flagChipCost}`}
              onClick={() => onCycleContributes(section)}
              title="Net Income sign — revenue is added, cost is subtracted. Click to switch.">
              {section.contributesAs === "revenue" ? "Revenue" : "Cost"}
            </button>
          )}
          {isPnl && (
            <button
              className={`${styles.flagChip} ${section.eliminateCommissary ? styles.flagChipOn : styles.flagChipOff}`}
              onClick={() => onToggleEliminate(section)}
              title="Commissary elimination — nets the commissary intercompany (commissary total sales) out of this section. Click to toggle (on for Sales and Food Cost).">
              <Scissors className={styles.flagChipIcon} />
              Commissary
            </button>
          )}
          <div className={styles.treeActions}>
            <Button size="sm" variant="ghost" className={styles.iconBtn}
              onClick={() => onAddGroup(section.id)} title="Add group">
              <Plus className={styles.statusIcon} />
            </Button>
            <Button size="sm" variant="ghost" className={styles.iconBtn}
              onClick={() => onStartEdit(section.id, section.name)} title="Rename">
              <Pencil className={styles.statusIcon} />
            </Button>
            <Button size="sm" variant="ghost" className={styles.deleteBtn}
              onClick={() => onDelete(section.id, section.name)} title="Delete section">
              <Trash2 className={styles.statusIcon} />
            </Button>
          </div>
        </div>
      )}

      <div ref={setDropRef} className={styles.treeGroupList}>
        {!hasGroups && <div className={styles.treeGroupListEmpty}>Drop a group here</div>}
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure Preview (read-only — mirrors generate-reports layout)
// ─────────────────────────────────────────────────────────────────────────────

function StructurePreview({ sections, reportType }: { sections: ReportGroup[]; reportType: ReportType }) {
  const grandTotalLabel = reportType === "pnl" ? "NET INCOME / (LOSS)" : "TOTAL";

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardHeaderTitle}>Report Preview</span>
      </div>
      <div className={styles.previewBody}>
        {sections.length === 0 ? (
          <div className={styles.emptyState}>Add sections to see the report layout.</div>
        ) : (
          <>
            {sections.map((section) => (
              <div key={section.id}>
                <div className={styles.previewSectionHeader}>{section.name}</div>
                {section.children.map((group) => (
                  <div key={group.id}>
                    <div className={styles.previewGroup}>
                      <span className={styles.previewLineLabel}>{group.name}</span>
                    </div>
                    {group.subtotalAfter && (
                      <div className={styles.previewSubtotal}>
                        <span className={styles.previewLineLabel}>Total {section.name}</span>
                        <span className={styles.previewSubtotalTag}>subtotal</span>
                      </div>
                    )}
                  </div>
                ))}
                {section.eliminateCommissary && (
                  <div className={styles.previewGroup}>
                    <span className={styles.previewLineLabel}>Commissary Elimination</span>
                    <span className={styles.previewSubtotalTag}>commissary</span>
                  </div>
                )}
                <div className={styles.previewSectionTotal}>
                  <span className={styles.previewLineLabel}>Total {section.name}</span>
                </div>
              </div>
            ))}
            <div className={styles.previewGrandTotal}>{grandTotalLabel}</div>
          </>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

const STEP = 10;

export default function ReportStructurePage() {
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>("pnl");
  const [saving, setSaving] = useState(false);

  // Editing / adding state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newName, setNewName] = useState("");

  // Drag state
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadGroups = async () => {
    try {
      const data = await fetchGraphQL<{ reportGroups: ReportGroup[] }>(QUERY_REPORT_GROUPS);
      setGroups(data.reportGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report structure");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGroups(); }, []);

  const sections = useMemo(
    () => groups.filter((g) => g.reportType === reportType),
    [groups, reportType]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const persistOrder = async (items: { id: string; sortOrder: number; parentId?: number }[]) => {
    setSaving(true);
    try {
      await fetchGraphQL(MUTATION_REORDER_GROUPS, { items });
    } catch {
      await loadGroups(); // reconcile on failure
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (id: string, name: string) => { setEditingId(id); setEditingName(name); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    setSaving(true);
    try {
      await fetchGraphQL(MUTATION_UPDATE_GROUP, { id: editingId, input: { name: editingName.trim() } });
      await loadGroups();
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  const toggleSubtotal = async (group: ReportGroup) => {
    setSaving(true);
    try {
      await fetchGraphQL(MUTATION_UPDATE_GROUP, { id: group.id, input: { subtotalAfter: !group.subtotalAfter } });
      await loadGroups();
    } finally {
      setSaving(false);
    }
  };

  // Cycle a P&L section between revenue and cost (Net Income sign).
  const cycleContributes = async (section: ReportGroup) => {
    const next = section.contributesAs === "revenue" ? "cost" : "revenue";
    setSaving(true);
    try {
      await fetchGraphQL(MUTATION_UPDATE_GROUP, { id: section.id, input: { contributesAs: next } });
      await loadGroups();
    } finally {
      setSaving(false);
    }
  };

  // Toggle whether a P&L section nets out the commissary intercompany.
  const toggleEliminate = async (section: ReportGroup) => {
    setSaving(true);
    try {
      await fetchGraphQL(MUTATION_UPDATE_GROUP, { id: section.id, input: { eliminateCommissary: !section.eliminateCommissary } });
      await loadGroups();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, label: string) => {
    if (!confirm(`Delete "${label}"? This will fail if any accounts are still mapped to it.`)) return;
    setSaving(true);
    try {
      await fetchGraphQL(MUTATION_DELETE_GROUP, { id });
      await loadGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const create = async (parentId: string | null) => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await fetchGraphQL(MUTATION_CREATE_GROUP, {
        input: { name: newName.trim(), parentId: parentId ? Number(parentId) : null, reportType },
      });
      setNewName("");
      setAddingChildOf(null);
      setAddingSection(false);
      await loadGroups();
    } finally {
      setSaving(false);
    }
  };

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "section") {
      setActiveLabel(sections.find((s) => s.id === event.active.id)?.name ?? null);
    } else if (data?.type === "group") {
      const sec = sections.find((s) => s.id === data.sectionId);
      setActiveLabel(sec?.children.find((g) => g.id === event.active.id)?.name ?? null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLabel(null);
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;

    // ── Reorder sections among themselves ──
    if (activeType === "section") {
      const overSectionId =
        over.data.current?.type === "section" ? String(over.id) : over.data.current?.sectionId;
      if (!overSectionId || active.id === overSectionId) return;
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === overSectionId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(sections, oldIndex, newIndex);
      applySections(reordered);
      persistOrder(reordered.map((s, i) => ({ id: s.id, sortOrder: (i + 1) * STEP })));
      return;
    }

    // ── Move / reorder a group ──
    if (activeType === "group") {
      const fromSectionId: string = active.data.current?.sectionId;
      const overType = over.data.current?.type;

      let toSectionId: string;
      let toIndex: number;

      if (overType === "group") {
        toSectionId = over.data.current?.sectionId;
        const dest = sections.find((s) => s.id === toSectionId);
        toIndex = dest ? dest.children.findIndex((g) => g.id === over.id) : 0;
      } else if (overType === "dropzone") {
        toSectionId = over.data.current?.sectionId;
        toIndex = sections.find((s) => s.id === toSectionId)?.children.length ?? 0;
      } else if (overType === "section") {
        toSectionId = String(over.id);
        toIndex = sections.find((s) => s.id === toSectionId)?.children.length ?? 0;
      } else {
        return;
      }

      if (fromSectionId === toSectionId) {
        const sec = sections.find((s) => s.id === toSectionId);
        if (!sec) return;
        const oldIndex = sec.children.findIndex((g) => g.id === active.id);
        if (oldIndex === -1 || oldIndex === toIndex) return;
        const newChildren = arrayMove(sec.children, oldIndex, toIndex);
        const next = sections.map((s) => (s.id === toSectionId ? { ...s, children: newChildren } : s));
        applySections(next);
        persistOrder(newChildren.map((g, i) => ({ id: g.id, sortOrder: (i + 1) * STEP, parentId: Number(toSectionId) })));
      } else {
        const fromSec = sections.find((s) => s.id === fromSectionId);
        const toSec = sections.find((s) => s.id === toSectionId);
        if (!fromSec || !toSec) return;
        const moving = fromSec.children.find((g) => g.id === active.id);
        if (!moving) return;

        const newFrom = fromSec.children.filter((g) => g.id !== active.id);
        const newTo = [...toSec.children];
        newTo.splice(toIndex, 0, { ...moving, parentId: Number(toSectionId) });

        const next = sections.map((s) => {
          if (s.id === fromSectionId) return { ...s, children: newFrom };
          if (s.id === toSectionId) return { ...s, children: newTo };
          return s;
        });
        applySections(next);
        persistOrder([
          ...newFrom.map((g, i) => ({ id: g.id, sortOrder: (i + 1) * STEP, parentId: Number(fromSectionId) })),
          ...newTo.map((g, i) => ({ id: g.id, sortOrder: (i + 1) * STEP, parentId: Number(toSectionId) })),
        ]);
      }
    }
  };

  // Replace the current report type's sections within the full groups list (optimistic)
  const applySections = (nextSections: ReportGroup[]) => {
    setGroups((prev) => [...prev.filter((g) => g.reportType !== reportType), ...nextSections]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Loader2 className={styles.loadingSpinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorWrapper}>
          <AlertTriangle className={styles.errorIcon} />
          <p className={styles.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Report Structure</h1>
        <p className={styles.subtitle}>
          Drag to reorder sections and groups, or move a group to another section
        </p>
      </div>

      <div className={styles.typeToggle}>
        <Button variant="ghost"
          className={reportType === "pnl" ? styles.typeBtnActive : styles.typeBtnInactive}
          onClick={() => setReportType("pnl")}>
          Profit &amp; Loss
        </Button>
        <Button variant="ghost"
          className={reportType === "bs" ? styles.typeBtnActive : styles.typeBtnInactive}
          onClick={() => setReportType("bs")}>
          Balance Sheet
        </Button>
      </div>

      <div className={styles.layout}>
        <div className={styles.treeColumn}>
          <Card className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardHeaderTitle}>Sections &amp; Groups</span>
              <Button size="sm" variant="ghost" className={styles.iconBtn}
                onClick={() => { setAddingSection(true); setAddingChildOf(null); setNewName(""); }}
                title="Add section">
                <Plus className={styles.statusIcon} />
              </Button>
            </div>

            {addingSection && (
              <div className={styles.addForm}>
                <p className={styles.addLabel}>New section</p>
                <div className={styles.addRow}>
                  <Input className={styles.addInput} placeholder="Section name" value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") create(null); if (e.key === "Escape") setAddingSection(false); }}
                    autoFocus />
                  <Button size="sm" onClick={() => create(null)} disabled={saving || !newName.trim()}>
                    <Check className={styles.statusIcon} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingSection(false)}>
                    <X className={styles.statusIcon} />
                  </Button>
                </div>
              </div>
            )}

            {sections.length === 0 && !addingSection && (
              <div className={styles.emptyState}>No sections yet. Add one to start.</div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    editing={editingId === section.id}
                    editingName={editingName}
                    onEditingNameChange={setEditingName}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onAddGroup={(id) => { setAddingChildOf(id); setAddingSection(false); setNewName(""); }}
                    onDelete={remove}
                    onCycleContributes={cycleContributes}
                    onToggleEliminate={toggleEliminate}
                    saving={saving}
                    hasGroups={section.children.length > 0}
                  >
                    <SortableContext items={section.children.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                      {section.children.map((group) => (
                        <SortableGroup
                          key={group.id}
                          group={group}
                          sectionId={section.id}
                          editing={editingId === group.id}
                          editingName={editingName}
                          onEditingNameChange={setEditingName}
                          onStartEdit={startEdit}
                          onSaveEdit={saveEdit}
                          onCancelEdit={cancelEdit}
                          onToggleSubtotal={toggleSubtotal}
                          onDelete={remove}
                          saving={saving}
                        />
                      ))}
                    </SortableContext>

                    {addingChildOf === section.id && (
                      <div className={styles.addForm}>
                        <p className={styles.addLabel}>New group in {section.name}</p>
                        <div className={styles.addRow}>
                          <Input className={styles.addInput} placeholder="Group name" value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") create(section.id); if (e.key === "Escape") setAddingChildOf(null); }}
                            autoFocus />
                          <Button size="sm" onClick={() => create(section.id)} disabled={saving || !newName.trim()}>
                            <Check className={styles.statusIcon} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAddingChildOf(null)}>
                            <X className={styles.statusIcon} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </SortableSection>
                ))}
              </SortableContext>

              <DragOverlay>
                {activeLabel ? (
                  <div className={styles.overlayRow}>
                    <GripVertical className={styles.handleIcon} />
                    {activeLabel}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </Card>
        </div>

        <div className={styles.previewColumn}>
          <StructurePreview sections={sections} reportType={reportType} />
        </div>
      </div>
    </div>
  );
}
