# UI Components Guide

## CVA Wrappers

This guide documents wrapper components with CVA (class-variance-authority) for maintaining consistent and reusable styles.

### Text

For any text that needs consistent styling.

**Props:**

- `size`: xs, sm, md, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl
- `tone`: inherit, gray900, gray600, gray500, foreground, muted, destructive, blue600, purple600, amber600, red600
- `weight`: normal, medium, semibold, bold
- `transform`: none, caps, upper, lower
- `align`: inherit, left, center, right
- `wrap`: normal, nowrap
- `as`: HTML element (div, p, span, h1, etc.)

**Example:**

```tsx
<Text size="lg" weight="bold" tone="gray900">Title</Text>
<Text as="p" size="md" tone="muted">Description</Text>
```

---

### TableHeaderCell

For table headers with consistent styling.

**Props:**

- `weight`: normal, medium, semibold, bold
- `tone`: inherit, gray900, foreground, muted, destructive
- `size`: inherit, xs, sm, md, lg, xl
- `textAlign`: inherit, left, center, right

**Example:**

```tsx
<TableHeaderCell weight="semibold" tone="gray900" size="lg">
  Column Name
</TableHeaderCell>
```

---

### TableCellText

For table cell content.

**Props:**

- `tone`: inherit, gray900, gray600, purple600, red600, amber600, blue600
- `size`: inherit, sm, md, lg
- `weight`: normal, medium, semibold, bold
- `transform`: none, caps
- `emphasis`: normal, priority

**Example:**

```tsx
<TableCell>
  <TableCellText tone="purple600" weight="medium" size="lg">
    Value
  </TableCellText>
</TableCell>
```

---

### KpiValue

For large numeric values (metrics).

**Props:**

- `size`: inherit, 2xl, 3xl, 4xl, 5xl, 6xl
- `tone`: inherit, blue600, purple600, amber600, red600, gray900
- `weight`: normal, medium, semibold, bold
- `as`: HTML element (div, span, etc.)

**Example:**

```tsx
<KpiValue size="6xl" weight="bold" tone="blue600">
  {count}
</KpiValue>
```

---

### StatusBadge

For status badges with predefined colors.

**Props:**

- `status`: arrived, receiving, pending, closed, priority
- `size`: sm, md, lg

**Example:**

```tsx
<StatusBadge status="arrived" size="md">Arrived</StatusBadge>
<StatusBadge status="priority" size="sm">PRIORITY</StatusBadge>
```

---

### MetricCard

For metric cards (KPI cards).

**Props:**

- `title`: string - Card title
- `value`: number | string - Value to display
- `description`: string - Description below the value
- `icon`: React.ComponentType - Icon component
- `tone`: blue, purple, amber, red

**Example:**

```tsx
<MetricCard
  title="Arrived"
  value={stats.arrived}
  description="Ready to receive"
  icon={Package}
  tone="blue"
/>
```

---

### IconWrapper

For icons with consistent sizes and colors.

**Props:**

- `size`: xs (h-4 w-4), sm (h-6 w-6), md (h-8 w-8), lg (h-12 w-12)
- `tone`: inherit, blue600, purple600, amber600, red600, gray600
- `icon`: React.ComponentType - Icon component

**Example:**

```tsx
<IconWrapper icon={Package} size="md" tone="blue600" />
```

---

### NavButton

For navigation buttons with active state styling (used in Sidebar).

**Props:**

- `active`: boolean - Whether the navigation item is currently active
- Extends all Button props from shadcn/ui

**Example:**

```tsx
<NavButton active={pathname === "/dashboard"}>
  <LayoutDashboard className="h-4 w-4 mr-2" />
  Dashboard
</NavButton>
```

---

## Style Constants Pattern

When CVA is not suitable (layout utilities, one-off styles), extract to named constants:

```tsx
// Style constants at top of file
const styles = {
  pageContainer: "p-6 space-y-6",
  responsiveGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
  tableFullWidth: "w-full",
} as const;

// Use in JSX
<div className={styles.pageContainer}>
  <div className={styles.responsiveGrid}>{/* Content */}</div>
</div>;
```

**Use constants for:**

- Layout classes (grid, flex, padding)
- Table column widths
- Positioning styles
- shadcn/ui overrides
- Styles only used in one file

---

## Adding New Variants

1. **Identify repeated pattern** (3+ uses of the same class set)
2. **Create wrapper** in `components/ui/[name].tsx`
3. **Use standard CVA template**:

```typescript
"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";

const variants = cva("", {
  variants: {
    tone: { inherit: "", primary: "...", secondary: "..." },
    size: { inherit: "", sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { tone: "inherit", size: "inherit" },
});

export interface Props
  extends React.ComponentPropsWithoutRef<"div">,
  VariantProps<typeof variants> {
  className?: string; // For edge cases and one-off overrides
}

export function Component({ tone, size, className, ...props }: Props) {
  return <div className={cn(variants({ tone, size }), className)} {...props} />;
}
```

4. **Add to this documentation**
5. **Migrate existing uses**

---

## Design Principles

### Neutral Defaults

Default variants should NOT introduce styles (base = `""`). This preserves appearance when no props are specified.

### 1:1 Mapping

Map existing Tailwind classes to variants directly:

- `text-gray-900` → `tone="gray900"`
- `text-lg` → `size="lg"`
- `font-semibold` → `weight="semibold"`

### Composition

Prefer composition over inheritance. Wrappers should be composable:

```tsx
<TableCell>
  <TableCellText weight="medium" tone="purple600">
    {value}
  </TableCellText>
</TableCell>
```

---

## Resources

- [CVA Documentation](https://cva.style/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

---

## Variant Changelog

### Version 2.0 - Extended Variants (2025-01-27)

#### Text Component

**New variants added:**

- `tone`: green600, cyan600, orange600, primary, secondary
- `weight`: light, extrabold
- `align`: justify
- `wrap`: prewrap, break
- `decoration`: underline, linethrough (new prop)
- `italic`: true/false (new prop)

**Usage:**

```tsx
<Text decoration="underline" italic={true} tone="blue600">
  Styled link
</Text>
```

#### StatusBadge Component

**New status variants:**

- `success`: Green for successful operations
- `warning`: Orange for warnings
- `error`: Red for errors
- `info`: Cyan for information
- `neutral`: Neutral gray

**Improved sizes:**

- Now include padding: `xs`, `sm`, `md`, `lg`

**Usage:**

```tsx
<StatusBadge status="success" size="md">Completed</StatusBadge>
<StatusBadge status="warning" size="sm">Pending</StatusBadge>
```

### Benefits of New Variants

1. **Greater Flexibility**: More options for different contexts
2. **Consistency**: Standardized colors and styles
3. **Scalability**: Easy to add new use cases
4. **Type Safety**: All variants are typed

### Suggested Future Variants

If you need to add more variants in the future, consider:

- **Text**: `tracking` (letter-spacing), `leading` (line-height)
- **StatusBadge**: `variant` (solid, outline, ghost)
- **MetricCard**: `orientation` (horizontal, vertical)
- **TableCellText**: `truncate` (for long text)
