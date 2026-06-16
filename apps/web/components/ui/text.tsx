"use client";
import type { ComponentPropsWithoutRef, JSX } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";

const textVariants = cva("", {
  variants: {
    tone: {
      inherit: "",
      // Custom palette colors (text grays)
      steel: "text-steel",
      "dark-grey": "text-dark-grey",
      silver: "text-silver",
      rain: "text-rain",
      // Custom palette colors (semantic)
      primary: "text-primary",
      "primary-dark": "text-primary-dark",
      "primary-soft": "text-primary-soft",
      secondary: "text-secondary",
      destructive: "text-destructive",
      // Custom palette colors (status)
      red: "text-red",
      "red-dark": "text-red-dark",
      green: "text-green-dark",
      yellow: "text-yellow-dark",
      // Theme colors
      foreground: "text-foreground",
      muted: "text-muted-foreground",
    },
    size: {
      inherit: "",
      xs: "text-xs",
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
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
      // Additional weights
      light: "font-light",
      extrabold: "font-extrabold",
    },
    transform: {
      none: "",
      caps: "capitalize",
      upper: "uppercase",
      lower: "lowercase",
    },
    align: {
      inherit: "",
      left: "text-left",
      center: "text-center",
      right: "text-right",
      justify: "text-justify",
    },
    wrap: {
      normal: "",
      nowrap: "whitespace-nowrap",
      prewrap: "whitespace-pre-wrap",
      break: "break-words",
    },
    decoration: {
      none: "",
      underline: "underline",
      linethrough: "line-through",
    },
    italic: {
      false: "",
      true: "italic",
    },
  },
  defaultVariants: {
    tone: "inherit",
    size: "inherit",
    weight: "normal",
    transform: "none",
    align: "inherit",
    wrap: "normal",
    decoration: "none",
    italic: false,
  },
});

export interface TextProps
  extends ComponentPropsWithoutRef<"div">,
    VariantProps<typeof textVariants> {
  className?: string; // escape hatch
  as?: keyof JSX.IntrinsicElements;
}

export function Text({
  as = "div",
  tone,
  size,
  weight,
  transform,
  align,
  wrap,
  decoration,
  italic,
  className,
  ...props
}: TextProps) {
  const Comp = as as any;
  return (
    <Comp
      className={cn(
        textVariants({
          tone,
          size,
          weight,
          transform,
          align,
          wrap,
          decoration,
          italic,
        }),
        className
      )}
      {...props}
    />
  );
}
