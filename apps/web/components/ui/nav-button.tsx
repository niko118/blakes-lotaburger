"use client";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";
import { Button } from "./button";

const navButtonVariants = cva(
  "w-full justify-start text-gray-700 hover:bg-indigo-50 hover:text-indigo-700",
  {
    variants: {
      active: {
        true: "bg-indigo-100 text-indigo-700",
        false: "",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export interface NavButtonProps
  extends ComponentPropsWithoutRef<typeof Button>,
    VariantProps<typeof navButtonVariants> {
  className?: string;
}

export const NavButton = forwardRef<HTMLButtonElement, NavButtonProps>(
  ({ active, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        className={cn(navButtonVariants({ active }), className)}
        {...props}
      />
    );
  }
);
NavButton.displayName = "NavButton";
