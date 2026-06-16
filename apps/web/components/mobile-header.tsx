"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { signOut, useSession } from "next-auth/react";
import { Menu, ChevronDown, LogOut, Key } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@components/ui/sheet";
import { Avatar, AvatarFallback } from "@components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { ChangePasswordDialog } from "@components/auth/change-password-dialog";
import { navigation } from "@lib/navigation/config";
import { resolveIcon } from "@lib/navigation/icon-resolver";
import { cn } from "@lib/utils";

const styles = {
  header: "sticky top-0 z-40 flex md:hidden h-14 items-center gap-3 border-b border-white/10 bg-pickled-black px-4 shrink-0",
  menuBtn: "flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white transition-colors",
  menuIcon: "h-5 w-5",
  title: "text-base font-semibold text-white",

  sheetContent: "bg-pickled-black border-white/10 p-0 flex flex-col w-64",
  sheetTitleHidden: "sr-only",
  sheetInnerHeader: "flex h-14 items-center border-b border-white/10 px-4 shrink-0",
  sheetTitle: "text-base font-semibold text-white",

  nav: "flex-1 overflow-y-auto py-3 px-2 space-y-0.5",
  navItem: "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full",
  navItemActive: "bg-primary text-white hover:bg-primary hover:text-white",
  sectionHeader: "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full cursor-pointer",
  sectionHeaderActive: "text-white",
  chevron: "ml-auto h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-200",
  chevronOpen: "rotate-180",
  childList: "mt-0.5 space-y-0.5",
  childItem: "flex items-center gap-3 rounded-lg pl-9 pr-2.5 py-1.5 text-sm text-white/50 hover:bg-white/10 hover:text-white/90 transition-colors w-full",
  childItemActive: "bg-primary text-white hover:bg-primary hover:text-white",
  icon: "h-4 w-4 shrink-0",
  childIcon: "h-3.5 w-3.5 shrink-0",

  userArea: "shrink-0 border-t border-white/10 p-2",
  userBtn: "flex items-center gap-3 rounded-lg px-2.5 py-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full",
  avatar: "h-7 w-7 shrink-0",
  avatarFallback: "bg-primary/30 text-primary-soft text-xs",
  userInfo: "flex-1 min-w-0 text-left",
  userName: "text-sm font-medium text-white truncate block",
  userEmail: "text-xs text-white/40 truncate block",
  dropdownContent: "w-52 bg-pickled-black border-white/10 text-white",
  dropdownItem: "text-white/70 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer",
  dropdownIcon: "h-4 w-4 mr-2",
} as const;

const getInitials = (name: string | null | undefined): string => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export function MobileHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const initials = getInitials(session?.user?.name);
  const isAdmin = session?.user?.isAdmin || false;
  const permissions = session?.user?.permissions || [];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const initialOpen: Record<string, boolean> = {};
    for (const item of navigation) {
      if (item.children?.some((c) => pathname.startsWith(c.href))) {
        initialOpen[item.name] = true;
      }
    }
    setOpenSections(initialOpen);
  }, [pathname]);

  const toggleSection = (name: string) => {
    setOpenSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const filteredNavigation = useMemo(() => {
    return navigation
      .filter((item) => {
        if (item.adminOnly) return isAdmin;
        return true;
      })
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => {
          if (isAdmin) return true;
          if (!child.requiredPermission) return true;
          return permissions.includes(child.requiredPermission);
        }),
      }))
      .filter((item) => item.href || (item.children && item.children.length > 0));
  }, [isAdmin, permissions]);

  return (
    <>
      <header className={styles.header}>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className={styles.menuBtn} aria-label="Open menu">
              <Menu className={styles.menuIcon} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className={styles.sheetContent}>
            <SheetTitle className={styles.sheetTitleHidden}>Navigation</SheetTitle>
            <div className={styles.sheetInnerHeader}>
              <span className={styles.sheetTitle}>{process.env.NEXT_PUBLIC_APP_NAME ?? "App"}</span>
            </div>

            <nav className={styles.nav}>
              {filteredNavigation.map((item) => {
                const Icon = resolveIcon(item.icon);

                if (item.href) {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(styles.navItem, isActive && styles.navItemActive)}
                    >
                      <Icon className={styles.icon} />
                      {item.name}
                    </Link>
                  );
                }

                const isChildActive = item.children?.some((c) => pathname.startsWith(c.href));
                const isSectionOpen = openSections[item.name] ?? false;

                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleSection(item.name)}
                      className={cn(styles.sectionHeader, isChildActive && styles.sectionHeaderActive)}
                    >
                      <Icon className={styles.icon} />
                      {item.name}
                      <ChevronDown className={cn(styles.chevron, isSectionOpen && styles.chevronOpen)} />
                    </button>
                    {isSectionOpen && (
                      <div className={styles.childList}>
                        {item.children?.map((child) => {
                          const ChildIcon = resolveIcon(child.icon);
                          const isActive = pathname.startsWith(child.href);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(styles.childItem, isActive && styles.childItemActive)}
                            >
                              <ChildIcon className={styles.childIcon} />
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className={styles.userArea}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={styles.userBtn}>
                    <Avatar className={styles.avatar}>
                      <AvatarFallback className={styles.avatarFallback}>{initials}</AvatarFallback>
                    </Avatar>
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{userName}</span>
                      <span className={styles.userEmail}>{userEmail}</span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className={styles.dropdownContent}>
                  <DropdownMenuItem
                    className={styles.dropdownItem}
                    onClick={() => setChangePasswordOpen(true)}
                  >
                    <Key className={styles.dropdownIcon} />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={styles.dropdownItem}
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className={styles.dropdownIcon} />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetContent>
        </Sheet>
        <span className={styles.title}>{process.env.NEXT_PUBLIC_APP_NAME ?? "App"}</span>
      </header>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
}
