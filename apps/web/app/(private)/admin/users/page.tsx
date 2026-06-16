"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { fetchGraphQL } from "@lib/graphql/client";
import type { AppUser } from "@app-types";
import { Text } from "@components/ui/text";
import { Card, CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Plus, Search } from "lucide-react";
import { LoadingSpinner } from "@components/ui/loading-spinner";
import { UsersTable } from "@components/users/users-table";
import { UserForm } from "@components/users/user-form";
import { DeleteUserDialog } from "@components/users/delete-user-dialog";
import { useToast } from "@hooks/use-toast";

async function fetchAppUsers(): Promise<AppUser[]> {
  const query = `
    query GetAppUsers {
      appUsers {
        id
        email
        name
        isAdmin
        role {
          id
          name
          description
        }
        isActive
        lastLoginAt
        createdAt
        updatedAt
      }
    }
  `;

  const data = await fetchGraphQL(query);
  return data?.appUsers || [];
}

const styles = {
  pageContainer: "space-y-6",
  headerSection: "flex items-center justify-between",
  titleSection: "space-y-1",
  addButton: "h-9",
  addButtonIcon: "h-4 w-4 mr-2",
  searchSection: "flex items-center gap-4",
  searchInputContainer: "relative flex-1 max-w-sm",
  searchInput: "pl-10",
  searchIcon: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver",
  tableCard: "bg-white border-cloud",
  cardContent: "p-6",
} as const;

export default function UsersPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [sortBy, setSortBy] = useState<"lastLoginAt" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const isCurrentUserAdmin = session?.user?.isAdmin || false;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await fetchAppUsers();
      setUsers(result);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrUpdate = async (data: {
    email: string;
    name: string | null;
    password?: string;
    isAdmin: boolean;
    roleId: string | null;
    isActive: boolean;
  }) => {
    try {
      if (editingUser) {
        const mutation = `
          mutation UpdateAppUser($id: ID!, $input: UpdateAppUserInput!) {
            updateAppUser(id: $id, input: $input) {
              id
              email
              name
              isAdmin
              role {
                id
                name
                description
              }
              isActive
              lastLoginAt
              createdAt
              updatedAt
            }
          }
        `;

        const result = await fetchGraphQL(mutation, {
          id: editingUser.id,
          input: {
            name: data.name,
            password: data.password || undefined,
            isAdmin: data.isAdmin,
            roleId: data.roleId,
            isActive: data.isActive,
          },
        });

        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? result.updateAppUser : u))
        );
      } else {
        const mutation = `
          mutation CreateAppUser($input: CreateAppUserInput!) {
            createAppUser(input: $input) {
              id
              email
              name
              isAdmin
              role {
                id
                name
                description
              }
              isActive
              lastLoginAt
              createdAt
              updatedAt
            }
          }
        `;

        const result = await fetchGraphQL(mutation, {
          input: {
            email: data.email,
            name: data.name,
            password: data.password,
            isAdmin: data.isAdmin,
            roleId: data.roleId,
            isActive: data.isActive,
          },
        });

        setUsers((prev) => [...prev, result.createAppUser]);
      }

      setIsFormOpen(false);
      setEditingUser(null);
      toast({
        title: editingUser ? "User updated" : "User created",
        description: editingUser
          ? "User has been updated successfully."
          : "New user has been created successfully.",
      });
    } catch (error: unknown) {
      console.error("Error creating/updating user:", error);
      const message = error instanceof Error ? error.message : "Failed to save user";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    try {
      const mutation = `
        mutation DeleteAppUser($id: ID!) {
          deleteAppUser(id: $id)
        }
      `;

      await fetchGraphQL(mutation, { id: deletingUser.id });

      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      toast({
        title: "User deleted",
        description: "User has been deleted successfully.",
      });
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      const message = error instanceof Error ? error.message : "Failed to delete user";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      await loadData();
    }
  };

  const handleEdit = (user: AppUser) => {
    // Non-admin cannot edit admin users
    if (!isCurrentUserAdmin && user.isAdmin) {
      return;
    }
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (user: AppUser) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const mutation = `
        mutation UpdateAppUser($id: ID!, $input: UpdateAppUserInput!) {
          updateAppUser(id: $id, input: $input) {
            id
            isActive
          }
        }
      `;

      await fetchGraphQL(mutation, {
        id,
        input: { isActive },
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive } : u))
      );
      toast({
        title: isActive ? "User activated" : "User deactivated",
        description: `User has been ${isActive ? "activated" : "deactivated"} successfully.`,
      });
    } catch (error) {
      console.error("Error toggling active:", error);
      toast({
        title: "Error",
        description: "Failed to update active status",
        variant: "destructive",
      });
    }
  };

  const handleLastLoginSort = () => {
    if (sortBy === "lastLoginAt") {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortBy(null);
      }
    } else {
      setSortBy("lastLoginAt");
      setSortDirection("asc");
    }
  };

  const filteredUsers = users
    .filter((user) => {
      const matchesSearch =
        searchText === "" ||
        user.email.toLowerCase().includes(searchText.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchText.toLowerCase());

      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "lastLoginAt") {
        const dateA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const dateB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        const comparison = dateA - dateB;
        return sortDirection === "asc" ? comparison : -comparison;
      }

      // Default: sort by name
      const nameA = a.name?.toLowerCase() || "";
      const nameB = b.name?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    });

  if (isLoading) {
    return <LoadingSpinner message="Loading users..." />;
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerSection}>
        <div className={styles.titleSection}>
          <Text as="h1" size="3xl" weight="bold" tone="foreground">
            Users Management
          </Text>
          <Text tone="muted">
            Manage user accounts and roles
          </Text>
        </div>
        <Button onClick={handleAddNew} className={styles.addButton}>
          <Plus className={styles.addButtonIcon} />
          Add User
        </Button>
      </div>

      <div className={styles.searchSection}>
        <div className={styles.searchInputContainer}>
          <Search className={styles.searchIcon} />
          <Input
            type="text"
            placeholder="Search by email or name..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <Card className={styles.tableCard}>
        <CardContent className={styles.cardContent}>
          <UsersTable
            users={filteredUsers}
            currentUserId={session?.user?.id || ""}
            isCurrentUserAdmin={isCurrentUserAdmin}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onLastLoginSort={handleLastLoginSort}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleActive}
          />
        </CardContent>
      </Card>

      <UserForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleCreateOrUpdate}
        editingUser={editingUser}
        isCurrentUserAdmin={isCurrentUserAdmin}
      />

      <DeleteUserDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        userEmail={deletingUser?.email}
      />
    </div>
  );
}
