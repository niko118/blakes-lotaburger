import { useState, useEffect } from "react";
import type { Role } from "@app-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Checkbox } from "@components/ui/checkbox";
import { buttonHoverStyles } from "@lib/styles/button-styles";
import { PERMISSIONS_BY_CATEGORY } from "@lib/auth/permissions-catalog";

const styles = {
  form: "space-y-6",
  formField: "space-y-2",
  permissionsSection: "space-y-4",
  categoryFrame: "border border-cloud rounded-md p-4 space-y-3",
  categoryTitle: "text-sm font-semibold text-steel",
  permissionsGrid: "space-y-2",
  permissionRow: "flex items-start space-x-3",
  checkboxLabel: "text-sm text-dark-grey leading-tight cursor-pointer",
  checkboxDescription: "text-xs text-silver mt-0.5",
  checkboxSize: "h-5 w-5 border-2 border-gray-400",
  errorText: "text-sm text-red",
  helperText: "text-sm text-silver",
  dialogContent: "max-w-2xl max-h-[90vh] overflow-y-auto",
  permissionLabelWrapper: "flex-1",
} as const;

interface RoleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description: string | null;
    permissions: string[];
  }) => Promise<void>;
  editingRole: Role | null;
}

export function RoleForm({
  open,
  onOpenChange,
  onSubmit,
  editingRole,
}: RoleFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingRole) {
      setName(editingRole.name);
      setDescription(editingRole.description || "");
      setSelectedPermissions(editingRole.permissions);
    } else {
      setName("");
      setDescription("");
      setSelectedPermissions([]);
    }
    setError("");
  }, [editingRole, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Role name is required");
      return;
    }

    if (selectedPermissions.length === 0) {
      setError("Please select at least one permission");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        permissions: selectedPermissions,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermissionToggle = (permissionKey: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permissionKey)) {
        // Unchecking - just remove this permission
        return prev.filter((p) => p !== permissionKey);
      } else {
        // Checking - add permission and auto-select .view if this is .edit
        const newPermissions = [...prev, permissionKey];

        // If selecting X.edit, auto-select X.view
        if (permissionKey.endsWith(".edit")) {
          const viewPermission = permissionKey.replace(".edit", ".view");
          if (!newPermissions.includes(viewPermission)) {
            newPermissions.push(viewPermission);
          }
        }

        return newPermissions;
      }
    });
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>
            {editingRole ? "Edit Role" : "Create New Role"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formField}>
            <Label htmlFor="role-name">Role Name</Label>
            <Input
              id="role-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Content Manager"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.formField}>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this role is for..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.permissionsSection}>
            <div className={styles.formField}>
              <Label>Permissions</Label>
              <p className={styles.helperText}>
                Select the permissions this role should have. At least one permission is required.
              </p>
            </div>

            {Object.entries(PERMISSIONS_BY_CATEGORY).map(([category, permissions]) => (
              <div key={category} className={styles.categoryFrame}>
                <h4 className={styles.categoryTitle}>{category}</h4>
                <div className={styles.permissionsGrid}>
                  {permissions.map((permission) => {
                    const isChecked = selectedPermissions.includes(permission.key);
                    return (
                      <div key={permission.key} className={styles.permissionRow}>
                        <Checkbox
                          id={permission.key}
                          checked={isChecked}
                          onCheckedChange={() => handlePermissionToggle(permission.key)}
                          disabled={isSubmitting}
                          className={styles.checkboxSize}
                        />
                        <label htmlFor={permission.key} className={styles.permissionLabelWrapper}>
                          <div className={styles.checkboxLabel}>
                            {permission.key}
                          </div>
                          <div className={styles.checkboxDescription}>
                            {permission.description}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className={buttonHoverStyles.blue}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
