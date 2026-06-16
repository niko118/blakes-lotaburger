"use client";
import type { ComponentPropsWithoutRef, ComponentType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";

const iconWrapperVariants = cva("", {
  variants: {
    size: {
      xs: "h-4 w-4",
      sm: "h-6 w-6",
      md: "h-8 w-8",
      lg: "h-12 w-12",
    },
    tone: {
      inherit: "",
      primary: "text-primary",
      "primary-dark": "text-primary-dark",
      yellow: "text-yellow-dark",
      red: "text-red",
      "dark-grey": "text-dark-grey",
    },
  },
  defaultVariants: {
    size: "md",
    tone: "inherit",
  },
});

export interface IconWrapperProps
  extends ComponentPropsWithoutRef<"div">,
    VariantProps<typeof iconWrapperVariants> {
  className?: string; // For edge cases and one-off overrides
  icon: ComponentType<{ className?: string }>;
}

export function IconWrapper({
  size,
  tone,
  icon: Icon,
  className,
  ...props
}: IconWrapperProps) {
  return (
    <Icon
      className={cn(iconWrapperVariants({ size, tone }), className)}
      {...props}
    />
  );
}
