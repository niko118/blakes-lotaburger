#!/usr/bin/env tsx

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

// Map of Tailwind classes to variant props
const classToVariantMap = {
  // Tones/Colors
  "text-gray-900": { prop: "tone", value: "gray900" },
  "text-gray-600": { prop: "tone", value: "gray600" },
  "text-gray-500": { prop: "tone", value: "gray500" },
  "text-foreground": { prop: "tone", value: "foreground" },
  "text-muted-foreground": { prop: "tone", value: "muted" },
  "text-destructive": { prop: "tone", value: "destructive" },
  "text-blue-600": { prop: "tone", value: "blue600" },
  "text-purple-600": { prop: "tone", value: "purple600" },
  "text-amber-600": { prop: "tone", value: "amber600" },
  "text-red-600": { prop: "tone", value: "red600" },

  // Sizes
  "text-xs": { prop: "size", value: "xs" },
  "text-sm": { prop: "size", value: "sm" },
  "text-base": { prop: "size", value: "md" },
  "text-lg": { prop: "size", value: "lg" },
  "text-xl": { prop: "size", value: "xl" },
  "text-2xl": { prop: "size", value: "2xl" },
  "text-3xl": { prop: "size", value: "3xl" },
  "text-4xl": { prop: "size", value: "4xl" },
  "text-5xl": { prop: "size", value: "5xl" },
  "text-6xl": { prop: "size", value: "6xl" },

  // Weights
  "font-medium": { prop: "weight", value: "medium" },
  "font-semibold": { prop: "weight", value: "semibold" },
  "font-bold": { prop: "weight", value: "bold" },

  // Transforms
  capitalize: { prop: "transform", value: "caps" },
  uppercase: { prop: "transform", value: "upper" },
  lowercase: { prop: "transform", value: "lower" },

  // Alignment
  "text-left": { prop: "align", value: "left" },
  "text-center": { prop: "align", value: "center" },
  "text-right": { prop: "align", value: "right" },

  // Wrap
  "whitespace-nowrap": { prop: "wrap", value: "nowrap" },
};

// Target component mapping
const componentMap = {
  TableHead: "TableHeaderCell",
  th: "TableHeaderCell",
  span: "Text",
  p: "Text",
  div: "Text",
};

interface TransformResult {
  hasChanges: boolean;
  newContent: string;
  unmappedClasses: string[];
}

function transformFile(filePath: string): TransformResult {
  const content = readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  let hasChanges = false;
  let unmappedClasses: string[] = [];

  function visit(node: ts.Node): ts.Node {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? node.openingElement.tagName
        : node.tagName;

      // Check if it's a target component
      const tagNameText = tagName.getText(sourceFile);
      const componentName =
        componentMap[tagNameText as keyof typeof componentMap];

      if (componentName) {
        const openingElement = ts.isJsxElement(node)
          ? node.openingElement
          : node;

        // Find className attribute
        const classNameAttr = openingElement.attributes.properties.find(
          (attr) =>
            ts.isJsxAttribute(attr) &&
            attr.name.getText(sourceFile) === "className"
        ) as ts.JsxAttribute | undefined;

        if (classNameAttr && ts.isStringLiteral(classNameAttr.initializer)) {
          const classNameValue = classNameAttr.initializer.text;
          const classes = classNameValue.split(/\s+/).filter(Boolean);

          const mappedProps: Record<string, string> = {};
          const remainingClasses: string[] = [];

          // Map classes to props
          for (const cls of classes) {
            const mapping =
              classToVariantMap[cls as keyof typeof classToVariantMap];
            if (mapping) {
              mappedProps[mapping.prop] = mapping.value;
            } else {
              remainingClasses.push(cls);
            }
          }

          // If there are mapped props, create new attributes
          if (Object.keys(mappedProps).length > 0) {
            hasChanges = true;
            unmappedClasses.push(...remainingClasses);

            // Create new prop attributes
            const newProps = Object.entries(mappedProps).map(([prop, value]) =>
              ts.factory.createJsxAttribute(
                ts.factory.createIdentifier(prop),
                ts.factory.createStringLiteral(value)
              )
            );

            // Add className with unmapped classes if any
            if (remainingClasses.length > 0) {
              newProps.push(
                ts.factory.createJsxAttribute(
                  ts.factory.createIdentifier("className"),
                  ts.factory.createStringLiteral(remainingClasses.join(" "))
                )
              );
            }

            // Replace attributes
            const newAttributes = openingElement.attributes.properties
              .filter(
                (attr) =>
                  !ts.isJsxAttribute(attr) ||
                  attr.name.getText(sourceFile) !== "className"
              )
              .concat(newProps);

            const newOpeningElement = ts.factory.createJsxOpeningElement(
              ts.factory.createIdentifier(componentName),
              undefined,
              ts.factory.createJsxAttributes(newAttributes)
            );

            if (ts.isJsxElement(node)) {
              return ts.factory.createJsxElement(
                newOpeningElement,
                node.children,
                ts.factory.createJsxClosingElement(
                  ts.factory.createIdentifier(componentName)
                )
              );
            } else {
              return ts.factory.createJsxSelfClosingElement(
                ts.factory.createIdentifier(componentName),
                undefined,
                ts.factory.createJsxAttributes(newAttributes)
              );
            }
          }
        }
      }
    }

    return ts.visitEachChild(node, visit, {
      ...sourceFile,
      getSourceFile: () => sourceFile,
    });
  }

  const transformedSourceFile = ts.visitNode(
    sourceFile,
    visit
  ) as ts.SourceFile;
  const newContent = ts.createPrinter().printFile(transformedSourceFile);

  return {
    hasChanges,
    newContent,
    unmappedClasses,
  };
}

function processDirectory(dirPath: string) {
  const items = readdirSync(dirPath);

  for (const item of items) {
    const fullPath = join(dirPath, item);
    const stat = statSync(fullPath);

    if (
      stat.isDirectory() &&
      !item.startsWith(".") &&
      item !== "node_modules"
    ) {
      processDirectory(fullPath);
    } else if (item.endsWith(".tsx") && !item.endsWith(".d.ts")) {
      console.log(`Processing: ${fullPath}`);

      try {
        const result = transformFile(fullPath);

        if (result.hasChanges) {
          writeFileSync(fullPath, result.newContent);
          console.log(`✅ Updated: ${fullPath}`);

          if (result.unmappedClasses.length > 0) {
            console.log(
              `   Unmapped classes: ${result.unmappedClasses.join(", ")}`
            );
          }
        } else {
          console.log(`⏭️  No changes: ${fullPath}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${fullPath}:`, error);
      }
    }
  }
}

// Execute the codemod
const targetDir = join(process.cwd(), "apps/web/app");
console.log(`🚀 Starting codemod on: ${targetDir}`);
processDirectory(targetDir);
console.log("✨ Codemod completed!");
