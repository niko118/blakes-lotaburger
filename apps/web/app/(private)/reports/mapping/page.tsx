"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { fetchGraphQL } from "@lib/graphql/client";
import type { ReportGroup, AccountMapping } from "@app-types";

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL
// ─────────────────────────────────────────────────────────────────────────────

const QUERY_REPORT_GROUPS = /* GraphQL */ `
  query ReportGroups($reportType: String) {
    reportGroups(reportType: $reportType) {
      id name parentId reportType sortOrder subtotalAfter
      children { id name parentId reportType sortOrder subtotalAfter }
    }
  }
`;

const QUERY_ACCOUNT_MAPPINGS = /* GraphQL */ `
  query AccountMappings {
    accountMappings {
      id accountName groupId reportType ignored
      group { id name }
    }
  }
`;

const MUTATION_UPDATE_MAPPING = /* GraphQL */ `
  mutation UpdateAccountMapping($accountName: String!, $input: UpdateAccountMappingInput!) {
    updateAccountMapping(accountName: $accountName, input: $input) {
      id accountName groupId reportType ignored group { id name }
    }
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

  layout: "flex gap-6 items-start",
  sidebar: "w-72 flex-shrink-0 space-y-3",
  main: "flex-1 min-w-0 space-y-4",

  sidebarCard: "border-cloud overflow-hidden",
  sidebarHeader: "flex items-center justify-between px-4 py-3 border-b border-cloud bg-fog",
  sidebarHeaderTitle: "text-xs font-semibold text-silver uppercase tracking-wide",
  sidebarHeaderActions: "flex items-center gap-1",

  // Group tree
  treeSection: "border-b border-cloud last:border-b-0",
  treeSectionHeader: "flex items-center gap-1.5 px-3 py-2 cursor-pointer hover:bg-fog/60 transition-colors group",
  treeSectionChevron: "h-3.5 w-3.5 text-silver flex-shrink-0",
  treeSectionName: "text-xs font-semibold text-steel flex-1 truncate",
  treeSectionActions: "hidden group-hover:flex items-center gap-0.5",
  treeSectionCount: "text-xs text-rain ml-auto",
  treeGroupItem: "flex items-center gap-1.5 px-4 py-1.5 cursor-pointer hover:bg-fog/40 transition-colors group",
  treeGroupName: "text-xs text-dark-grey flex-1 truncate",
  treeGroupNameActive: "text-primary font-medium",
  treeGroupCount: "text-xs text-rain",
  treeGroupActions: "hidden group-hover:flex items-center gap-0.5",

  // Inline edit
  inlineEditRow: "flex items-center gap-1 px-2 py-1",
  inlineEditInput: "h-7 text-xs flex-1",
  inlineEditBtn: "h-7 w-7 p-0",

  // Add group form
  addGroupForm: "px-3 py-2 space-y-2 border-t border-cloud bg-fog/30",
  addGroupLabel: "text-xs font-medium text-silver",
  addGroupRow: "flex gap-1.5",
  addGroupInput: "h-8 text-xs flex-1",
  addGroupTypeSelect: "h-8 text-xs w-20",

  typeToggle: "inline-flex items-center gap-1 p-1 rounded-lg bg-fog border border-cloud",
  typeBtnActive: "h-9 px-4 text-sm font-medium bg-white text-primary shadow-sm",
  typeBtnInactive: "h-9 px-4 text-sm font-medium text-silver hover:text-steel",

  toolbar: "flex items-center gap-3 flex-wrap",
  searchWrapper: "relative flex-1 min-w-[200px] max-w-sm",
  searchIcon: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver pointer-events-none",
  searchInput: "pl-9",
  filterSelect: "w-44",

  statsRow: "flex items-center gap-6 flex-wrap",
  statBlock: "flex items-center gap-2",
  statValue: "text-sm font-semibold text-steel",
  statLabel: "text-sm text-silver",
  unmappedBadge: "flex items-center gap-1.5 text-sm font-medium text-yellow",
  mappedBadge: "flex items-center gap-1.5 text-sm font-medium text-green",
  ignoredBadge: "flex items-center gap-1.5 text-sm font-medium text-silver",

  tableWrapper: "border border-cloud rounded-lg overflow-hidden",
  tableHeader: "grid grid-cols-[1fr_220px_140px_auto] gap-0 bg-fog border-b border-cloud",
  tableHeaderCell: "px-4 py-3 text-xs font-semibold text-silver uppercase tracking-wide",
  tableRow: "grid grid-cols-[1fr_220px_140px_auto] gap-0 border-b border-cloud last:border-b-0 hover:bg-fog/50 transition-colors",
  tableRowUnmapped: "bg-yellow/3",
  tableCellAccount: "px-4 py-3 text-sm text-steel font-mono truncate self-center",
  tableCellGroup: "px-4 py-3 self-center",
  tableCellStatus: "px-4 py-3 self-center",
  tableCellActions: "px-4 py-3 self-center",

  groupSelect: "h-8 text-sm min-w-0",
  statusBadge: "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
  statusUnmapped: "bg-yellow/10 text-yellow border border-yellow/20",
  statusMapped: "bg-green/10 text-green border border-green/20",
  statusIgnored: "bg-fog text-silver border border-cloud",

  emptyState: "flex flex-col items-center justify-center py-16 text-center",
  emptyIcon: "h-10 w-10 text-silver mb-3",
  emptyTitle: "text-sm font-semibold text-steel",
  emptyDesc: "text-sm text-silver mt-1",

  loadingState: "flex items-center justify-center py-16",
  loadingSpinner: "h-8 w-8 text-silver animate-spin",
  savingSpinner: "h-4 w-4 text-silver animate-spin",
  statusIcon: "h-3 w-3",
  statIcon: "h-4 w-4",
  ignoreIcon: "h-3.5 w-3.5",

  errorWrapper: "flex items-center gap-3 p-4 rounded-lg bg-red/5 border border-red/20",
  errorIcon: "h-5 w-5 text-red flex-shrink-0",
  errorText: "text-sm text-steel",

  treeActionBtn: "h-5 w-5 p-0 text-silver hover:text-steel",
  deleteBtn: "h-5 w-5 p-0 text-silver hover:text-red",
} as const;

type FilterMode = "all" | "unmapped" | "mapped" | "ignored";
type ReportTypeFilter = "pnl" | "bs";

// ─────────────────────────────────────────────────────────────────────────────
// Group Tree Panel
// ─────────────────────────────────────────────────────────────────────────────

interface GroupTreeProps {
  groups: ReportGroup[];
  mappings: AccountMapping[];
  reportTypeFilter: ReportTypeFilter;
  activeGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
}

// Read-only navigation tree. Structure editing lives in /reports/structure.
function GroupTree({ groups, mappings, reportTypeFilter, activeGroupId, onSelectGroup }: GroupTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filteredSections = groups.filter((g) => g.reportType === reportTypeFilter);

  const countForGroup = (groupId: string) =>
    mappings.filter((m) => !m.ignored && String(m.groupId) === groupId).length;

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card className={styles.sidebarCard}>
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarHeaderTitle}>Groups</span>
      </div>

      {/* All accounts option */}
      <button
        type="button"
        className={`${styles.treeGroupItem} w-full text-left border-b border-cloud`}
        onClick={() => onSelectGroup(null)}
      >
        <span className={`${styles.treeGroupName} ${activeGroupId === null ? styles.treeGroupNameActive : ""}`}>
          All accounts
        </span>
        <span className={styles.treeGroupCount}>{mappings.length}</span>
      </button>

      {filteredSections.map((section) => {
        const isCollapsed = collapsed.has(section.id);

        return (
          <div key={section.id} className={styles.treeSection}>
            <div className={styles.treeSectionHeader} onClick={() => toggleCollapse(section.id)}>
              {isCollapsed
                ? <ChevronRight className={styles.treeSectionChevron} />
                : <ChevronDown className={styles.treeSectionChevron} />
              }
              <span className={styles.treeSectionName}>{section.name}</span>
            </div>

            {!isCollapsed &&
              section.children.map((group) => {
                const count = countForGroup(group.id);
                const isActive = activeGroupId === group.id;

                return (
                  <div
                    key={group.id}
                    className={styles.treeGroupItem}
                    onClick={() => onSelectGroup(isActive ? null : group.id)}
                  >
                    <span className={`${styles.treeGroupName} ${isActive ? styles.treeGroupNameActive : ""}`}>
                      {group.name}
                    </span>
                    <span className={styles.treeGroupCount}>{count}</span>
                  </div>
                );
              })}
          </div>
        );
      })}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AccountMappingPage() {
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [reportTypeFilter, setReportTypeFilter] = useState<ReportTypeFilter>("pnl");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const [savingAccount, setSavingAccount] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [groupsData, mappingsData] = await Promise.all([
        fetchGraphQL<{ reportGroups: ReportGroup[] }>(QUERY_REPORT_GROUPS),
        fetchGraphQL<{ accountMappings: AccountMapping[] }>(QUERY_ACCOUNT_MAPPINGS),
      ]);
      setGroups(groupsData.reportGroups);
      setMappings(mappingsData.accountMappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const allLeafGroups = useMemo(() => {
    const flat: { id: string; label: string; reportType: string }[] = [];
    for (const section of groups) {
      for (const child of section.children) {
        flat.push({ id: child.id, label: `${section.name} → ${child.name}`, reportType: section.reportType });
      }
    }
    return flat;
  }, [groups]);

  const stats = useMemo(() => {
    const total = mappings.length;
    const ignored = mappings.filter((m) => m.ignored).length;
    const mapped = mappings.filter((m) => !m.ignored && m.groupId !== null).length;
    const unmapped = mappings.filter((m) => !m.ignored && m.groupId === null).length;
    return { total, ignored, mapped, unmapped };
  }, [mappings]);

  const filtered = useMemo(() => {
    return mappings.filter((m) => {
      const matchesSearch = !search || m.accountName.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "unmapped" && !m.ignored && m.groupId === null) ||
        (filterMode === "mapped" && !m.ignored && m.groupId !== null) ||
        (filterMode === "ignored" && m.ignored);
      // Match by the account's own statement. Unclassified (null) accounts show
      // under whichever tab is active so they are never hidden.
      const matchesType = m.reportType === reportTypeFilter || m.reportType == null;
      const matchesGroup =
        !activeGroupId ||
        String(m.groupId) === activeGroupId;

      return matchesSearch && matchesFilter && matchesType && matchesGroup;
    });
  }, [mappings, search, filterMode, reportTypeFilter, activeGroupId]);

  const handleUpdateMapping = async (
    accountName: string,
    update: { groupId?: number | null; ignored?: boolean }
  ) => {
    setSavingAccount(accountName);
    try {
      const data = await fetchGraphQL<{ updateAccountMapping: AccountMapping }>(
        MUTATION_UPDATE_MAPPING,
        { accountName, input: update }
      );
      const updated = data.updateAccountMapping;
      setMappings((prev) => prev.map((m) => (m.accountName === accountName ? updated : m)));
    } catch (err) {
      console.error("Failed to update mapping:", err);
    } finally {
      setSavingAccount(null);
    }
  };

  const handleGroupChange = (accountName: string, value: string) => {
    const groupId = value === "__unassigned__" ? null : Number(value);
    handleUpdateMapping(accountName, { groupId, ignored: false });
  };

  const handleIgnoreToggle = (mapping: AccountMapping) => {
    handleUpdateMapping(mapping.accountName, {
      ignored: !mapping.ignored,
      groupId: mapping.ignored ? mapping.groupId : null,
    });
  };

  const availableGroups = useMemo(
    () => allLeafGroups.filter((g) => g.reportType === reportTypeFilter),
    [allLeafGroups, reportTypeFilter]
  );

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
        <h1 className={styles.title}>Account Mapping</h1>
        <p className={styles.subtitle}>
          Assign R365 accounts to report groups for summary reports
        </p>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statBlock}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>total accounts</span>
        </div>
        <div className={`${styles.statBlock} ${styles.unmappedBadge}`}>
          <AlertTriangle className={styles.statIcon} />
          <span>{stats.unmapped} unmapped</span>
        </div>
        <div className={`${styles.statBlock} ${styles.mappedBadge}`}>
          <CheckCircle2 className={styles.statIcon} />
          <span>{stats.mapped} mapped</span>
        </div>
        <div className={`${styles.statBlock} ${styles.ignoredBadge}`}>
          <EyeOff className={styles.statIcon} />
          <span>{stats.ignored} ignored</span>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Left: group tree */}
        <div className={styles.sidebar}>
          <GroupTree
            groups={groups}
            mappings={mappings}
            reportTypeFilter={reportTypeFilter}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
          />
        </div>

        {/* Right: accounts table */}
        <div className={styles.main}>
          <div className={styles.toolbar}>
            <div className={styles.typeToggle}>
              <Button
                variant="ghost"
                className={reportTypeFilter === "pnl" ? styles.typeBtnActive : styles.typeBtnInactive}
                onClick={() => setReportTypeFilter("pnl")}
              >
                Profit &amp; Loss
              </Button>
              <Button
                variant="ghost"
                className={reportTypeFilter === "bs" ? styles.typeBtnActive : styles.typeBtnInactive}
                onClick={() => setReportTypeFilter("bs")}
              >
                Balance Sheet
              </Button>
            </div>

            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} />
              <Input
                className={styles.searchInput}
                placeholder="Search accounts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
              <SelectTrigger className={styles.filterSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                <SelectItem value="unmapped">Unmapped only</SelectItem>
                <SelectItem value="mapped">Mapped only</SelectItem>
                <SelectItem value="ignored">Ignored only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className={styles.tableWrapper}>
            <div className={styles.tableHeader}>
              <div className={styles.tableHeaderCell}>Account Name</div>
              <div className={styles.tableHeaderCell}>Assigned Group</div>
              <div className={styles.tableHeaderCell}>Status</div>
              <div className={styles.tableHeaderCell}>Actions</div>
            </div>

            {filtered.length === 0 ? (
              <div className={styles.emptyState}>
                <Search className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No accounts found</p>
                <p className={styles.emptyDesc}>
                  {search ? "Try adjusting your search or filter" : "No accounts match the current filter"}
                </p>
              </div>
            ) : (
              filtered.map((mapping) => {
                const isSaving = savingAccount === mapping.accountName;
                const isUnmapped = !mapping.ignored && mapping.groupId === null;

                return (
                  <div
                    key={mapping.accountName}
                    className={`${styles.tableRow} ${isUnmapped ? styles.tableRowUnmapped : ""}`}
                  >
                    <div className={styles.tableCellAccount} title={mapping.accountName}>
                      {mapping.accountName}
                    </div>

                    <div className={styles.tableCellGroup}>
                      <Select
                        value={mapping.groupId !== null ? String(mapping.groupId) : "__unassigned__"}
                        onValueChange={(v) => handleGroupChange(mapping.accountName, v)}
                        disabled={mapping.ignored || isSaving}
                      >
                        <SelectTrigger className={styles.groupSelect}>
                          <SelectValue placeholder="Assign group..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unassigned__">— Unassigned —</SelectItem>
                          {availableGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={styles.tableCellStatus}>
                      {isSaving ? (
                        <Loader2 className={styles.savingSpinner} />
                      ) : mapping.ignored ? (
                        <span className={`${styles.statusBadge} ${styles.statusIgnored}`}>
                          <EyeOff className={styles.statusIcon} />
                          Ignored
                        </span>
                      ) : mapping.groupId !== null ? (
                        <span className={`${styles.statusBadge} ${styles.statusMapped}`}>
                          <CheckCircle2 className={styles.statusIcon} />
                          Mapped
                        </span>
                      ) : (
                        <span className={`${styles.statusBadge} ${styles.statusUnmapped}`}>
                          <AlertTriangle className={styles.statusIcon} />
                          Unmapped
                        </span>
                      )}
                    </div>

                    <div className={styles.tableCellActions}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isSaving}
                        onClick={() => handleIgnoreToggle(mapping)}
                        title={mapping.ignored ? "Un-ignore this account" : "Ignore this account"}
                      >
                        <EyeOff className={styles.ignoreIcon} />
                        {mapping.ignored ? "Un-ignore" : "Ignore"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
