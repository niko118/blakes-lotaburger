"use client";

import { Text } from "@components/ui/text";

const styles = {
  loadingContainer: "p-6 flex items-center justify-center h-screen",
  loadingContent: "text-center",
  spinner:
    "animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4",
} as const;

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({
  message = "Loading...",
}: LoadingSpinnerProps) {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingContent}>
        <div className={styles.spinner}></div>
        <Text as="p" tone="dark-grey">
          {message}
        </Text>
      </div>
    </div>
  );
}
