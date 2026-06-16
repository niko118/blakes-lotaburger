import type { Role } from "@app-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import { TableCellText } from "@components/ui/table-cell-text";
import { TableHeaderCell } from "@components/ui/table-header-cell";
import { buttonHoverStyles } from "@lib/styles/button-styles";

const styles = {
  table: "w-full",
  colName: "w-1/4",
  colDescription: "w-1/4",
  colActions: "w-24",
  actionButtons: "flex items-center gap-2",
  iconButton: `h-8 w-8 p-0 ${buttonHoverStyles.blue}`,
  icon: "h-4 w-4",
  permissionBadges: "flex flex-wrap gap-1",
  permissionBadge: "text-xs",
  emptyText: "text-center",
  descriptionText: "text-sm text-silver max-w-md truncate",
} as const;

interface RolesTableProps {
  roles: Role[];
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function RolesTable({ roles, onEdit, onDelete }: RolesTableProps) {
  return (
    <Table className={styles.table}>
      <TableHeader>
        <TableRow>
          <TableHeaderCell className={styles.colName}>Name</TableHeaderCell>
          <TableHeaderCell className={styles.colDescription}>
            Description
          </TableHeaderCell>
          <TableHeaderCell>Permissions</TableHeaderCell>
          <TableHeaderCell className={styles.colActions}>Actions</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className={styles.emptyText}>
              <TableCellText tone="silver">No roles found</TableCellText>
            </TableCell>
          </TableRow>
        ) : (
          roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell>
                <TableCellText weight="semibold">{role.name}</TableCellText>
              </TableCell>
              <TableCell>
                <div className={styles.descriptionText}>
                  <TableCellText tone="silver">
                    {role.description || "—"}
                  </TableCellText>
                </div>
              </TableCell>
              <TableCell>
                <div className={styles.permissionBadges}>
                  {role.permissions.length === 0 ? (
                    <TableCellText tone="silver">No permissions</TableCellText>
                  ) : (
                    <>
                      {role.permissions.slice(0, 3).map((permission) => (
                        <Badge
                          key={permission}
                          variant="outline"
                          className={styles.permissionBadge}
                        >
                          {permission}
                        </Badge>
                      ))}
                      {role.permissions.length > 3 && (
                        <Badge variant="outline" className={styles.permissionBadge}>
                          +{role.permissions.length - 3} more
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className={styles.actionButtons}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(role)}
                    className={styles.iconButton}
                    title="Edit role"
                  >
                    <Edit className={styles.icon} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(role)}
                    className={styles.iconButton}
                    title="Delete role"
                  >
                    <Trash2 className={styles.icon} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
