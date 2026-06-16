"use client";
import { useState, useEffect } from "react";
import { fetchGraphQL } from "@lib/graphql/client";
import type { Role } from "@app-types";
import { Text } from "@components/ui/text";
import { Card, CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Plus } from "lucide-react";
import { LoadingSpinner } from "@components/ui/loading-spinner";
import { RolesTable } from "@components/roles/roles-table";
import { RoleForm } from "@components/roles/role-form";
import { DeleteRoleDialog } from "@components/roles/delete-role-dialog";
import { useToast } from "@hooks/use-toast";

async function fetchRoles(): Promise<Role[]> {
  const query = `
    query GetRoles {
      roles {
        id
        name
        description
        permissions
        createdAt
        updatedAt
      }
    }
  `;

  const data = await fetchGraphQL(query);
  return data?.roles || [];
}

const styles = {
  pageContainer: "space-y-6",
  headerSection: "flex items-center justify-between",
  titleSection: "space-y-1",
  addButton: "h-9",
  addButtonIcon: "h-4 w-4 mr-2",
  tableCard: "bg-white border-cloud",
  cardContent: "p-6",
} as const;

export default function RolesPage() {
  // Route protection is handled by middleware (requires roles.manage permission)
  // GraphQL resolver also enforces roles.manage permission
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const data = await fetchRoles();
      setRoles(data);
    } catch (error) {
      console.error("Failed to load roles:", error);
      toast({
        title: "Failed to load roles",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleCreate = () => {
    setEditingRole(null);
    setIsFormOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setIsFormOpen(true);
  };

  const handleDelete = (role: Role) => {
    setDeletingRole(role);
    setIsDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (data: {
    name: string;
    description: string | null;
    permissions: string[];
  }) => {
    try {
      if (editingRole) {
        // Update existing role
        const mutation = `
          mutation UpdateRole($id: ID!, $input: UpdateRoleInput!) {
            updateRole(id: $id, input: $input) {
              id
              name
              description
              permissions
              createdAt
              updatedAt
            }
          }
        `;

        await fetchGraphQL(mutation, {
          id: editingRole.id,
          input: data,
        });

        toast({
          title: "Role updated successfully",
          description: `Role "${data.name}" has been updated.`,
        });
      } else {
        // Create new role
        const mutation = `
          mutation CreateRole($input: CreateRoleInput!) {
            createRole(input: $input) {
              id
              name
              description
              permissions
              createdAt
              updatedAt
            }
          }
        `;

        await fetchGraphQL(mutation, { input: data });

        toast({
          title: "Role created successfully",
          description: `Role "${data.name}" has been created.`,
        });
      }

      setIsFormOpen(false);
      setEditingRole(null);
      await loadRoles();
    } catch (error: unknown) {
      console.error("Failed to save role:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save role";
      toast({
        title: "Failed to save role",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRole) return;

    try {
      const mutation = `
        mutation DeleteRole($id: ID!) {
          deleteRole(id: $id)
        }
      `;

      await fetchGraphQL(mutation, { id: deletingRole.id });

      toast({
        title: "Role deleted successfully",
        description: `Role "${deletingRole.name}" has been deleted.`,
      });
      setIsDeleteDialogOpen(false);
      setDeletingRole(null);
      await loadRoles();
    } catch (error: unknown) {
      console.error("Failed to delete role:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete role";
      toast({
        title: "Failed to delete role",
        description: errorMessage,
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
      setDeletingRole(null);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerSection}>
        <div className={styles.titleSection}>
          <Text size="2xl" weight="bold">
            Roles
          </Text>
          <Text tone="silver">Manage custom roles and permissions</Text>
        </div>
        <Button onClick={handleCreate} className={styles.addButton}>
          <Plus className={styles.addButtonIcon} />
          Create Role
        </Button>
      </div>

      <Card className={styles.tableCard}>
        <CardContent className={styles.cardContent}>
          <RolesTable roles={roles} onEdit={handleEdit} onDelete={handleDelete} />
        </CardContent>
      </Card>

      <RoleForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        editingRole={editingRole}
      />

      <DeleteRoleDialog
        open={isDeleteDialogOpen}
        role={deletingRole}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={false}
      />
    </div>
  );
}
