# CVA Pattern Guide for New Components

## 📚 Introduction

This guide documents the standard pattern for creating UI components with CVA (class-variance-authority) in this project.

---

## 🎯 When to Create a CVA Component

### Decision Criteria

✅ **YES, create a CVA wrapper when:**

- The same set of classes repeats **3+ times**
- The component has **semantic meaning** (StatusBadge, MetricCard, etc.)
- You need **multiple variations** of the same pattern (sizes, colors, states)
- You want to **centralize styles** for easier future changes

❌ **NO, don't create a CVA wrapper when:**

- It's a unique case that won't be repeated
- It's context-specific layout (grid, flex) that changes by context
- A shadcn/ui component already does the same thing
- It's a simple utility class (use style constants instead)

---

## 🔧 When NOT to Create CVA Components

### Use Style Constants Instead

Layout utilities and one-off styles should be extracted to named constants, NOT CVA:

**Layout & Positioning:**

```typescript
const styles = {
  pageContainer: "p-6 space-y-6",
  responsiveGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
  flexContainer: "flex gap-4 items-center",
  tableFullWidth: "w-full",
} as const;
```

**Why:**

- Layout is context-dependent
- No variants needed
- More overhead than value
- Constants are clear and simple

### CVA vs Constants Decision Tree

Use **CVA** if:

- ✅ Has semantic meaning (Button, Badge, Text)
- ✅ Needs variants (sizes, colors, states)
- ✅ Used across multiple files
- ✅ Complex combinations

Use **Constants** if:

- ✅ Layout utilities (grid, flex, padding)
- ✅ Only used in one file
- ✅ No variants needed
- ✅ Simple one-off styles

---

## 📋 Standard Template

### File Structure

```typescript
// apps/web/components/ui/[component-name].tsx
"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";

// 1. DEFINE VARIANTS
const componentVariants = cva("", {
  variants: {
    // Use semantic names, not technical
    tone: {
      inherit: "",
      primary: "text-primary",
      secondary: "text-secondary",
      destructive: "text-destructive",
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
  },
  defaultVariants: {
    tone: "inherit",
    size: "inherit",
    weight: "normal",
  },
});

// 2. DEFINE INTERFACE
export interface ComponentProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof componentVariants> {
  className?: string; // For edge cases and one-off overrides
}

// 3. EXPORT COMPONENT
export function Component({
  tone,
  size,
  weight,
  className,
  ...props
}: ComponentProps) {
  return (
    <div
      className={cn(componentVariants({ tone, size, weight }), className)}
      {...props}
    />
  );
}
```

---

## 🔧 Implementation Rules

### 1. Empty Base

**Always** use `""` as the base to avoid introducing default styles:

```typescript
const variants = cva("", {
  // ✅ Empty base
  variants: {
    /* ... */
  },
});

// ❌ INCORRECT
const variants = cva("text-base font-normal", {
  // Introduces default styles
  variants: {
    /* ... */
  },
});
```

### 2. Neutral Defaults

`defaultVariants` should be `"inherit"` or values that don't change appearance:

```typescript
defaultVariants: {
  tone: "inherit",     // ✅ Changes nothing
  size: "inherit",     // ✅ Changes nothing
  weight: "normal",    // ✅ Browser default value
}

// ❌ INCORRECT
defaultVariants: {
  tone: "primary",     // Changes default color
  size: "lg",          // Changes default size
}
```

### 3. Semantic Names

Use names that describe **what it is**, not **how it looks**:

```typescript
// ✅ CORRECT - Semantic
tone: {
  primary: "text-primary",
  destructive: "text-destructive",
  success: "text-green-600",
}

// ❌ INCORRECT - Technical
tone: {
  blue: "text-blue-600",
  red: "text-red-600",
  green: "text-green-600",
}
```

### 4. Mandatory Escape Hatch

**Always** include `className?: string` for edge cases:

```typescript
export interface Props
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof variants> {
  className?: string; // For edge cases and one-off overrides
}
```

---

## 📝 Examples by Component Type

### Example 1: Text Component

```typescript
// apps/web/components/ui/heading.tsx
"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";

const headingVariants = cva("", {
  variants: {
    level: {
      h1: "text-5xl",
      h2: "text-4xl",
      h3: "text-3xl",
      h4: "text-2xl",
      h5: "text-xl",
      h6: "text-lg",
    },
    weight: {
      normal: "",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    tone: {
      inherit: "",
      foreground: "text-foreground",
      muted: "text-muted-foreground",
      primary: "text-primary",
    },
  },
  defaultVariants: {
    level: "h2",
    weight: "bold",
    tone: "foreground",
  },
});

export interface HeadingProps
  extends React.ComponentPropsWithoutRef<"h1">,
    VariantProps<typeof headingVariants> {
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function Heading({
  level,
  weight,
  tone,
  as,
  className,
  ...props
}: HeadingProps) {
  const Comp = (as || level || "h2") as any;
  return (
    <Comp
      className={cn(headingVariants({ level, weight, tone }), className)}
      {...props}
    />
  );
}
```

**Usage:**

```tsx
<Heading level="h1" weight="bold" tone="foreground">
  Page Title
</Heading>
```

### Example 2: State Component

```typescript
// apps/web/components/ui/alert-badge.tsx
"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";
import { Badge } from "./badge";

const alertBadgeVariants = cva("", {
  variants: {
    severity: {
      info: "bg-blue-100 text-blue-700 border-blue-300",
      success: "bg-green-100 text-green-700 border-green-300",
      warning: "bg-amber-100 text-amber-700 border-amber-300",
      error: "bg-red-100 text-red-700 border-red-300",
    },
    size: {
      sm: "text-xs px-2 py-1",
      md: "text-sm px-2.5 py-1",
      lg: "text-base px-3 py-1.5",
    },
  },
  defaultVariants: {
    severity: "info",
    size: "md",
  },
});

export interface AlertBadgeProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Badge>, "variant">,
    VariantProps<typeof alertBadgeVariants> {
  className?: string;
}

export function AlertBadge({
  severity,
  size,
  className,
  ...props
}: AlertBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(alertBadgeVariants({ severity, size }), className)}
      {...props}
    />
  );
}
```

**Usage:**

```tsx
<AlertBadge severity="warning" size="md">
  Pending Review
</AlertBadge>
```

### Example 3: Composite Component

```typescript
// apps/web/components/ui/info-card.tsx
"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "./card";
import { LucideIcon } from "lucide-react";

const infoCardVariants = cva("", {
  variants: {
    tone: {
      blue: "border-blue-200 bg-blue-50",
      purple: "border-purple-200 bg-purple-50",
      amber: "border-amber-200 bg-amber-50",
      red: "border-red-200 bg-red-50",
      green: "border-green-200 bg-green-50",
    },
  },
  defaultVariants: {
    tone: "blue",
  },
});

export interface InfoCardProps
  extends React.ComponentPropsWithoutRef<typeof Card>,
    VariantProps<typeof infoCardVariants> {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}

export function InfoCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
  className,
  ...props
}: InfoCardProps) {
  const styles = {
    header: "flex flex-row items-center justify-between pb-2",
    title: "text-sm font-medium",
    icon: "h-4 w-4 text-muted-foreground",
    value: "text-2xl font-bold",
    description: "text-xs text-muted-foreground mt-1",
  } as const;

  return (
    <Card
      className={cn(infoCardVariants({ tone }), className)}
      {...props}
    >
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>
          {title}
        </CardTitle>
        {Icon && <Icon className={styles.icon} />}
      </CardHeader>
      <CardContent>
        <div className={styles.value}>{value}</div>
        {description && (
          <p className={styles.description}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Usage:**

```tsx
<InfoCard
  title="Total Orders"
  value={245}
  description="Last 30 days"
  icon={Package}
  tone="blue"
/>
```

---

## 🎨 Recommended Common Variants

### Tone/Color (`tone`)

```typescript
tone: {
  inherit: "",
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  destructive: "text-destructive",
  // Specific colors
  gray900: "text-gray-900",
  blue600: "text-blue-600",
  purple600: "text-purple-600",
  amber600: "text-amber-600",
  red600: "text-red-600",
  green600: "text-green-600",
}
```

### Size (`size`)

```typescript
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
}
```

### Weight (`weight`)

```typescript
weight: {
  normal: "",
  light: "font-light",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
}
```

### Transform (`transform`)

```typescript
transform: {
  none: "",
  caps: "capitalize",
  upper: "uppercase",
  lower: "lowercase",
}
```

### Alignment (`align`)

```typescript
align: {
  inherit: "",
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
}
```

---

## ✅ Quality Checklist

Before considering a CVA component complete, verify:

- [ ] CVA base is `""` (empty)
- [ ] Defaults are `"inherit"` or neutral
- [ ] Variant names are semantic
- [ ] Interface includes `className?: string`
- [ ] Component uses `cn()` helper
- [ ] Props are typed with `VariantProps`
- [ ] Component is documented in README
- [ ] Usage examples included
- [ ] Build passes without errors
- [ ] Visual appearance is identical to original

---

## 🚀 Workflow

### 1. Identify Pattern

```bash
# Search for repeated classes
rg "className=\"text-lg font-semibold text-gray-900\"" apps/web/app
```

### 2. Create Wrapper

```bash
# Create file
touch apps/web/components/ui/new-component.tsx
```

### 3. Implement with Template

- Copy standard template
- Adapt variants as needed
- Add correct types

### 4. Document

```markdown
# In apps/web/components/ui/README.md

### NewComponent

**Props:**

- `tone`: inherit, primary, secondary
- `size`: sm, md, lg

**Example:**
\`\`\`tsx
<NewComponent tone="primary" size="lg">Content</NewComponent>
\`\`\`
```

### 5. Migrate Existing Uses

```typescript
// BEFORE
<div className="text-lg font-semibold text-gray-900">
  Title
</div>

// AFTER
<NewComponent size="lg" weight="semibold" tone="gray900">
  Title
</NewComponent>
```

### 6. Verify

```bash
# Build
npm run -w web build

# Visual verification
npm run -w web dev
```

---

## 📚 Resources

- [CVA Documentation](https://cva.style/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Project CVA Components](./README.md)

---

## 💡 Tips and Best Practices

### 1. Composition over Inheritance

```tsx
// ✅ CORRECT - Composable
<Card>
  <CardHeader>
    <Text size="lg" weight="bold">Title</Text>
  </CardHeader>
</Card>

// ❌ Avoid - Monolithic
<TitleCard title="Title" />
```

### 2. Specific over Generic Props

```tsx
// ✅ CORRECT - Specific
<StatusBadge status="arrived" />

// ❌ Avoid - Generic
<Badge color="blue" />
```

### 3. Variants over Conditionals

```tsx
// ✅ CORRECT - Variants
<Text tone={isPriority ? "red600" : "gray900"}>Value</Text>

// ❌ Avoid - Conditional className
<span className={isPriority ? "text-red-600" : "text-gray-900"}>Value</span>
```

### 4. Document Decisions

```typescript
// ✅ CORRECT - Commented
export interface Props {
  className?: string; // For specific layout needs
  // Don't include 'variant' because Badge already handles it
}
```

---

## 🎯 Conclusion

This CVA pattern ensures:

- **Consistency** across the application
- **Maintainability** centralized
- **Type Safety** with TypeScript
- **Scalability** for future changes
- **Improved DX** with autocomplete

**Remember**: The goal is to make the code more readable and maintainable, not more complex. If a CVA wrapper doesn't add value, use style constants with descriptive names instead.
