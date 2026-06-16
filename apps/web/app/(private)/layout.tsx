import type React from "react";
import { Sidebar } from "@components/sidebar";
import { MobileHeader } from "@components/mobile-header";

const styles = {
  container: "flex min-h-screen",
  rightColumn: "flex flex-1 flex-col min-w-0",
  main: "flex-1 bg-fog p-6 lg:p-8",
} as const;

export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.rightColumn}>
        <MobileHeader />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
