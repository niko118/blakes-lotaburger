"use client";
import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";
import { Table } from "@components/ui/table";

const dataTableVariants = cva("w-full", {
  variants: {
    layout: {
      fixed: "table-fixed",
      auto: "table-auto",
    },
  },
  defaultVariants: {
    layout: "auto",
  },
});

const dataTableWrapperVariants = cva("bg-white", {
  variants: {
    wrapper: {
      true: "border border-gray-200 rounded-md overflow-hidden",
      false: "",
    },
  },
  defaultVariants: {
    wrapper: false,
  },
});

export const dataTableHeaderVariants = cva(
  "bg-gray-50 border-b border-gray-200"
);

export const dataTableRowVariants = cva(
  "hover:bg-gray-50 border-b border-gray-100",
  {
    variants: {
      transition: {
        none: "",
        add: "bg-indigo-100 shadow-lg border-l-4 border-indigo-500 transition-all duration-500",
        remove:
          "bg-indigo-100 shadow-lg border-l-4 border-indigo-500 transition-all duration-500",
      },
    },
    defaultVariants: {
      transition: "none",
    },
  }
);

interface DataTableProps extends VariantProps<typeof dataTableVariants> {
  children: ReactNode;
  className?: string;
  wrapper?: boolean;
  title?: string;
  titleAction?: ReactNode;
  scrollable?: boolean;
}

export function DataTable({
  layout,
  wrapper = false,
  title,
  titleAction,
  className,
  children,
  scrollable = false,
}: DataTableProps) {
  const content = (
    <Table className={cn(dataTableVariants({ layout }), className)}>
      {children}
    </Table>
  );

  if (title) {
    return (
      <div className={cn("bg-white border border-gray-200 rounded-md", scrollable && "overflow-hidden")}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {titleAction && <div>{titleAction}</div>}
        </div>
        <div className={scrollable ? "overflow-x-auto" : ""}>{content}</div>
      </div>
    );
  }

  return <div className={dataTableWrapperVariants({ wrapper })}>{content}</div>;
}
