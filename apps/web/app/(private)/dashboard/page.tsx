import { getServerSession } from "@lib/auth/session";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Button } from "@components/ui/button";
import Link from "next/link";
import { Users, Shield, Settings } from "lucide-react";

const styles = {
  pageContainer: "space-y-8",
  header: "pb-2",
  title: "text-3xl font-bold text-steel tracking-tight",
  subtitle: "text-dark-grey mt-2 text-lg",
  cardGrid: "grid gap-6 md:grid-cols-2 lg:grid-cols-3",
  welcomeCard:
    "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20",
  welcomeCardTitle: "text-steel",
  welcomeCardSubtitle: "text-dark-grey",
  cardDescription: "text-sm text-dark-grey leading-relaxed",
  adminCard: "bg-white",
  cardTitleWithIcon: "flex items-center justify-between",
  cardTitleSmall: "text-base font-semibold text-steel",
  cardIcon: "h-5 w-5 text-primary",
  cardText: "text-sm text-dark-grey mb-4 leading-relaxed",
  sessionCard: "bg-white",
  sessionTitle: "flex items-center gap-2 text-steel",
  sessionIcon: "h-5 w-5 text-primary",
  infoGrid: "grid gap-1 text-sm",
  infoRow: "flex justify-between py-2 border-b border-cloud last:border-0",
  infoLabel: "text-silver",
  infoValue: "font-medium text-steel",
} as const;

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const { user } = session;
  const isAdmin = user.isAdmin;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome, {user.name || user.email}</h1>
        <p className={styles.subtitle}>
          {isAdmin
            ? "You have administrator access to this application."
            : `Role: ${user.roleName || "No role assigned"}`}
        </p>
      </div>

      <div className={styles.cardGrid}>
        {/* Quick Stats Card */}
        <Card className={styles.welcomeCard}>
          <CardHeader>
            <CardTitle className={styles.welcomeCardTitle}>Getting Started</CardTitle>
            <CardDescription className={styles.welcomeCardSubtitle}>
              This is your dashboard. Customize it to fit your needs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={styles.cardDescription}>
              Start building your application by adding new features and pages.
            </p>
          </CardContent>
        </Card>

        {/* Admin Section - Only visible to admins */}
        {isAdmin && (
          <>
            <Card className={styles.adminCard}>
              <CardHeader>
                <div className={styles.cardTitleWithIcon}>
                  <CardTitle className={styles.cardTitleSmall}>
                    User Management
                  </CardTitle>
                  <Users className={styles.cardIcon} />
                </div>
              </CardHeader>
              <CardContent>
                <p className={styles.cardText}>
                  Manage users, assign roles, and control access.
                </p>
                <Button asChild size="sm">
                  <Link href="/admin/users">Manage Users</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className={styles.adminCard}>
              <CardHeader>
                <div className={styles.cardTitleWithIcon}>
                  <CardTitle className={styles.cardTitleSmall}>
                    Role Management
                  </CardTitle>
                  <Shield className={styles.cardIcon} />
                </div>
              </CardHeader>
              <CardContent>
                <p className={styles.cardText}>
                  Create and manage roles with custom permissions.
                </p>
                <Button asChild size="sm">
                  <Link href="/admin/roles">Manage Roles</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Session Info */}
      <Card className={styles.sessionCard}>
        <CardHeader>
          <CardTitle className={styles.sessionTitle}>
            <Settings className={styles.sessionIcon} />
            Session Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Admin</span>
              <span className={styles.infoValue}>{isAdmin ? "Yes" : "No"}</span>
            </div>
            {user.roleName && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Role</span>
                <span className={styles.infoValue}>{user.roleName}</span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Session expires in</span>
              <span className={styles.infoValue}>{session.maxAgeHours} hours</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
