"use client";
import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";
import { Badge } from "./badge";

const statusBadgeVariants = cva("", {
  variants: {
    status: {
      // Common statuses (using custom palette)
      pending: "bg-yellow-extra-light text-yellow-darkest border-yellow-soft",
      active: "bg-primary-extra-light text-primary-dark border-primary-soft",
      processing: "bg-primary-extra-light text-primary-dark border-primary-soft",
      completed: "bg-green-extra-light text-green-darkest border-green-soft",
      closed: "bg-cloud text-dark-grey border-botticelli-grey",
      // Alert levels (using custom palette)
      success: "bg-green-extra-light text-green-darkest border-green-soft",
      warning: "bg-yellow-extra-light text-yellow-darkest border-yellow-soft",
      error: "bg-red-extra-light text-red-dark border-red-soft",
      info: "bg-primary-extra-light text-primary-dark border-primary-soft",
      neutral: "bg-fog text-dark-grey border-cloud",
    },
    size: {
      xs: "text-xs px-1.5 py-0.5",
      sm: "text-sm px-2 py-1",
      md: "text-base px-2.5 py-1",
      lg: "text-lg px-3 py-1.5",
    },
  },
  defaultVariants: {
    status: "pending",
    size: "sm", // Changed from "md" to "sm" for smaller, more compact badges
  },
});

export interface StatusBadgeProps
  extends Omit<ComponentPropsWithoutRef<typeof Badge>, "variant">,
    VariantProps<typeof statusBadgeVariants> {
  className?: string; // For edge cases and one-off overrides
}

export function StatusBadge({
  status,
  size,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(statusBadgeVariants({ status, size }), className)}
      {...props}
    />
  );
}
