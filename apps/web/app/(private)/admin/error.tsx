"use client";

import { useEffect } from "react";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Text } from "@components/ui/text";
import { AlertTriangle, RefreshCw } from "lucide-react";

const styles = {
  container: "flex items-center justify-center min-h-[400px] p-6",
  card: "max-w-md w-full",
  header: "text-center",
  iconWrapper: "mx-auto mb-4 h-12 w-12 text-red",
  title: "text-xl font-semibold text-steel",
  content: "text-center space-y-4",
  message: "text-dark-grey",
  button: "w-full",
  buttonIcon: "h-4 w-4 mr-2",
} as const;

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <AlertTriangle className={styles.iconWrapper} />
          <CardTitle className={styles.title}>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className={styles.content}>
          <Text tone="dark-grey" className={styles.message}>
            {error.message || "An unexpected error occurred. Please try again."}
          </Text>
          <Button onClick={reset} className={styles.button}>
            <RefreshCw className={styles.buttonIcon} />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
