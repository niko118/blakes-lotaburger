import { useState, useEffect } from "react";
import type { AppUser, Role } from "@app-types";
import { fetchGraphQL } from "@lib/graphql/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { Switch } from "@components/ui/switch";
import { buttonHoverStyles } from "@lib/styles/button-styles";
import { Text } from "@components/ui/text";

const styles = {
  form: "space-y-4",
  formField: "space-y-2",
  switchContainer: "flex items-center space-x-2",
  adminToggleContainer: "flex items-center gap-3",
  errorText: "text-sm text-red",
  required: "text-red",
  selectTriggerWithPlaceholder: "data-[placeholder]:text-silver",
} as const;

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    email: string;
    name: string | null;
    password?: string;
    isAdmin: boolean;
    roleId: string | null;
    isActive: boolean;
  }) => Promise<void>;
  editingUser: AppUser | null;
  isCurrentUserAdmin: boolean;
}

export function UserForm({
  open,
  onOpenChange,
  onSubmit,
  editingUser,
  isCurrentUserAdmin,
}: UserFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // Load roles on mount
  useEffect(() => {
    const loadRoles = async () => {
      setIsLoadingRoles(true);
      try {
        const query = `query GetRoles { roles { id name description } }`;
        const data = await fetchGraphQL(query);
        setRoles(data?.roles || []);
      } catch (error) {
        console.error("Failed to load roles:", error);
      }
      setIsLoadingRoles(false);
    };
    loadRoles();
  }, []);

  // When editing, set initial values
  useEffect(() => {
    if (editingUser) {
      setEmail(editingUser.email);
      setName(editingUser.name || "");
      setPassword("");
      setIsAdmin(editingUser.isAdmin || false);
      setRoleId(editingUser.role?.id || null);
      setIsActive(editingUser.isActive);
    } else {
      setEmail("");
      setName("");
      setPassword("");
      setIsAdmin(false);
      setRoleId(null);
      setIsActive(true);
    }
    setRoleError("");
    setPasswordError("");
  }, [editingUser, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleError("");
    setPasswordError("");

    // Validate role for non-admin users
    if (!isAdmin && !roleId) {
      setRoleError("Please select a role");
      return;
    }

    // Validate password for new users
    if (!editingUser && (!password || password.length < 8)) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    // Validate password length if provided on edit
    if (editingUser && password && password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        email,
        name: name.trim() || null,
        password: password || undefined,
        isAdmin,
        roleId: isAdmin ? null : roleId,
        isActive,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingUser ? "Edit User" : "Add New User"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formField}>
            <Label htmlFor="email">
              Email <span className={styles.required}>*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!!editingUser}
            />
          </div>

          <div className={styles.formField}>
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.formField}>
            <Label htmlFor="password">
              {editingUser ? "New Password (leave empty to keep current)" : "Password"}
              {!editingUser && <span className={styles.required}> *</span>}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
              placeholder={editingUser ? "Leave empty to keep current" : "Enter password"}
              required={!editingUser}
            />
            {passwordError && (
              <Text size="sm" tone="red">
                {passwordError}
              </Text>
            )}
          </div>

          {/* Admin Toggle - Only visible to admins */}
          {isCurrentUserAdmin && (
            <div className={styles.formField}>
              <Label htmlFor="is-admin">Administrator</Label>
              <div className={styles.adminToggleContainer}>
                <Switch
                  id="is-admin"
                  checked={isAdmin}
                  onCheckedChange={setIsAdmin}
                />
                <Text size="sm" tone="muted">
                  Grant full system access (bypasses role permissions)
                </Text>
              </div>
            </div>
          )}

          {/* Role Selector - Hidden if admin toggle is checked */}
          {!isAdmin && (
            <div className={styles.formField}>
              <Label htmlFor="role">
                Role <span className={styles.required}>*</span>
              </Label>
              <Select
                value={roleId || ""}
                onValueChange={(value) => {
                  setRoleId(value);
                  setRoleError("");
                }}
                disabled={isLoadingRoles}
              >
                <SelectTrigger id="role" className={styles.selectTriggerWithPlaceholder}>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roleError && (
                <Text size="sm" tone="red">
                  {roleError}
                </Text>
              )}
            </div>
          )}

          <div className={styles.switchContainer}>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="active">Active</Label>
          </div>

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
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
