"use client";

import type { ComponentProps } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@lib/utils";

function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary-soft data-[state=unchecked]:bg-gray-200 data-[state=unchecked]:border data-[state=unchecked]:border-gray-300",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5"
        }
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
