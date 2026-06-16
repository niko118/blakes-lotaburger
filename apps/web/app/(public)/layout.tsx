import type React from "react";

// Style constants
const styles = {
  main: "min-h-screen",
} as const;

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main className={styles.main}>{children}</main>;
}
