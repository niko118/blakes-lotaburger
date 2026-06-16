"use client";
import type { ComponentPropsWithoutRef, ComponentType } from "react";
import { cn } from "@lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Text } from "./text";
import { KpiValue, type KpiValueProps } from "./kpi-value";

// Style constants
const styles = {
  card: "bg-white border-cloud p-4",
  header: "flex flex-row items-center justify-between pt-1 pb-0",
  icon: "h-8 w-8",
  content: "pb-1",
  descriptionMargin: "mt-1",
} as const;

// Tone mapping for consistent styling
type MetricTone = "primary" | "yellow" | "red";

const toneStyles: Record<MetricTone, { icon: string; value: KpiValueProps["tone"] }> = {
  primary: { icon: "text-primary", value: "primary" },
  yellow: { icon: "text-yellow-dark", value: "yellow" },
  red: { icon: "text-red", value: "red" },
};

export interface MetricCardProps extends ComponentPropsWithoutRef<typeof Card> {
  title: string;
  value: number | string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone?: MetricTone;
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "primary",
  className,
  ...props
}: MetricCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <Card className={cn(styles.card, className)} {...props}>
      <CardHeader className={styles.header}>
        <CardTitle>
          <Text size="2xl" weight="semibold" tone="dark-grey">
            {title}
          </Text>
        </CardTitle>
        <Icon className={cn(styles.icon, toneStyle.icon)} />
      </CardHeader>
      <CardContent className={styles.content}>
        <KpiValue size="3xl" weight="bold" tone={toneStyle.value}>
          {value}
        </KpiValue>
        <Text
          as="p"
          size="xs"
          tone="silver"
          className={styles.descriptionMargin}
        >
          {description}
        </Text>
      </CardContent>
    </Card>
  );
}
