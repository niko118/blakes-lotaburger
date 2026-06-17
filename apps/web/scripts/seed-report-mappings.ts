/**
 * Seeds report_groups hierarchy and account_mappings from real R365 file data.
 * Run with: npx tsx -r dotenv/config scripts/seed-report-mappings.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { reportGroups, accountMappings } from "../lib/db/schema.reports";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

// ---------------------------------------------------------------------------
// P&L SECTION + GROUP DEFINITIONS
// sortOrder is × 10 for sections, 1-N for groups within a section
// ---------------------------------------------------------------------------

// Sections mirror the 6 top-level (indent 0) sections of the workbook's
// YR Consolidation / CY vs PY detail. "Operating Expense" wraps Direct
// Operating / Marketing / G&A / R&M; "Corporate Overhead" wraps the corporate
// office, interest and other-income groups — matching the workbook's totals
// (Total Operating Expense, Total Corporate Overhead, etc.).
// contributesAs drives the Net Income sign (revenue adds, cost subtracts).
// eliminateCommissary marks the sections that net out the commissary
// intercompany (commissary total sales) — Sales and Food Cost.
const PNL_SECTIONS = [
  { name: "Sales", sortOrder: 10, contributesAs: "revenue", eliminateCommissary: true },
  { name: "Food Cost", sortOrder: 20, contributesAs: "cost", eliminateCommissary: true },
  { name: "Labor Cost", sortOrder: 30, contributesAs: "cost", eliminateCommissary: false },
  { name: "Operating Expense", sortOrder: 40, contributesAs: "cost", eliminateCommissary: false },
  { name: "Non Controllable Expense", sortOrder: 50, contributesAs: "cost", eliminateCommissary: false },
  { name: "Corporate Overhead", sortOrder: 60, contributesAs: "cost", eliminateCommissary: false },
] as const;

// [sectionName, groupName, sortOrder]
// Groups are the named subtotal groups (indent 1) of the workbook, in order.
// Loose accounts that sit directly under a section become single-account groups.
const PNL_GROUPS: [string, string, number][] = [
  // Sales
  ["Sales", "Food Sales", 1],
  ["Sales", "Soft Beverage Sales", 2],
  ["Sales", "Packaging Sales", 3],
  ["Sales", "Commissary Sales", 4],
  ["Sales", "Other Sales", 5],
  ["Sales", "Comps and Discounts", 6],
  // Food Cost (raw "Food Cost" group → Beverage Cost → Freight → Inventory Spoilage)
  ["Food Cost", "Food Cost", 1],
  ["Food Cost", "Beverage Cost", 2],
  ["Food Cost", "Freight", 3],
  ["Food Cost", "Inventory Spoilage/Loss", 4],
  // Labor Cost
  ["Labor Cost", "Salaries and Wages", 1],
  ["Labor Cost", "Payroll Expenses", 2],
  // Operating Expense
  ["Operating Expense", "Direct Operating Expense", 1],
  ["Operating Expense", "Marketing", 2],
  ["Operating Expense", "General and Administrative Expense", 3],
  ["Operating Expense", "Repairs and Maintenance", 4],
  // Non Controllable Expense
  ["Non Controllable Expense", "Occupancy Costs", 1],
  ["Non Controllable Expense", "Compensating Taxes", 2],
  ["Non Controllable Expense", "Amortization", 3],
  ["Non Controllable Expense", "Depreciation", 4],
  ["Non Controllable Expense", "Amortization Expense - Lease Costs", 5],
  // Corporate Overhead ("Corporate Office" group renamed to avoid the
  // section/group name collision with the parent "Corporate Overhead" section)
  ["Corporate Overhead", "Corporate Office", 1],
  ["Corporate Overhead", "Interest Expense", 2],
  ["Corporate Overhead", "Other Income/Expense", 3],
];

// Groups after which the report emits an intermediate section subtotal.
// - "Food Cost": the raw-food subtotal (workbook "Total Food Cost") shown
//   before Beverage Cost, Freight and Inventory Spoilage, then a grand
//   "Total Food Cost" closes the section.
// - "Corporate Office": the "Total Corporate Overhead" subtotal shown before
//   Interest Expense and Other Income, then a grand total closes the section.
const PNL_SUBTOTAL_AFTER_GROUPS = new Set<string>(["Food Cost", "Corporate Office"]);

// [groupName (unique within P&L), accountName (exact R365 string)]
const PNL_ACCOUNT_MAP: [string, string][] = [
  // --- Sales ---
  ["Food Sales", "Food Sales"],
  ["Food Sales", "Third Party Delivery Fee"],
  ["Food Sales", "Delivery Charges"],            // Month Consolidation only
  ["Soft Beverage Sales", "Soft Beverage Sales"],
  ["Packaging Sales", "Packaging Sales"],
  ["Commissary Sales", "Commissary Sales"],
  ["Other Sales", "Loyalty Discounts"],
  ["Comps and Discounts", "Comps and Discounts"],
  ["Comps and Discounts", "Employee Meals"],
  ["Comps and Discounts", "Customer Service"],
  ["Comps and Discounts", "Other Discounts"],
  // --- Food Cost (raw "Food Cost" group; Meat subgroup flattened in) ---
  ["Food Cost", "Food Cost"],                    // atomic "Food Cost" row (not a header)
  ["Food Cost", "Produce Cost"],
  ["Food Cost", "Dairy Cost"],
  ["Food Cost", "Beef Cost"],
  ["Food Cost", "Poultry Cost"],
  ["Food Cost", "Pork Cost"],
  ["Food Cost", "Seafood Cost"],
  ["Food Cost", "Grocery Cost"],
  ["Beverage Cost", "Beverage Cost"],
  ["Freight", "Third Party Freight"],
  ["Freight", "Third Party Fuel Surcharge"],
  ["Freight", "Blake's Internal Freight"],
  ["Freight", "On Invoice Freight"],
  ["Inventory Spoilage/Loss", "Inventory Spoilage/Loss"],
  // --- Labor Cost ---
  ["Salaries and Wages", "Management Wages"],
  ["Salaries and Wages", "Store Fixed Wages"],
  ["Salaries and Wages", "Store Variable Wages"],
  ["Salaries and Wages", "Store Overtime"],
  ["Salaries and Wages", "Paid Time Off Expense"],
  ["Salaries and Wages", "Bonuses"],
  // Payroll Expenses (Payroll Taxes + Insurance and Retirement + Employee Benefits subgroups flattened)
  ["Payroll Expenses", "Payroll Taxes"],
  ["Payroll Expenses", "FICA Tax"],
  ["Payroll Expenses", "State Withholding Tax NM"],
  ["Payroll Expenses", "State Unemployment Tax"],
  ["Payroll Expenses", "Federal Unemployement Tax"], // typo as-is in R365
  ["Payroll Expenses", "Worker's Comp"],
  ["Payroll Expenses", "Life Insurance"],
  ["Payroll Expenses", "Health Insurance"],
  ["Payroll Expenses", "Dental Insurance"],
  ["Payroll Expenses", "Employer Contributions EE Savings Plan"],
  ["Payroll Expenses", "Employee Benefits"],
  ["Payroll Expenses", "Other Employee Expenses"],
  ["Payroll Expenses", "Employee Gifts and Parties"],
  ["Payroll Expenses", "Employee Meals - Travel"],
  ["Payroll Expenses", "Awards and Prizes Cost"],
  // --- Operating Expense → Direct Operating Expense (Auto & Truck, Utilities subgroups flattened) ---
  ["Direct Operating Expense", "Auto and Truck Expense"],
  ["Direct Operating Expense", "Auto Insurance Expense"],
  ["Direct Operating Expense", "Fuel"],
  ["Direct Operating Expense", "Mileage"],
  ["Direct Operating Expense", "Cash Over/Short"],
  ["Direct Operating Expense", "Credit Card Over/Short"],
  ["Direct Operating Expense", "Cash Paid In/Out"],
  ["Direct Operating Expense", "Door Dash Over/Short"],
  ["Direct Operating Expense", "Penny Rounding -  Gain/Loss"], // double space as in R365
  ["Direct Operating Expense", "Cleaning Supplies"],
  ["Direct Operating Expense", "Commissary Supplies"],
  ["Direct Operating Expense", "Contract Cleaning"],
  ["Direct Operating Expense", "Security/Fire Monitoring Expense"],
  ["Direct Operating Expense", "Door Dash Expenses"],
  ["Direct Operating Expense", "Equipment/Other Rentals"],
  ["Direct Operating Expense", "Kitchen Utensils and Supplies/Smallwares - Inventory Account"],
  ["Direct Operating Expense", "Kitchen Utensils and Supplies/Smallwares - Non-Inventory Item"],
  ["Direct Operating Expense", "Laundry Service"],
  ["Direct Operating Expense", "Loss Due to Theft"],
  ["Direct Operating Expense", "Minor Equipment Expense"],
  ["Direct Operating Expense", "Miscellaneous Expense"],
  ["Direct Operating Expense", "Olo Processing Fees"],
  ["Direct Operating Expense", "Office Supplies Expense"],
  ["Direct Operating Expense", "Paper and Packaging Expense"],
  ["Direct Operating Expense", "Pest Control"],
  ["Direct Operating Expense", "Postage/Shipping"],
  ["Direct Operating Expense", "Training Expenses (Field Ops)"],
  ["Direct Operating Expense", "Electricity"],
  ["Direct Operating Expense", "Gas"],
  ["Direct Operating Expense", "Telephone"],
  ["Direct Operating Expense", "Trash Removal"],
  ["Direct Operating Expense", "Water"],
  ["Direct Operating Expense", "Uniforms"],
  ["Direct Operating Expense", "Store Uniform Expense"],
  ["Direct Operating Expense", "Sales Tax Expense"],
  ["Direct Operating Expense", "Tools"],
  ["Direct Operating Expense", "Sound Hound Expenses"], // Month Consolidation only
  ["Direct Operating Expense", "Utilities"],            // atomic R365 account
  // --- Operating Expense → Marketing (Advertising, Direct Response, Public Relations, Marketing-Other flattened) ---
  ["Marketing", "Advertising Fees"],
  ["Marketing", "Marketing Expenses"],
  ["Marketing", "Print Materials"],
  ["Marketing", "Online Advertising"],
  ["Marketing", "Out of Home/Billboards"],
  ["Marketing", "Radio and Television"],
  ["Marketing", "Print Media/Publications"],
  ["Marketing", "Loyalty Program"],
  ["Marketing", "Printing and Mail Service"],
  ["Marketing", "Public Relations"],
  ["Marketing", "Community Projects"],
  ["Marketing", "Gifts, Gift Card and Free Product"],
  ["Marketing", "Cash Sponsorships and Donations"],
  ["Marketing", "Recruiting"],
  ["Marketing", "Research"],
  ["Marketing", "Marketing - Other"],
  ["Marketing", "Marketing Legal Fees"],
  ["Marketing", "Restaurant Website"],
  ["Marketing", "Marketing Dues and Subscriptions"],
  ["Marketing", "Marketing Platforms"],
  // --- Operating Expense → General and Administrative Expense ---
  ["General and Administrative Expense", "Accounting and Payroll"],
  ["General and Administrative Expense", "Bank Charges"],
  ["General and Administrative Expense", "Claims and Damages Paid"],
  ["General and Administrative Expense", "Computer Expense"],
  ["General and Administrative Expense", "Consulting Expense"],
  ["General and Administrative Expense", "Contract Services Expense"],
  ["General and Administrative Expense", "Credit Card Fees"],
  ["General and Administrative Expense", "Dues & Subscriptions - G&A"],
  ["General and Administrative Expense", "EE Svings Plan Expense"], // typo as-is in R365
  ["General and Administrative Expense", "Hardware and Software Repairs and Maintenance"],
  ["General and Administrative Expense", "Insurance Expense - General"],
  ["General and Administrative Expense", "Licenses and Permits Expense"],
  ["General and Administrative Expense", "Meals (Business)"],
  ["General and Administrative Expense", "Other Professional Services"],
  ["General and Administrative Expense", "Taxes - Other"],
  ["General and Administrative Expense", "Training Programs"],
  ["General and Administrative Expense", "Travel Expense"],
  // --- Operating Expense → Repairs and Maintenance ---
  ["Repairs and Maintenance", "Repairs and Maintenance - Meals"],
  ["Repairs and Maintenance", "Repairs and Maintenance - Supplies"],
  ["Repairs and Maintenance", "Repairs and Maintenance - Travel"],
  ["Repairs and Maintenance", "Repairs and Maintenance Tools"],
  ["Repairs and Maintenance", "Repairs and Maintenance-Outside Services"],
  // --- Non Controllable Expense ---
  ["Occupancy Costs", "Ground Rent"],
  ["Occupancy Costs", "Personal Property Taxes"],
  ["Occupancy Costs", "Real Estate Taxes"],
  ["Compensating Taxes", "Compensating Taxes"],
  ["Amortization", "Amortization"],
  ["Depreciation", "Depreciation"],
  ["Amortization Expense - Lease Costs", "Amortization Expense - Lease Costs"],
  // --- Corporate Overhead ---
  ["Corporate Office", "Corporate Office Payroll"],
  ["Corporate Office", "Corporate Employee Benefits"],
  ["Corporate Office", "Corporate Office Travel"],
  ["Corporate Office", "Corporate Office Telephone"],
  ["Corporate Office", "Corporate Office Auto Expense"],
  ["Corporate Office", "Corporate Office Insurance"],
  ["Corporate Office", "Corporate Office Utilities"],
  ["Corporate Office", "Corporate miscellaneous expense"],
  ["Interest Expense", "Interest Expense"],
  ["Other Income/Expense", "Other Income/Expense"], // atomic catch-all
  ["Other Income/Expense", "Gain/Loss on Sale of Assets"],
  ["Other Income/Expense", "Interest Income"],
  ["Other Income/Expense", "Rental Income"],
  ["Other Income/Expense", "Lumper Fees"],
  ["Other Income/Expense", "Rebates and Incentives"],
  ["Other Income/Expense", "Rebates - Credit Card"],
  ["Other Income/Expense", "Miscellaneous Income"],
  ["Other Income/Expense", "Discounts Taken"],
];

// ---------------------------------------------------------------------------
// BALANCE SHEET SECTIONS + GROUPS
// ---------------------------------------------------------------------------

// Sections and groups mirror the workbook's "BS Current and Prior Year" detail:
// 7 sections (indent 2), each with its named groups (indent 3). Loose accounts
// that sit directly under a section become single-account groups.
const BS_SECTIONS = [
  { name: "Current Asset", sortOrder: 10 },
  { name: "Inventory", sortOrder: 20 },
  { name: "Fixed Asset", sortOrder: 30 },
  { name: "Other Asset", sortOrder: 40 },
  { name: "Current Liability", sortOrder: 50 },
  { name: "Long Term Liability", sortOrder: 60 },
  { name: "Equity", sortOrder: 70 },
] as const;

const BS_GROUPS: [string, string, number][] = [
  ["Current Asset", "Cash", 1],
  ["Current Asset", "Accounts Receivable", 2],
  ["Current Asset", "A/R Suspense", 3],
  ["Current Asset", "A/R Doordash", 4],
  ["Current Asset", "Allowance for Bad Debt", 5],
  ["Current Asset", "Vendor Credit Expected", 6],
  ["Current Asset", "Rent Receivable", 7],
  ["Current Asset", "Accrued Interest Receivable", 8],
  ["Current Asset", "Prepaid Expenses", 9],
  ["Current Asset", "Due To/From Blake's Lotaburger LLC", 10],
  ["Inventory", "Food Inventory", 1],
  ["Inventory", "Beverage Inventory", 2],
  ["Inventory", "Paper Products Inventory", 3],
  ["Inventory", "Supplies Inventory", 4],
  ["Inventory", "Uniform Inventory", 5],
  ["Fixed Asset", "Fixed Assets", 1],
  ["Fixed Asset", "Accumulated Depreciation", 2],
  ["Other Asset", "Notes Receivable", 1],
  ["Other Asset", "Deposits", 2],
  ["Other Asset", "Licenses", 3],
  ["Current Liability", "Accounts Payable", 1],
  ["Current Liability", "AP Credit Card", 2],
  ["Current Liability", "Employee Credit Cards", 3],
  ["Current Liability", "Other Payables", 4],
  ["Current Liability", "Payroll Tax Payable", 5],
  ["Current Liability", "Accrued Expenses", 6],
  ["Current Liability", "Sales Tax Payable", 7],
  ["Current Liability", "Other Liabilities", 8],
  ["Long Term Liability", "Capitalized Leases", 1],
  ["Long Term Liability", "Notes Payable", 2],
  ["Equity", "Member's Distribution", 1],
  ["Equity", "Member's Contribution", 2],
  ["Equity", "Member's Equity", 3],
  ["Equity", "Current Years Earnings", 4],
  ["Equity", "YTD Income", 5],
];

const BS_ACCOUNT_MAP: [string, string][] = [
  // --- Current Asset ---
  ["Cash", "Petty Cash"],
  ["Cash", "Till Money"],
  ["Cash", "First American Bank"],
  ["Cash", "Hillcrest Bank"],
  ["Cash", "Citizens Bank Aztec"],
  ["Cash", "Cash Wells Fargo"],
  ["Cash", "Cash Wells Fargo Payroll"],
  ["Cash", "Cash Wells Fargo AP"],
  ["Cash", "Undeposited Funds"],
  ["Accounts Receivable", "Accounts Receivable"],
  ["Accounts Receivable", "A/R Olo"],
  ["Accounts Receivable", "Notes Receivable, Current Portion"],
  ["A/R Suspense", "A/R Suspense"],
  ["A/R Doordash", "A/R Doordash"],
  ["Allowance for Bad Debt", "Allowance for Bad Debt"],
  ["Vendor Credit Expected", "Vendor Credit Expected"],
  ["Rent Receivable", "Rent Receivable"],
  ["Accrued Interest Receivable", "Accrued Interest Receivable"],
  ["Prepaid Expenses", "Prepaid Rent"],
  ["Prepaid Expenses", "Prepaid Insurance"],
  ["Prepaid Expenses", "Prepaid Other"],
  ["Due To/From Blake's Lotaburger LLC", "Due To/From Blake's Lotaburger LLC"],
  // --- Inventory ---
  ["Food Inventory", "Food Inventory"],
  ["Food Inventory", "Produce Inventory"],
  ["Food Inventory", "Dairy Inventory"],
  ["Food Inventory", "Beef Inventory"],
  ["Food Inventory", "Poultry Inventory"],
  ["Food Inventory", "Pork Inventory"],
  ["Food Inventory", "Seafood Inventory"],
  ["Food Inventory", "Grocery Inventory"],
  ["Beverage Inventory", "Beverage Inventory"],
  ["Paper Products Inventory", "Paper Products Inventory"],
  ["Supplies Inventory", "Supplies Inventory"],
  ["Uniform Inventory", "Uniform Inventory"],
  // --- Fixed Asset ---
  ["Fixed Assets", "Land"],
  ["Fixed Assets", "Buildings & Improvements"],
  ["Fixed Assets", "Lease Hold Improvements"],
  ["Fixed Assets", "Automobiles & Trucks"],
  ["Fixed Assets", "Fixtures & Equipment"],
  ["Fixed Assets", "Office Furniture & Equipment"],
  ["Fixed Assets", "Computer Equipment"],
  ["Fixed Assets", "Lease Acquisition Costs"],
  ["Fixed Assets", "Fixed Assets in Process"],
  ["Fixed Assets", "Construction in Process"],
  ["Fixed Assets", "Goodwill"],
  ["Fixed Assets", "Trade Name"],
  ["Fixed Assets", "Right of Use Asset (Capital Leases)"],
  ["Accumulated Depreciation", "A/D - Buildings & Improvements"],
  ["Accumulated Depreciation", "A/D - Leasehold Improvements"],
  ["Accumulated Depreciation", "A/D - Auto & Trucks"],
  ["Accumulated Depreciation", "A/D - Fixtures & Equipment"],
  ["Accumulated Depreciation", "A/D - Office Furniture & Equipment"],
  ["Accumulated Depreciation", "A/A – Lease Costs"],  // en-dash as in R365 file
  ["Accumulated Depreciation", "A/A - Goodwill"],
  ["Accumulated Depreciation", "A/D - Computer Equipment"],
  // --- Other Asset ---
  ["Notes Receivable", "Note Receivable #1"],
  ["Notes Receivable", "Note Receivable #7"],
  ["Notes Receivable", "Note Receivable #3"],
  ["Notes Receivable", "Note Receivable #4"],
  ["Notes Receivable", "Note Receivable #2"],
  ["Notes Receivable", "Note Receivable #10"],
  ["Notes Receivable", "Note Receivable #11"],
  ["Notes Receivable", "Note Receivable #12"],
  ["Notes Receivable", "Note Receivable #13"],
  ["Deposits", "Deposits"],
  ["Licenses", "Licenses"],
  // --- Current Liability ---
  ["Accounts Payable", "Accounts Payable"],
  ["Accounts Payable", "Other Current Accruals"],
  ["AP Credit Card", "AP Credit Card"],
  ["Employee Credit Cards", "Employee Credit Cards"],
  ["Other Payables", "Employee Reimbursement Payable"],
  ["Other Payables", "Intercompany Payable (TWT)"],
  ["Other Payables", "Accrued Bank Charges"],
  ["Payroll Tax Payable", "FICA Taxes Payable"],
  ["Payroll Tax Payable", "Accrued Federal W/H Tax"],
  ["Payroll Tax Payable", "Accrued NM State W/H Tax"],
  ["Payroll Tax Payable", "Accrued AZ State W/H Tax"],
  ["Payroll Tax Payable", "Accrued State Unemployment Tax"],
  ["Payroll Tax Payable", "Accrued FUTA"],
  ["Accrued Expenses", "Salaries and Wages Payable"],
  ["Accrued Expenses", "Accrued Vacation"],
  ["Accrued Expenses", "Accrued Health Insurance"],
  ["Accrued Expenses", "Accrued Dental Insurance"],
  ["Accrued Expenses", "Accrued EE Savings Plan"],
  ["Accrued Expenses", "Accrued Worker Comp Assessment"],
  ["Accrued Expenses", "Accrued Bonus Payable"],
  ["Accrued Expenses", "Garnishments Payable"],
  ["Accrued Expenses", "Accrued Real Estate Taxes"],
  ["Accrued Expenses", "Accrued Personal Property Taxes"],
  ["Accrued Expenses", "Accrued Interest Payable"],
  ["Accrued Expenses", "Accrued Rent Payable"],
  ["Sales Tax Payable", "Sales Tax Payable"],
  ["Sales Tax Payable", "Accrued Compenstaing Tax"],  // typo as-is in R365 file
  ["Other Liabilities", "Gift Card Liability"],
  ["Other Liabilities", "Gift Card Redemption"],
  ["Other Liabilities", "Gift Card Carryover Balance"],
  ["Other Liabilities", "Deferred Revenue - Pepsi Project"],
  ["Other Liabilities", "Deposits Received on Rented Property"],
  // --- Long Term Liability ---
  ["Capitalized Leases", "Capitalized Leases"],
  ["Capitalized Leases", "Operating Leases"],
  ["Capitalized Leases", "Less, Current Portion of L/T Operating Leases"],
  ["Notes Payable", "Line of Credit"],
  ["Notes Payable", "Note Payable"],
  ["Notes Payable", "Capital Leases Payable"],
  ["Notes Payable", "Less, Current Portion of L/T Debt"],
  // --- Equity ---
  ["Member's Distribution", "Member's Distribution"],
  ["Member's Contribution", "Member's Contribution"],
  ["Member's Equity", "Member's Equity"],
  ["Current Years Earnings", "Current Years Earnings"],
  ["YTD Income", "YTD Income"],
];

// ---------------------------------------------------------------------------
// IGNORED ACCOUNTS (total rows, section headers, non-operational)
// ---------------------------------------------------------------------------

const IGNORED_PNL_ACCOUNTS = [
  // Non-operational items
  "Net Profit",
  // R365 section subtotals that the workbook also VLOOKUPs (we compute these ourselves)
  "Corporate Overhead",
  "Direct Response",
  "Non Controllable Expense",
  "Occupancy Costs",
  "Repairs and Maintenance",
  "Salaries and Wages",
  // Total rows from R365 — we calculate these ourselves
  "Total Advertising Fees",
  "Total Auto and Truck Expense",
  "Total Comps and Discounts",
  "Total Corporate  Overhead",   // double space as in R365
  "Total Corporate Overhead",
  "Total Direct Operating Expense",
  "Total Direct Response",
  "Total Employee Benefits",
  "Total Food Cost",
  "Total Food Sales",
  "Total Freight",
  "Total General and Administrative Expense",
  "Total Insurance and Retirement",
  "Total Labor Cost",
  "Total Marketing",
  "Total Marketing - Other",
  "Total Meat Cost",
  "Total Non Controllable Expense",
  "Total Occupancy Costs",
  "Total Operating Expense",
  "Total Other Income/Expense",
  "Total Other Sales",
  "Total Payroll Expenses",
  "Total Payroll Taxes",
  "Total Prime Cost",
  "Total Public Relations",
  "Total Repairs and Maintenance",
  "Total Salaries and Wages",
  "Total Sales",
  "Total Utilities",
];

const IGNORED_BS_ACCOUNTS = [
  // Section headers from R365 (workbook VLOOKUPs sub-accounts individually)
  "Cash",
  "Prepaid Expenses",
  "Fixed Assets",
  "Accrued Expenses",
  // Total rows from R365 — we calculate these ourselves
  "Total ASSETS",
  "Total Accounts Payable",
  "Total Accounts Receivable",
  "Total Accrued Expenses",
  "Total Accumulated Depreciation",
  "Total Capitalized Leases",
  "Total Cash",
  "Total Current Asset",
  "Total Current Liability",
  "Total Equity",
  "Total Fixed Asset",
  "Total Fixed Assets",
  "Total Food Inventory",
  "Total Inventory",
  "Total LIABILITIES & EQUITY",
  "Total Liabilities",
  "Total Long Term Liability",
  "Total Meat Inventory",
  "Total Notes Payable",
  "Total Notes Receivable",
  "Total Other Asset",
  "Total Other Liabilities",
  "Total Other Payables",
  "Total Other Receivables",
  "Total Payroll Tax Payable",
  "Total Prepaid Expenses",
  "Total Sales Tax Payable",
];

// ---------------------------------------------------------------------------
// SEED RUNNER
// ---------------------------------------------------------------------------

async function seed() {
  console.log("Seeding report groups and account mappings...");

  // Everything runs in a single transaction: either the whole baseline is
  // (re)written atomically, or nothing changes on failure.
  await db.transaction(async (tx) => {
    // 0. Clean slate — wipe the existing report structure and mappings so the
    // seed is idempotent: re-running always yields exactly this baseline.
    // WARNING: this also discards any manual mappings made from the UI.
    await tx.delete(accountMappings);
    await tx.delete(reportGroups);

    // 1. Insert P&L sections
    const pnlSectionIds: Record<string, number> = {};
    for (const section of PNL_SECTIONS) {
      const [row] = await tx
        .insert(reportGroups)
        .values({
          name: section.name,
          parentId: null,
          reportType: "pnl",
          sortOrder: section.sortOrder,
          contributesAs: section.contributesAs,
          eliminateCommissary: section.eliminateCommissary,
        })
        .returning({ id: reportGroups.id });
      pnlSectionIds[section.name] = row.id;
    }

    // 2. Insert P&L groups under their sections
    const pnlGroupIds: Record<string, number> = {};
    for (const [sectionName, groupName, sortOrder] of PNL_GROUPS) {
      const parentId = pnlSectionIds[sectionName];
      if (!parentId) { console.warn(`Section not found: ${sectionName}`); continue; }
      const [row] = await tx
        .insert(reportGroups)
        .values({
          name: groupName,
          parentId,
          reportType: "pnl",
          sortOrder,
          subtotalAfter: PNL_SUBTOTAL_AFTER_GROUPS.has(groupName),
        })
        .returning({ id: reportGroups.id });
      pnlGroupIds[groupName] = row.id;
    }

    // 3. Insert BS sections
    const bsSectionIds: Record<string, number> = {};
    for (const section of BS_SECTIONS) {
      const [row] = await tx
        .insert(reportGroups)
        .values({ name: section.name, parentId: null, reportType: "bs", sortOrder: section.sortOrder })
        .returning({ id: reportGroups.id });
      bsSectionIds[section.name] = row.id;
    }

    // 4. Insert BS groups
    const bsGroupIds: Record<string, number> = {};
    for (const [sectionName, groupName, sortOrder] of BS_GROUPS) {
      const parentId = bsSectionIds[sectionName];
      if (!parentId) { console.warn(`BS Section not found: ${sectionName}`); continue; }
      const [row] = await tx
        .insert(reportGroups)
        .values({ name: groupName, parentId, reportType: "bs", sortOrder })
        .returning({ id: reportGroups.id });
      bsGroupIds[groupName] = row.id;
    }

    console.log(`Inserted ${Object.keys(pnlSectionIds).length} P&L sections, ${Object.keys(pnlGroupIds).length} P&L groups`);
    console.log(`Inserted ${Object.keys(bsSectionIds).length} BS sections, ${Object.keys(bsGroupIds).length} BS groups`);

    // 5. Insert P&L account mappings
    let pnlMapped = 0;
    for (const [groupName, accountName] of PNL_ACCOUNT_MAP) {
      const groupId = pnlGroupIds[groupName];
      if (!groupId) { console.warn(`P&L group not found for mapping: ${groupName}`); continue; }
      await tx.insert(accountMappings).values({ accountName, groupId, reportType: "pnl", ignored: false });
      pnlMapped++;
    }

    // 6. Insert BS account mappings
    let bsMapped = 0;
    for (const [groupName, accountName] of BS_ACCOUNT_MAP) {
      const groupId = bsGroupIds[groupName];
      if (!groupId) { console.warn(`BS group not found for mapping: ${groupName}`); continue; }
      await tx.insert(accountMappings).values({ accountName, groupId, reportType: "bs", ignored: false });
      bsMapped++;
    }

    // 7. Insert ignored accounts (tagged by statement)
    for (const accountName of IGNORED_PNL_ACCOUNTS) {
      await tx.insert(accountMappings).values({ accountName, groupId: null, reportType: "pnl", ignored: true });
    }
    for (const accountName of IGNORED_BS_ACCOUNTS) {
      await tx.insert(accountMappings).values({ accountName, groupId: null, reportType: "bs", ignored: true });
    }
    const ignoredCount = IGNORED_PNL_ACCOUNTS.length + IGNORED_BS_ACCOUNTS.length;

    console.log(`Mapped ${pnlMapped} P&L accounts, ${bsMapped} BS accounts, ${ignoredCount} ignored`);
  });

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
