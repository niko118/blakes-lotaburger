"use client";

import Link from "next/link";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Text } from "@components/ui/text";
import { ShieldAlert } from "lucide-react";

const styles = {
  pageContainer: "flex items-center justify-center min-h-screen p-6 bg-fog",
  cardMaxWidth: "max-w-md w-full",
  cardColors: "bg-white border-cloud shadow-lg",
  cardPadding: "p-8",
  headerCenter: "text-center pt-8 px-8",
  iconContainer: "flex justify-center mb-6",
  iconCircle: "p-4 bg-red-extra-light rounded-full",
  iconColor: "h-12 w-12 text-red",
  contentCenter: "text-center space-y-8",
  textContainer: "space-y-4",
  buttonFullWidth: "w-full",
} as const;

export default function PermissionDeniedPage() {
  return (
    <div className={styles.pageContainer}>
      <Card className={`${styles.cardMaxWidth} ${styles.cardColors}`}>
        <CardHeader className={styles.headerCenter}>
          <div className={styles.iconContainer}>
            <div className={styles.iconCircle}>
              <ShieldAlert className={styles.iconColor} />
            </div>
          </div>
          <CardTitle>
            <Text as="h1" size="2xl" weight="bold" tone="steel">
              Permission Denied
            </Text>
          </CardTitle>
        </CardHeader>
        <CardContent
          className={`${styles.cardPadding} ${styles.contentCenter}`}
        >
          <div className={styles.textContainer}>
            <Text tone="dark-grey" size="md">
              You don&apos;t have permission to access this page. Please contact
              your manager if you need access to this resource.
            </Text>
          </div>
          <Link href="/dashboard">
            <Button className={styles.buttonFullWidth}>Go to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
