"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/ui/tooltip";
import { LogOut, Key, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { ChangePasswordDialog } from "@components/auth/change-password-dialog";
import { navigation } from "@lib/navigation/config";
import { resolveIcon } from "@lib/navigation/icon-resolver";
import { cn } from "@lib/utils";

const SIDEBAR_STORAGE_KEY = "sidebar-expanded";

const styles = {
  sidebar: "hidden md:flex sticky top-0 h-screen flex-col bg-pickled-black transition-all duration-300 ease-in-out",
  sidebarCollapsed: "w-[60px]",
  sidebarExpanded: "w-60",

  header: "flex h-14 items-center border-b border-white/10 px-3 shrink-0",
  headerExpanded: "justify-between",
  headerCollapsed: "justify-center",

  logoText: "text-base font-semibold text-white truncate",

  toggleBtn: "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white transition-colors",

  nav: "flex-1 overflow-y-auto py-3 px-2 space-y-0.5",

  // Direct link item
  navItem: "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full",
  navItemActive: "bg-primary text-white hover:bg-primary hover:text-white",
  navItemCollapsed: "justify-center px-0 w-10 h-10 mx-auto",

  // Section header (items with children)
  sectionHeader: "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full cursor-pointer",
  sectionHeaderActive: "text-white",
  sectionHeaderCollapsed: "justify-center px-0 w-10 h-10 mx-auto",

  chevron: "ml-auto h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-200",
  chevronOpen: "rotate-180",

  // Child items
  childList: "mt-0.5 space-y-0.5 overflow-hidden transition-all duration-200",
  childItem: "flex items-center gap-3 rounded-lg pl-9 pr-2.5 py-1.5 text-sm text-white/50 hover:bg-white/10 hover:text-white/90 transition-colors w-full",
  childItemActive: "bg-primary text-white hover:bg-primary hover:text-white",

  icon: "h-4 w-4 shrink-0",
  toggleIcon: "h-4 w-4",
  childIcon: "h-3.5 w-3.5 shrink-0",

  // Tooltips
  tooltipSimple: "bg-steel text-white border-white/10",
  tooltipPanel: "bg-steel text-white border-white/10 p-0 w-44 [&>svg]:hidden",
  tooltipPanelInner: "py-1",
  tooltipPanelLabel: "px-3 py-1.5 text-xs font-medium text-white/40 uppercase tracking-wider",
  tooltipPanelChild: "flex items-center gap-2 px-3 py-1.5 text-sm text-white/70 hover:text-white hover:bg-white/10",
  tooltipPanelChildActive: "bg-primary text-white",
  tooltipPanelChildIcon: "h-3.5 w-3.5",

  // User area
  userArea: "shrink-0 border-t border-white/10 p-2",
  userBtn: "flex items-center gap-3 rounded-lg px-2.5 py-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full",
  userBtnCollapsed: "justify-center px-0 w-10 h-10 mx-auto",
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

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isExpanded, setIsExpanded] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const initials = getInitials(session?.user?.name);
  const isAdmin = session?.user?.isAdmin || false;
  const permissions = session?.user?.permissions || [];

  // Restore sidebar state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) setIsExpanded(stored === "true");
  }, []);

  // Auto-open sections whose child is currently active
  useEffect(() => {
    const initialOpen: Record<string, boolean> = {};
    for (const item of navigation) {
      if (item.children?.some((c) => pathname.startsWith(c.href))) {
        initialOpen[item.name] = true;
      }
    }
    setOpenSections(initialOpen);
  }, [pathname]);

  const toggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  };

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
    <TooltipProvider delayDuration={0}>
      <aside className={cn(styles.sidebar, isExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed)}>

        {/* Header */}
        <div className={cn(styles.header, isExpanded ? styles.headerExpanded : styles.headerCollapsed)}>
          {isExpanded && <span className={styles.logoText}>{process.env.NEXT_PUBLIC_APP_NAME ?? "App"}</span>}
          <button onClick={toggle} className={styles.toggleBtn} aria-label="Toggle sidebar">
            {isExpanded ? <ChevronLeft className={styles.toggleIcon} /> : <ChevronRight className={styles.toggleIcon} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {filteredNavigation.map((item) => {
            const Icon = resolveIcon(item.icon);

            // Direct link
            if (item.href) {
              const isActive = pathname === item.href;
              const linkEl = (
                <Link
                  href={item.href}
                  className={cn(
                    styles.navItem,
                    isActive && styles.navItemActive,
                    !isExpanded && styles.navItemCollapsed
                  )}
                >
                  <Icon className={styles.icon} />
                  {isExpanded && item.name}
                </Link>
              );

              if (!isExpanded) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                    <TooltipContent side="right" className={styles.tooltipSimple}>
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return <div key={item.name}>{linkEl}</div>;
            }

            // Section with children
            const isChildActive = item.children?.some((c) => pathname.startsWith(c.href));
            const isSectionOpen = openSections[item.name] ?? false;

            if (!isExpanded) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        styles.sectionHeader,
                        isChildActive && styles.sectionHeaderActive,
                        styles.sectionHeaderCollapsed
                      )}
                    >
                      <Icon className={styles.icon} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className={styles.tooltipPanel}>
                    <div className={styles.tooltipPanelInner}>
                      <p className={styles.tooltipPanelLabel}>{item.name}</p>
                      {item.children?.map((child) => {
                        const ChildIcon = resolveIcon(child.icon);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              styles.tooltipPanelChild,
                              pathname.startsWith(child.href) && styles.tooltipPanelChildActive
                            )}
                          >
                            <ChildIcon className={styles.tooltipPanelChildIcon} />
                            {child.name}
                          </Link>
                        );
                      })}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }

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

        {/* User area */}
        <div className={styles.userArea}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(styles.userBtn, !isExpanded && styles.userBtnCollapsed)}>
                <Avatar className={styles.avatar}>
                  <AvatarFallback className={styles.avatarFallback}>{initials}</AvatarFallback>
                </Avatar>
                {isExpanded && (
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{userName}</span>
                    <span className={styles.userEmail}>{userEmail}</span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className={styles.dropdownContent}>
              <DropdownMenuItem className={styles.dropdownItem} onClick={() => setChangePasswordOpen(true)}>
                <Key className={styles.dropdownIcon} />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem className={styles.dropdownItem} onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className={styles.dropdownIcon} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      </aside>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </TooltipProvider>
  );
}
