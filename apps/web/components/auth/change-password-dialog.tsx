"use client";

import { useState } from "react";
import { fetchGraphQL } from "@lib/graphql/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Text } from "@components/ui/text";
import type { ChangePasswordResult } from "@app-types";

const styles = {
  form: "space-y-4",
  formField: "space-y-2",
  successContainer: "py-4 text-center",
  footerButtons: "flex gap-2 justify-end",
} as const;

const CHANGE_PASSWORD_MUTATION = `
  mutation ChangeMyPassword($input: ChangePasswordInput!) {
    changeMyPassword(input: $input) {
      success
    }
  }
`;

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setSuccess(false);
    }
    onOpenChange(isOpen);
  };

  const validateForm = (): string | null => {
    if (!currentPassword) return "Current password is required";
    if (!newPassword) return "New password is required";
    if (newPassword.length < 8) return "New password must be at least 8 characters";
    if (newPassword !== confirmPassword) return "New passwords do not match";
    if (currentPassword === newPassword) return "New password must be different from current password";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await fetchGraphQL<{ changeMyPassword: ChangePasswordResult }>(
        CHANGE_PASSWORD_MUTATION,
        { input: { currentPassword, newPassword } }
      );

      if (data.changeMyPassword.success) {
        setSuccess(true);
        setTimeout(() => handleOpenChange(false), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className={styles.successContainer}>
            <Text size="md" tone="green" weight="medium">
              Password changed successfully!
            </Text>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formField}>
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setError(""); }}
                placeholder="Enter current password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formField}>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formField}>
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="Repeat new password"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <Text size="sm" tone="red">
                {error}
              </Text>
            )}

            <DialogFooter className={styles.footerButtons}>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Changing..." : "Change Password"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
