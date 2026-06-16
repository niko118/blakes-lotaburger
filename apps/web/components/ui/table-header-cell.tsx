"use client";
import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";
import { TableHead } from "./table";

const tableHeaderCellVariants = cva("", {
  variants: {
    tone: {
      inherit: "",
      steel: "text-steel",
      darkGrey: "text-dark-grey",
      silver: "text-silver",
      rain: "text-rain",
      gray900: "text-gray-900",
      foreground: "text-foreground",
      muted: "text-muted-foreground",
      destructive: "text-destructive",
    },
    size: {
      inherit: "",
      xs: "text-xs",
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    },
    weight: {
      normal: "",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    textAlign: {
      inherit: "",
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    tone: "inherit",
    size: "inherit",
    weight: "normal",
    textAlign: "inherit",
  },
});

export interface TableHeaderCellProps
  extends ComponentPropsWithoutRef<typeof TableHead>,
    VariantProps<typeof tableHeaderCellVariants> {
  className?: string; // escape hatch
}

export function TableHeaderCell({
  tone,
  size,
  weight,
  textAlign,
  className,
  ...props
}: TableHeaderCellProps) {
  return (
    <TableHead
      className={cn(
        tableHeaderCellVariants({ tone, size, weight, textAlign }),
        className
      )}
      {...props}
    />
  );
}
