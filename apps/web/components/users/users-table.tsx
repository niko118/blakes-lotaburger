import type { AppUser } from "@app-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { Button } from "@components/ui/button";
import { Switch } from "@components/ui/switch";
import { Badge } from "@components/ui/badge";
import { Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableCellText } from "@components/ui/table-cell-text";
import { TableHeaderCell } from "@components/ui/table-header-cell";
import { buttonHoverStyles } from "@lib/styles/button-styles";

const styles = {
  table: "w-full",
  actionButtons: "flex items-center gap-2",
  iconButton: `h-8 w-8 p-0 ${buttonHoverStyles.blue}`,
  icon: "h-4 w-4",
  roleBadge: "text-xs font-medium",
  emptyText: "text-center",
  sortableHeader: "cursor-pointer hover:bg-cloud select-none",
  sortIconContainer: "flex items-center gap-2",
  iconSmall: "h-4 w-4",
  iconSmallFaded: "h-4 w-4 opacity-40",
} as const;

function formatLastLogin(lastLoginAt: string | null): string {
  if (!lastLoginAt) return "—";

  const date = new Date(lastLoginAt);
  return date.toISOString().substring(0, 10);
}

interface UsersTableProps {
  users: AppUser[];
  currentUserId: string;
  isCurrentUserAdmin: boolean;
  sortBy: "lastLoginAt" | null;
  sortDirection: "asc" | "desc";
  onLastLoginSort: () => void;
  onEdit: (user: AppUser) => void;
  onDelete: (user: AppUser) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export function UsersTable({
  users,
  currentUserId,
  isCurrentUserAdmin,
  sortBy,
  sortDirection,
  onLastLoginSort,
  onEdit,
  onDelete,
  onToggleActive,
}: UsersTableProps) {
  const canModifyUser = (user: AppUser) => {
    if (isCurrentUserAdmin) return true;
    // Non-admin users cannot modify admin users
    if (!user.isAdmin) return true;
    return false;
  };

  const canDeleteUser = (user: AppUser) => {
    if (user.id === currentUserId) return false;
    return canModifyUser(user);
  };

  if (users.length === 0) {
    return (
      <div className={styles.emptyText}>
        <TableCellText tone="silver">No users found</TableCellText>
      </div>
    );
  }

  return (
    <Table className={styles.table}>
      <TableHeader>
        <TableRow>
          <TableHeaderCell weight="semibold" tone="gray900" size="md">
            Email
          </TableHeaderCell>
          <TableHeaderCell weight="semibold" tone="gray900" size="md">
            Name
          </TableHeaderCell>
          <TableHeaderCell weight="semibold" tone="gray900" size="md">
            Role
          </TableHeaderCell>
          <TableHeaderCell
            weight="semibold"
            tone="gray900"
            size="md"
            className={styles.sortableHeader}
            onClick={onLastLoginSort}
          >
            <div className={styles.sortIconContainer}>
              Last Login
              {sortBy === "lastLoginAt" ? (
                sortDirection === "asc" ? (
                  <ArrowUp className={styles.iconSmall} />
                ) : (
                  <ArrowDown className={styles.iconSmall} />
                )
              ) : (
                <ArrowUpDown className={styles.iconSmallFaded} />
              )}
            </div>
          </TableHeaderCell>
          <TableHeaderCell weight="semibold" tone="gray900" size="md">
            Active
          </TableHeaderCell>
          <TableHeaderCell weight="semibold" tone="gray900" size="md">
            Actions
          </TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <TableCellText weight="medium">{user.email}</TableCellText>
            </TableCell>
            <TableCell>
              <TableCellText>{user.name || "-"}</TableCellText>
            </TableCell>
            <TableCell>
              {user.isAdmin ? (
                <Badge variant="default" className={styles.roleBadge}>
                  Administrator
                </Badge>
              ) : user.role ? (
                <Badge variant="secondary" className={styles.roleBadge}>
                  {user.role.name}
                </Badge>
              ) : (
                <TableCellText tone="silver">No role</TableCellText>
              )}
            </TableCell>
            <TableCell>
              <TableCellText tone="steel">
                {formatLastLogin(user.lastLoginAt)}
              </TableCellText>
            </TableCell>
            <TableCell>
              <Switch
                checked={user.isActive}
                onCheckedChange={(checked) => onToggleActive(user.id, checked)}
                disabled={!canModifyUser(user)}
              />
            </TableCell>
            <TableCell>
              <div className={styles.actionButtons}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={styles.iconButton}
                  onClick={() => onEdit(user)}
                  disabled={!canModifyUser(user)}
                >
                  <Edit className={styles.icon} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={styles.iconButton}
                  onClick={() => onDelete(user)}
                  disabled={!canDeleteUser(user)}
                >
                  <Trash2 className={styles.icon} />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
