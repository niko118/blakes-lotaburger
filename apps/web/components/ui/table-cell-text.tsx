"use client";
import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";

const tableCellTextVariants = cva("", {
  variants: {
    tone: {
      inherit: "",
      steel: "text-steel",
      "dark-grey": "text-dark-grey",
      silver: "text-silver",
      rain: "text-rain",
      primary: "text-primary",
      red: "text-red",
      yellow: "text-yellow-dark",
    },
    size: {
      inherit: "",
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
    weight: {
      normal: "",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    transform: {
      none: "",
      caps: "capitalize",
    },
    emphasis: {
      normal: "",
      priority: "font-semibold",
    },
    truncate: {
      false: "",
      true: "block truncate",
    },
  },
  defaultVariants: {
    tone: "inherit",
    size: "inherit",
    weight: "normal",
    transform: "none",
    emphasis: "normal",
    truncate: false,
  },
});

export interface TableCellTextProps
  extends ComponentPropsWithoutRef<"span">,
    VariantProps<typeof tableCellTextVariants> {
  className?: string; // For edge cases and one-off overrides
}

export function TableCellText({
  tone,
  size,
  weight,
  transform,
  emphasis,
  truncate,
  className,
  ...props
}: TableCellTextProps) {
  return (
    <span
      className={cn(
        tableCellTextVariants({ tone, size, weight, transform, emphasis, truncate }),
        className
      )}
      {...props}
    />
  );
}
