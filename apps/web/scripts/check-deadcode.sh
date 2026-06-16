#!/bin/bash

# Baseline: current shadcn/ui components + dev tools (as of Jan 2025)
# Update this if you intentionally add/remove shadcn/ui components
# Measured by script's counting logic (grep patterns)
# NOV 2025: Updated for ShipHero API module + growth buffer
BASELINE=200

echo "🔍 Running dead code analysis..."

# Run knip and capture output (don't exit on error)
set +e
KNIP_OUTPUT=$(DOTENV_CONFIG_PATH=.env.local node -r dotenv/config ../../node_modules/.bin/knip 2>&1)
KNIP_EXIT=$?
set -e

# Always show the output
echo "$KNIP_OUTPUT"

# If knip found issues, analyze the count
if [ "$KNIP_EXIT" -ne 0 ]; then
  # Count issues from output
  FILES=$(echo "$KNIP_OUTPUT" | grep -E "^[a-z]" | wc -l | tr -d ' ')
  DEPS=$(echo "$KNIP_OUTPUT" | grep -c "package.json:" || true)
  EXPORTS=$(echo "$KNIP_OUTPUT" | grep -E "^[A-Z]" | wc -l | tr -d ' ')
  CURRENT_ISSUES=$((FILES + DEPS + EXPORTS))
  
  if [ "$CURRENT_ISSUES" -gt "$BASELINE" ]; then
    NEW_ISSUES=$((CURRENT_ISSUES - BASELINE))
    echo ""
    echo "❌ FAILURE: Found $CURRENT_ISSUES unused code issues (baseline: $BASELINE)"
    echo ""
    echo "📊 You added $NEW_ISSUES new unused code issue(s)"
    echo ""
    echo "🔧 How to fix:"
    echo "   1. Review the output above"
    echo "   2. Remove unused files: delete files listed under 'Unused files'"
    echo "   3. Remove unused dependencies: npm uninstall <package-name>"
    echo "   4. Remove unused imports/exports from your code"
    echo ""
    echo "💡 Tip: Run 'npm run -w web deadcode:full' to see detailed report"
    echo ""
    echo "ℹ️  If you intentionally added shadcn/ui components:"
    echo "   Update BASELINE in apps/web/scripts/check-deadcode.sh"
    exit 1
  fi
fi

echo ""
echo "✅ No new unused code detected (baseline: $BASELINE)"
exit 0
