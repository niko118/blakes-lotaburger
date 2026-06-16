import type { Role } from "@app-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { AlertTriangle } from "lucide-react";
import { buttonHoverStyles } from "@lib/styles/button-styles";

const styles = {
  content: "space-y-4",
  warningContainer: "flex items-start gap-3 p-4 bg-red-extra-light border border-red-soft rounded-md",
  warningIcon: "h-5 w-5 text-red mt-0.5 flex-shrink-0",
  warningText: "text-sm text-red-dark",
  warningTitle: "font-medium mb-1",
  roleInfo: "space-y-2",
  label: "text-sm font-medium text-steel",
  value: "text-sm text-dark-grey",
  permissionsList: "text-sm text-silver",
} as const;

interface DeleteRoleDialogProps {
  open: boolean;
  role: Role | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteRoleDialog({
  open,
  role,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteRoleDialogProps) {
  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this role? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.content}>
          <div className={styles.warningContainer}>
            <AlertTriangle className={styles.warningIcon} />
            <div className={styles.warningText}>
              <p className={styles.warningTitle}>Warning</p>
              <p>
                If any users are currently assigned to this role, the deletion will fail.
                You must reassign or remove those users first.
              </p>
            </div>
          </div>

          <div className={styles.roleInfo}>
            <div>
              <p className={styles.label}>Role Name</p>
              <p className={styles.value}>{role.name}</p>
            </div>

            {role.description && (
              <div>
                <p className={styles.label}>Description</p>
                <p className={styles.value}>{role.description}</p>
              </div>
            )}

            <div>
              <p className={styles.label}>Permissions ({role.permissions.length})</p>
              <p className={styles.permissionsList}>
                {role.permissions.join(", ") || "None"}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className={buttonHoverStyles.blue}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
