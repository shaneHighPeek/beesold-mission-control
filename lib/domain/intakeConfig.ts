export type IntakeFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "currency"
  | "date"
  | "single_select"
  | "multi_select"
  | "boolean"
  | "upload"
  | "signature";

export interface FieldCondition {
  field?: string;
  equals?: string | number | boolean;
  hasValue?: boolean;
  anyEquals?: Array<{ field: string; equals: string | number | boolean }>;
}

export interface IntakeFieldValidation {
  regex?: string;
  min?: number;
  max?: number;
  maxWords?: number;
  sumGroup?: string;
}

export interface IntakeFieldDefinition {
  name: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  helperText?: string;
  condition?: FieldCondition;
  validation?: IntakeFieldValidation;
  uploadCategory?: "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
}

export interface IntakeStepDefinition {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  estimatedMinutes: number;
  helpText: string;
  fields: IntakeFieldDefinition[];
}

function f(field: IntakeFieldDefinition): IntakeFieldDefinition {
  return field;
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined && value !== false;
}

export function isFieldVisible(field: IntakeFieldDefinition, data: Record<string, unknown>): boolean {
  if (!field.condition) {
    return true;
  }

  const { condition } = field;

  if (condition.anyEquals && condition.anyEquals.length > 0) {
    return condition.anyEquals.some((item) => data[item.field] === item.equals);
  }

  if (!condition.field) {
    return true;
  }

  const value = data[condition.field];
  if (condition.hasValue) {
    return hasValue(value);
  }

  if (condition.equals !== undefined) {
    if (Array.isArray(value)) {
      return value.includes(condition.equals);
    }
    return value === condition.equals;
  }

  return true;
}

export function isFieldRequired(field: IntakeFieldDefinition, data: Record<string, unknown>): boolean {
  return Boolean(field.required) && isFieldVisible(field, data);
}

// Pluggable schema host for brokerage intake form specification.
export const INTAKE_STEP_DEFINITIONS: IntakeStepDefinition[] = [
  {
    key: "asset_snapshot",
    title: "The Asset Snapshot",
    subtitle: "Quick overview — the easy start.",
    description: "Capture legal and commercial identity details for the asset.",
    estimatedMinutes: 3,
    helpText: "Step 1 of 7",
    fields: [
      f({ name: "q1_1_business_property_name", label: "Q1.1 Business / Property Name", type: "text", required: true }),
      f({ name: "q1_2_trading_name", label: "Q1.2 Trading Name (if different)", type: "text" }),
      f({ name: "q1_3_street_address", label: "Q1.3 Street Address", type: "text", required: true }),
      f({ name: "q1_4_suburb_town", label: "Q1.4 Suburb / Town", type: "text", required: true }),
      f({ name: "q1_5_state", label: "Q1.5 State", type: "single_select", required: true, options: ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] }),
      f({ name: "q1_6_postcode", label: "Q1.6 Postcode", type: "text", required: true, validation: { regex: "^\\d{4}$" } }),
      f({ name: "q1_7_entity_name", label: "Q1.7 Entity Name (Legal Owner)", type: "text", required: true }),
      f({ name: "q1_8_abn", label: "Q1.8 ABN", type: "text", required: true, validation: { regex: "^\\d{11}$" } }),
      f({ name: "q1_9_acn", label: "Q1.9 ACN (if applicable)", type: "text", validation: { regex: "^$|^\\d{9}$" } }),
      f({ name: "q1_10_gst_registered", label: "Q1.10 GST Registered?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({
        name: "q1_11_asset_type",
        label: "Q1.11 Type of Asset",
        type: "single_select",
        required: true,
        options: [
          "Freehold Going Concern",
          "Leasehold Business Only",
          "Freehold Passive Investment",
          "Management Rights",
          "Strata / Body Corporate",
          "Other",
        ],
      }),
      f({ name: "q1_11_other", label: "Q1.11 Please specify", type: "text", required: true, condition: { field: "q1_11_asset_type", equals: "Other" } }),
      f({
        name: "q1_12_primary_industry",
        label: "Q1.12 Primary Industry Classification",
        type: "single_select",
        required: true,
        options: [
          "Hotel / Pub",
          "Hospitality / Restaurant / Café",
          "Retail",
          "Accommodation / Motel / Caravan Park",
          "Function / Event Venue",
          "Mixed Use / Commercial",
          "Other",
        ],
      }),
      f({ name: "q1_12_other", label: "Q1.12 Please specify", type: "text", required: true, condition: { field: "q1_12_primary_industry", equals: "Other" } }),
      f({
        name: "q1_13_reason_for_sale",
        label: "Q1.13 Primary Reason for Sale",
        type: "single_select",
        required: true,
        options: [
          "Retirement",
          "Capital Reallocation / Portfolio Change",
          "Succession / Family Transition",
          "Health or Lifestyle",
          "Repositioning / Upgrading",
          "Other",
        ],
      }),
      f({ name: "q1_13_other", label: "Q1.13 Please specify", type: "text", required: true, condition: { field: "q1_13_reason_for_sale", equals: "Other" } }),
      f({
        name: "q1_14_brief_description",
        label: "Q1.14 Brief Description of the Business (optional)",
        type: "textarea",
        placeholder: "Tell us a little about your business in your own words. Max 150 words.",
        validation: { maxWords: 150 },
      }),
    ],
  },
  {
    key: "financial_overview",
    title: "Financial Overview",
    subtitle: "Core numbers — clean and contained. No legal questions here.",
    description: "Capture historical and current-year financial performance.",
    estimatedMinutes: 7,
    helpText: "Step 2 of 7",
    fields: [
      f({ name: "q2_1_revenue_fy1", label: "Q2.1 Revenue (Ex GST) — FY1 (most recent)", type: "currency", required: true }),
      f({ name: "q2_1_revenue_fy2", label: "Q2.1 Revenue (Ex GST) — FY2", type: "currency" }),
      f({ name: "q2_1_revenue_fy3", label: "Q2.1 Revenue (Ex GST) — FY3", type: "currency" }),
      f({ name: "q2_2_profit_fy1", label: "Q2.2 EBITDA / Net Profit — FY1 (most recent)", type: "currency", required: true }),
      f({ name: "q2_2_profit_fy2", label: "Q2.2 EBITDA / Net Profit — FY2", type: "currency" }),
      f({ name: "q2_2_profit_fy3", label: "Q2.2 EBITDA / Net Profit — FY3", type: "currency" }),
      f({ name: "q2_3_ytd_revenue", label: "Q2.3 Current Year-to-Date Revenue", type: "currency", required: true }),
      f({ name: "q2_4_ytd_profit", label: "Q2.4 Current Year-to-Date Profit", type: "currency", required: true }),
      f({ name: "q2_5_normalised_earnings", label: "Q2.5 Normalised / Adjusted Owner Earnings (if known)", type: "currency" }),
      f({
        name: "q2_6_addbacks",
        label: "Q2.6 Explain any add-backs or adjustments",
        type: "textarea",
        placeholder: "e.g., owner's salary, personal expenses through business, one-off costs, depreciation",
        condition: { field: "q2_5_normalised_earnings", hasValue: true },
      }),
      f({ name: "q2_7_accountant_prepared", label: "Q2.7 Are financial statements accountant-prepared?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q2_8_accountant_name", label: "Q2.8 Accountant / Advisor Name", type: "text" }),
      f({ name: "q2_9_accountant_phone", label: "Q2.9 Accountant / Advisor Phone", type: "phone" }),
      f({ name: "q2_10_ato_liabilities", label: "Q2.10 Any outstanding ATO liabilities or payment plans?", type: "single_select", required: true, options: ["Yes", "No", "Prefer not to say"] }),
      f({ name: "q2_11_upload_pl", label: "Q2.11 Upload: Last 3 Years Profit & Loss Statements", type: "upload", uploadCategory: "FINANCIALS", helperText: "Required" }),
      f({ name: "q2_11_upload_balance_sheets", label: "Q2.11 Upload: Last 3 Years Balance Sheets", type: "upload", uploadCategory: "FINANCIALS" }),
      f({ name: "q2_11_upload_bas", label: "Q2.11 Upload: Last 3 Years BAS Summaries", type: "upload", uploadCategory: "FINANCIALS" }),
      f({ name: "q2_11_upload_ytd", label: "Q2.11 Upload: Current Year Management Accounts / YTD Financials", type: "upload", uploadCategory: "FINANCIALS" }),
      f({ name: "q2_11_upload_payroll", label: "Q2.11 Upload: Payroll Summary or Wages Breakdown", type: "upload", uploadCategory: "FINANCIALS" }),
      f({ name: "q2_11_upload_depreciation", label: "Q2.11 Upload: Depreciation Schedule", type: "upload", uploadCategory: "FINANCIALS" }),
    ],
  },
  {
    key: "revenue_operations",
    title: "Revenue Structure & Operations",
    subtitle: "Where the money comes from and how the business runs.",
    description: "Capture demand mix, staffing, and license operations.",
    estimatedMinutes: 7,
    helpText: "Step 3 of 7",
    fields: [
      f({ name: "q3_1_bar_pct", label: "Q3.1 Revenue Breakdown — Bar / Beverage %", type: "number", required: true, validation: { min: 0, max: 100, sumGroup: "q3_1_breakdown" } }),
      f({ name: "q3_1_food_pct", label: "Q3.1 Revenue Breakdown — Food / Dining %", type: "number", required: true, validation: { min: 0, max: 100, sumGroup: "q3_1_breakdown" } }),
      f({ name: "q3_1_accommodation_pct", label: "Q3.1 Revenue Breakdown — Accommodation %", type: "number", required: true, validation: { min: 0, max: 100, sumGroup: "q3_1_breakdown" } }),
      f({ name: "q3_1_retail_pct", label: "Q3.1 Revenue Breakdown — Retail / Bottle Shop %", type: "number", required: true, validation: { min: 0, max: 100, sumGroup: "q3_1_breakdown" } }),
      f({ name: "q3_1_gaming_pct", label: "Q3.1 Revenue Breakdown — Gaming / TAB %", type: "number", required: true, validation: { min: 0, max: 100, sumGroup: "q3_1_breakdown" } }),
      f({ name: "q3_1_functions_pct", label: "Q3.1 Revenue Breakdown — Functions / Events %", type: "number", required: true, validation: { min: 0, max: 100, sumGroup: "q3_1_breakdown" } }),
      f({ name: "q3_1_other_pct", label: "Q3.1 Revenue Breakdown — Other %", type: "number", required: true, validation: { min: 0, max: 100, sumGroup: "q3_1_breakdown" } }),
      f({ name: "q3_2_avg_weekly_turnover", label: "Q3.2 Average Weekly Turnover", type: "currency", required: true }),
      f({ name: "q3_3_peak_weekly_turnover", label: "Q3.3 Peak Weekly Turnover (if seasonal)", type: "currency" }),
      f({ name: "q3_4_seasonal", label: "Q3.4 Is the business seasonal?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q3_5_seasonality_detail", label: "Q3.5 Describe peak and off-peak periods", type: "textarea", condition: { field: "q3_4_seasonal", equals: "Yes" } }),
      f({ name: "q3_6_total_staff", label: "Q3.6 Staffing Structure — Total Staff", type: "number", required: true }),
      f({ name: "q3_6_full_time", label: "Q3.6 Staffing Structure — Full-Time", type: "number" }),
      f({ name: "q3_6_part_time", label: "Q3.6 Staffing Structure — Part-Time", type: "number" }),
      f({ name: "q3_6_casual", label: "Q3.6 Staffing Structure — Casual", type: "number" }),
      f({ name: "q3_6_contractors", label: "Q3.6 Staffing Structure — Contractors / Sub-contractors", type: "number" }),
      f({ name: "q3_7_fully_staffed", label: "Q3.7 Is the business currently fully staffed?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q3_8_key_person_dependency", label: "Q3.8 Is there a key-person dependency?", type: "single_select", required: true, options: ["Yes", "No"], helperText: "e.g., the business relies heavily on a specific chef, licensee, or manager" }),
      f({ name: "q3_9_key_person_detail", label: "Q3.9 Explain the key-person dependency", type: "textarea", required: true, condition: { field: "q3_8_key_person_dependency", equals: "Yes" } }),
      f({
        name: "q3_10_licences",
        label: "Q3.10 Key Licences & Permits Held",
        type: "multi_select",
        required: true,
        options: [
          "Liquor Licence",
          "Gaming Licence / Entitlements",
          "Food Safety / Health Licence",
          "Accommodation Registration",
          "Building / DA Approvals",
          "Environmental Permits",
          "Other",
        ],
      }),
      f({ name: "q3_10_licences_other", label: "Q3.10 Please specify", type: "text", required: true, condition: { field: "q3_10_licences", equals: "Other" } }),
      f({ name: "q3_11_licences_current_transferable", label: "Q3.11 Are all licences current and transferable?", type: "single_select", required: true, options: ["Yes", "No", "Unsure"] }),
      f({ name: "q3_12_upload_staff_roster", label: "Q3.12 Upload: Staff roster sample (recent week)", type: "upload", uploadCategory: "OTHER" }),
      f({ name: "q3_12_upload_gaming_reports", label: "Q3.12 Upload: Gaming machine reports (last 12 months)", type: "upload", uploadCategory: "OTHER" }),
      f({ name: "q3_12_upload_occupancy", label: "Q3.12 Upload: Accommodation occupancy reports (last 12 months)", type: "upload", uploadCategory: "OTHER" }),
      f({ name: "q3_12_upload_licence_certs", label: "Q3.12 Upload: Licence certificates / permits", type: "upload", uploadCategory: "LEGAL" }),
    ],
  },
  {
    key: "property_assets",
    title: "Property & Physical Assets",
    subtitle: "Bricks, land, equipment — what's included in the sale.",
    description: "Define tenure, physical assets, and near-term capex.",
    estimatedMinutes: 5,
    helpText: "Step 4 of 7",
    fields: [
      f({ name: "q4_1_land_size_sqm", label: "Q4.1 Land Size (sqm)", type: "number" }),
      f({ name: "q4_2_building_area_sqm", label: "Q4.2 Total Building Area (sqm)", type: "number" }),
      f({ name: "q4_3_car_parks", label: "Q4.3 Number of Car Parks / Parking Spaces", type: "number" }),
      f({ name: "q4_4_council_zoning", label: "Q4.4 Council Zoning (if known)", type: "text" }),
      f({ name: "q4_5_lga", label: "Q4.5 Local Government Area (LGA)", type: "text" }),
      f({ name: "q4_6_heritage_listed", label: "Q4.6 Is the property heritage listed?", type: "single_select", required: true, options: ["Yes", "No", "Unsure"] }),
      f({ name: "q4_7_tenure", label: "Q4.7 Tenure", type: "single_select", required: true, options: ["Freehold", "Leasehold"] }),
      f({ name: "q4_8_lease_years_remaining", label: "Q4.8 Years Remaining on Lease", type: "number", required: true, condition: { field: "q4_7_tenure", equals: "Leasehold" } }),
      f({ name: "q4_9_lease_options", label: "Q4.9 Option Periods Available", type: "text", placeholder: "e.g., 2 × 5 years", condition: { field: "q4_7_tenure", equals: "Leasehold" } }),
      f({ name: "q4_10_annual_rent_ex_gst", label: "Q4.10 Annual Rent (ex GST)", type: "currency", required: true, condition: { field: "q4_7_tenure", equals: "Leasehold" } }),
      f({ name: "q4_11_rent_review_mechanism", label: "Q4.11 Rent Review Mechanism", type: "single_select", required: true, options: ["CPI", "Fixed Increase", "Market Review", "Other"], condition: { field: "q4_7_tenure", equals: "Leasehold" } }),
      f({ name: "q4_11_other", label: "Q4.11 Please specify", type: "text", required: true, condition: { field: "q4_11_rent_review_mechanism", equals: "Other" } }),
      f({ name: "q4_12_outgoings_included", label: "Q4.12 Are outgoings included in rent?", type: "single_select", required: true, options: ["Yes", "No"], condition: { field: "q4_7_tenure", equals: "Leasehold" } }),
      f({ name: "q4_13_landlord_name", label: "Q4.13 Landlord Name (optional)", type: "text", condition: { field: "q4_7_tenure", equals: "Leasehold" } }),
      f({
        name: "q4_14_assets_included",
        label: "Q4.14 Assets Included in Sale",
        type: "multi_select",
        required: true,
        options: [
          "Plant & Equipment",
          "Furniture, Fixtures & Fittings",
          "POS / Technology Systems",
          "Vehicles",
          "Stock at Valuation (SAV)",
          "Manager's Residence / Accommodation",
          "Intellectual Property (brand, website, socials)",
          "Customer Database / Mailing Lists",
          "Other",
        ],
      }),
      f({ name: "q4_14_other", label: "Q4.14 Please specify", type: "text", required: true, condition: { field: "q4_14_assets_included", equals: "Other" } }),
      f({ name: "q4_15_estimated_plant_equipment_value", label: "Q4.15 Estimated Value of Plant & Equipment", type: "currency" }),
      f({ name: "q4_16_estimated_sav", label: "Q4.16 Estimated Stock Value (SAV)", type: "currency" }),
      f({ name: "q4_17_equipment_condition", label: "Q4.17 Age / Condition of Key Equipment", type: "textarea", placeholder: "e.g., commercial kitchen 3 years old, cool room replaced 2022, roof refurbished 2020" }),
      f({ name: "q4_18_capex_required", label: "Q4.18 Any known capital expenditure required in the next 12 months?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q4_19_capex_detail", label: "Q4.19 Describe the capital expenditure needed", type: "textarea", required: true, condition: { field: "q4_18_capex_required", equals: "Yes" } }),
      f({ name: "q4_20_upload_lease", label: "Q4.20 Upload: Lease agreement (if leasehold)", type: "upload", uploadCategory: "LEGAL", condition: { field: "q4_7_tenure", equals: "Leasehold" } }),
      f({ name: "q4_20_upload_site_plans", label: "Q4.20 Upload: Site plans / floor plans", type: "upload", uploadCategory: "PROPERTY" }),
      f({ name: "q4_20_upload_council_docs", label: "Q4.20 Upload: Council approvals / DA documents", type: "upload", uploadCategory: "LEGAL" }),
      f({ name: "q4_20_upload_fire", label: "Q4.20 Upload: Fire compliance / safety certificates", type: "upload", uploadCategory: "LEGAL" }),
      f({ name: "q4_20_upload_asset_register", label: "Q4.20 Upload: Equipment / asset register", type: "upload", uploadCategory: "PROPERTY" }),
      f({ name: "q4_20_upload_building_report", label: "Q4.20 Upload: Recent building inspection or valuation report", type: "upload", uploadCategory: "PROPERTY" }),
    ],
  },
  {
    key: "performance_growth",
    title: "Performance & Growth Opportunity",
    subtitle: "Tell us the story behind the numbers.",
    description: "Capture strategic upside and buyer-fit narrative.",
    estimatedMinutes: 5,
    helpText: "Step 5 of 7",
    fields: [
      f({ name: "q5_1_performance_drivers", label: "Q5.1 What has driven performance over the last 3 years?", type: "textarea", required: true, placeholder: "e.g., renovations, menu overhaul, new accommodation, regional population growth, tourism increase" }),
      f({ name: "q5_2_unpursued_growth", label: "Q5.2 What growth opportunities exist that you have NOT pursued?", type: "textarea", required: true, placeholder: "e.g., adding breakfast service, expanding accommodation, online ordering, catering, events" }),
      f({ name: "q5_3_capped_complexity", label: "Q5.3 Have you deliberately capped complexity or scale?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q5_4_capped_detail", label: "Q5.4 Explain how you've capped the business", type: "textarea", required: true, condition: { field: "q5_3_capped_complexity", equals: "Yes" }, placeholder: "e.g., chose not to open for breakfast, limited function bookings, didn't add accommodation" }),
      f({ name: "q5_5_development_upside", label: "Q5.5 Is there development or expansion upside on the site?", type: "single_select", required: true, options: ["Yes", "No", "Unsure"] }),
      f({ name: "q5_6_development_detail", label: "Q5.6 Describe the development upside", type: "textarea", required: true, condition: { field: "q5_5_development_upside", equals: "Yes" }, placeholder: "e.g., DA-approved expansion, subdivision potential, unused land, council pre-approval" }),
      f({ name: "q5_7_revenue_stabiliser", label: "Q5.7 What is the business's strongest revenue stabiliser?", type: "textarea", required: true, placeholder: "e.g., gaming revenue, long-term accommodation contracts, government contracts, only venue in town" }),
      f({ name: "q5_8_operational_friction", label: "Q5.8 What operational friction would a new owner need to manage?", type: "textarea", required: true, placeholder: "e.g., staff turnover, regional logistics, compliance burden, seasonal downturn, remote location" }),
      f({ name: "q5_9_best_buyer_fit", label: "Q5.9 What type of buyer would be the best fit for this asset?", type: "multi_select", required: true, options: ["Experienced operator / hands-on owner", "Investor / passive owner with manager in place", "First-time buyer with industry ambition", "Corporate / group acquisition", "Other"] }),
      f({ name: "q5_9_other", label: "Q5.9 Please specify", type: "text", required: true, condition: { field: "q5_9_best_buyer_fit", equals: "Other" } }),
    ],
  },
  {
    key: "market_compliance",
    title: "Market & Compliance Context",
    subtitle: "Positioning, competition, and disclosure context.",
    description: "Capture defensibility, legal context, and compliance status.",
    estimatedMinutes: 5,
    helpText: "Step 6 of 7",
    fields: [
      f({ name: "q6_1_customer_base", label: "Q6.1 Primary Customer Base", type: "multi_select", required: true, options: ["Locals / Regulars", "Tourists / Holiday Visitors", "Trade & FIFO Workers", "Passing Traffic / Highway", "Destination Dining / Events", "Corporate / Business Travellers", "Mixed"] }),
      f({ name: "q6_2_catchment", label: "Q6.2 Approximate Customer Catchment Radius", type: "single_select", required: true, options: ["< 5km", "5–20km", "20–50km", "Regional / State-wide"] }),
      f({ name: "q6_3_competitors", label: "Q6.3 Main Competitors (names and locations, if any)", type: "textarea" }),
      f({ name: "q6_4_defensibility", label: "Q6.4 What makes this business defensible or hard to replicate?", type: "textarea", required: true, placeholder: "e.g., only pub in town, heritage building, exclusive gaming entitlements, waterfront position, council restrictions on new licences" }),
      f({ name: "q6_5_awards_media", label: "Q6.5 Has the business received any awards or notable media coverage?", type: "textarea" }),
      f({ name: "q6_6_legal_disputes", label: "Q6.6 Any current legal disputes, claims, or pending litigation?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q6_7_compliance_issues", label: "Q6.7 Any outstanding compliance issues (health, fire, liquor, building)?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q6_8_environmental_issues", label: "Q6.8 Any environmental contamination, remediation orders, or concerns?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q6_9_encumbrances", label: "Q6.9 Any encumbrances, caveats, or registered interests on the title?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q6_10_contracts_assume", label: "Q6.10 Any existing contracts that a buyer would need to assume?", type: "single_select", required: true, options: ["Yes", "No"], helperText: "e.g., supplier agreements, entertainment contracts, council agreements" }),
      f({
        name: "q6_11_yes_details",
        label: "Q6.11 Provide details for any 'Yes' answers above",
        type: "textarea",
        required: true,
        condition: {
          anyEquals: [
            { field: "q6_6_legal_disputes", equals: "Yes" },
            { field: "q6_7_compliance_issues", equals: "Yes" },
            { field: "q6_8_environmental_issues", equals: "Yes" },
            { field: "q6_9_encumbrances", equals: "Yes" },
            { field: "q6_10_contracts_assume", equals: "Yes" },
          ],
        },
      }),
      f({ name: "q6_12_upload_title", label: "Q6.12 Upload: Title search / certificate of title", type: "upload", uploadCategory: "LEGAL" }),
      f({ name: "q6_12_upload_council_correspondence", label: "Q6.12 Upload: Recent council correspondence", type: "upload", uploadCategory: "LEGAL" }),
      f({ name: "q6_12_upload_compliance_notices", label: "Q6.12 Upload: Relevant compliance notices or certificates", type: "upload", uploadCategory: "LEGAL" }),
    ],
  },
  {
    key: "media_pricing_final",
    title: "Media, Pricing & Final Details",
    subtitle: "Almost done. Photos, pricing expectations, and next steps.",
    description: "Upload media, define terms, and complete declaration.",
    estimatedMinutes: 5,
    helpText: "Step 7 of 7",
    fields: [
      f({ name: "q7_1_upload_photos", label: "Q7.1 Upload Photos (minimum 10)", type: "upload", uploadCategory: "PROPERTY", required: true, helperText: "Accepted formats: JPG, PNG, HEIC" }),
      f({ name: "q7_2_upload_video", label: "Q7.2 Upload Video Walkthrough", type: "upload", uploadCategory: "PROPERTY", helperText: "Accepted formats: MP4, MOV" }),
      f({ name: "q7_3_upload_im", label: "Q7.3 Upload Existing IM or Marketing Material", type: "upload", uploadCategory: "OTHER" }),
      f({ name: "q7_4_upload_additional", label: "Q7.4 Upload Additional Documents", type: "upload", uploadCategory: "OTHER" }),
      f({ name: "q7_5_indicative_price", label: "Q7.5 Indicative Price Expectation", type: "currency", required: true }),
      f({ name: "q7_6_price_firmness", label: "Q7.6 Is this price:", type: "single_select", required: true, options: ["Firm", "Negotiable", "Seeking Guidance"] }),
      f({ name: "q7_7_price_basis", label: "Q7.7 How was this figure determined?", type: "multi_select", required: true, options: ["Independent valuation", "Accountant's advice", "Market comparison", "Multiple of earnings", "Own estimate", "Other"] }),
      f({ name: "q7_7_other", label: "Q7.7 Please specify", type: "text", required: true, condition: { field: "q7_7_price_basis", equals: "Other" } }),
      f({ name: "q7_8_sale_timeline", label: "Q7.8 Preferred Sale Timeline", type: "single_select", required: true, options: ["Immediate", "3–6 months", "6–12 months", "Flexible"] }),
      f({ name: "q7_9_vendor_finance", label: "Q7.9 Would you consider vendor finance or structured terms?", type: "single_select", required: true, options: ["Yes", "No", "Open to discussion"] }),
      f({ name: "q7_10_earnout", label: "Q7.10 Would you consider an earn-out arrangement?", type: "single_select", required: true, options: ["Yes", "No", "Unsure"] }),
      f({ name: "q7_11_handover", label: "Q7.11 Is there a transition / handover period you'd offer a buyer?", type: "single_select", required: true, options: ["Yes", "No"] }),
      f({ name: "q7_12_handover_length", label: "Q7.12 How long is the handover period?", type: "text", required: true, condition: { field: "q7_11_handover", equals: "Yes" }, placeholder: "e.g., 4 weeks, 3 months" }),
      f({ name: "q7_13_anything_else", label: "Q7.13 Anything else your brokerage team should know?", type: "textarea" }),
      f({ name: "q7_14_declaration_truth", label: "Q7.14 Declaration: Information is true and correct", type: "boolean", required: true }),
      f({ name: "q7_14_declaration_authorised", label: "Q7.14 Declaration: I am authorised to provide this information", type: "boolean", required: true }),
      f({ name: "q7_14_declaration_consent", label: "Q7.14 Declaration: I consent to my brokerage using this information to prepare marketing materials and present to qualified buyers", type: "boolean", required: true }),
      f({ name: "q7_14_declaration_third_party", label: "Q7.14 Declaration: My brokerage may engage third-party professionals to verify information where required", type: "boolean", required: true }),
      f({ name: "q7_14_declaration_acl", label: "Q7.14 Declaration: I acknowledge disclosure obligations under ACL/state legislation", type: "boolean", required: true }),
      f({ name: "q7_15_full_name", label: "Q7.15 Full Name", type: "text", required: true }),
      f({ name: "q7_16_position", label: "Q7.16 Position / Authority", type: "text", required: true, placeholder: "e.g., Owner, Director, Authorised Representative" }),
      f({ name: "q7_17_phone", label: "Q7.17 Phone", type: "phone", required: true }),
      f({ name: "q7_18_email", label: "Q7.18 Email", type: "email", required: true }),
      f({ name: "q7_19_signature", label: "Q7.19 E-Signature", type: "signature", required: true }),
      f({ name: "q7_20_date", label: "Q7.20 Date", type: "date", required: true }),
    ],
  },
];
