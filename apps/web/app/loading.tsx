import { Text } from "@components/ui/text";

// Style constants
const styles = {
  container: "flex flex-col items-center justify-center min-h-screen gap-4",
  spinner:
    "animate-spin rounded-full h-12 w-12 border-b-2 border-steel dark:border-cloud",
} as const;

export default function Loading() {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} />
      <Text tone="dark-grey" size="lg" weight="medium">
        Loading
      </Text>
    </div>
  );
}
