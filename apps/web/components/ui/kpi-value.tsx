"use client";
import type { ComponentPropsWithoutRef, JSX } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";

const kpiValueVariants = cva("", {
  variants: {
    tone: {
      inherit: "",
      primary: "text-primary",
      "primary-dark": "text-primary-dark",
      yellow: "text-yellow-dark",
      red: "text-red",
      steel: "text-steel",
    },
    size: {
      inherit: "",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
      "4xl": "text-4xl",
      "5xl": "text-5xl",
      "6xl": "text-6xl",
    },
    weight: {
      normal: "",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    tone: "inherit",
    size: "inherit",
    weight: "normal",
  },
});

export interface KpiValueProps
  extends ComponentPropsWithoutRef<"div">,
    VariantProps<typeof kpiValueVariants> {
  className?: string; // escape hatch
  as?: keyof JSX.IntrinsicElements;
}

export function KpiValue({
  as = "div",
  tone,
  size,
  weight,
  className,
  ...props
}: KpiValueProps) {
  const Comp = as as any;
  return (
    <Comp
      className={cn(kpiValueVariants({ tone, size, weight }), className)}
      {...props}
    />
  );
}
