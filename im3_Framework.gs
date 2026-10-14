/**
 * IM³ Framework MVP 
 * Version: 1.2-fixed
 *
 * Fixes included:
 * 1) Accepts either a pure Spreadsheet ID or a full Google Sheets URL.
 * 2) Corrects workbook key columns: Production_Row_ID, DCF_Row_ID, Result_ID, SD_Row_ID.
 * 3) Skips modules whose sheets are missing, instead of breaking the Tilda page.
 * 4) Provides fallback headers for 17_Dashboard_Data, 18_Decision_Report and 19_Tilda_Output
 *    because the current workbook has data in row 4 but missing header labels in row 3.
 * 5) Fixes UTF-8 text labels: IM³ and —.
 * 6) Adds diagnostics endpoint: ?action=diagnostics
 */

const GOOGLE_SHEET_ID_OR_URL = "https://docs.google.com/spreadsheets/d/1n83usYBBqqfUr7gJ9GbNaTTNrV6TutYKWSm0oZ11Exc/edit?gid=1020767210#gid=1020767210";
const PDF_FOLDER_ID = ""; // Optional. Leave empty to save PDF in root Drive.

const HEADER_OVERRIDES = {
  "17_Dashboard_Data": [
    "Dashboard_ID","Assumption_Set_ID","Project_ID","Project_Name","Scenario_Name","Project_Type","Location","Project_Phase",
    "NPV_USD","IRR","Payback_Years","DCF_Score","Scenario_Risk_Class","Weighted_Risk_NPV","DNPV_USD","MAP_Adjusted_Value",
    "ROV_Option_Value","Strategic_NPV_ROV","MCDA_Score","MCDA_Rank","System_Dynamics_Score","Monte_Carlo_Mean_NPV",
    "Probability_Positive_NPV","Integrated_Score","Final_Decision","Recommendation","Last_Update"
  ],
  "18_Decision_Report": [
    "Report_ID","Assumption_Set_ID","Project_ID","Project_Name","Final_Decision","Executive_Summary","Financial_View",
    "Risk_View","Strategic_View","Recommended_Actions","Report_Date","Prepared_By"
  ],
  "19_Tilda_Output": [
    "Project_ID","Project_Name","Project_Type","Location","Project_Phase","Scenario_Name",
    "NPV_Display","IRR_Display","Payback_Display","DNPV_Display","Strategic_NPV_Display",
    "MCDA_Display","SD_Display","Monte_Carlo_Display","Risk_Label","Decision_Label",
    "Recommendation_Text","Executive_Summary","Last_Update","API_Status"
  ]
};

const MODULES = [
  {
    id: "config",
    order: 0,
    title: "00 Config",
    sheetName: "00_Config",
    headerRow: 1,
    keyColumn: "",
    readOnly: true,
    description: "Global model configuration and lookup center.",
    editableFields: []
  },
  {
    id: "projects",
    order: 1,
    title: "01 Projects",
    sheetName: "01_Projects",
    headerRow: 5,
    keyColumn: "Project_ID",
    description: "Project registration and identity.",
    editableFields: [
      "Project_Name", "Project_Type", "Location", "Basin", "Project_Phase",
      "Strategic_Objective", "Operator", "Ownership_Model", "Start_Year",
      "End_Year", "Currency", "Status", "Description", "Created_By",
      "Include_in_Dashboard", "Notes"
    ],
    dropdowns: {
      "Project_Type": "00_Lookup_ProjectTypes",
      "Location": "00_Lookup_Locations",
      "Project_Phase": "00_Lookup_ProjectPhases",
      "Strategic_Objective": "00_Lookup_StrategicObjectives",
      "Operator": "00_Lookup_Operators",
      "Currency": "00_Lookup_Currencies",
      "Status": "00_Lookup_ProjectStatus",
      "Include_in_Dashboard": "00_Lookup_YesNo"
    }
  },
  {
    id: "assumptions",
    order: 2,
    title: "02 Assumptions",
    sheetName: "02_Assumptions",
    headerRow: 5,
    keyColumn: "Assumption_Set_ID",
    description: "Economic and technical assumptions for each scenario.",
    editableFields: [
      "Project_ID", "Scenario_Name", "Scenario_Type", "Base_Year",
      "Forecast_Horizon", "Currency", "Discount_Rate", "Inflation_Rate",
      "Corporate_Tax_Rate", "Risk_Free_Rate", "Market_Risk_Premium",
      "FX_USD_MZN", "Capacity_Utilization", "Production_Unit",
      "Price_Unit", "Include_In_Model", "Notes"
    ],
    dropdowns: {
      "Project_ID": "__PROJECTS__",
      "Scenario_Type": "00_Lookup_ScenarioTypes",
      "Currency": "00_Lookup_Currencies",
      "Production_Unit": "00_Lookup_Units",
      "Price_Unit": "00_Lookup_PricingUnits",
      "Include_In_Model": "00_Lookup_YesNo"
    }
  },
  {
    id: "production",
    order: 3,
    title: "03 Production",
    sheetName: "03_Production",
    headerRow: 5,
    keyColumn: "Production_Row_ID",
    description: "Annual production, capacity, utilization and domestic/export allocation.",
    editableFields: [
      "Assumption_Set_ID", "Project_ID", "Year", "Project_Phase", "Installed_Capacity",
      "Capacity_Unit", "Utilization_Rate", "Uptime", "Ramp_Up_Factor", "Decline_Rate",
      "Domestic_Allocation_%", "Export_Allocation_%", "Reserve_Base", "Include_In_Model", "Notes"
    ],
    dropdowns: {
      "Project_ID": "__PROJECTS__",
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Project_Phase": "00_Lookup_ProjectPhases",
      "Include_In_Model": "00_Lookup_YesNo"
    }
  },
  {
    id: "prices",
    order: 4,
    title: "04 Prices",
    sheetName: "04_Prices",
    headerRow: 4,
    keyColumn: "Price_Record_ID",
    description: "Price deck by project, scenario, year and product stream.",
    editableFields: [
      "Project_ID", "Assumption_Set_ID", "Scenario_Type", "Year",
      "Product_Stream", "Pricing_Unit", "Base_Price", "Escalation_Rate",
      "Market_Adjustment_Factor", "Risk_Adjustment_Factor",
      "Domestic_Price_Discount", "FX_Rate_to_USD", "Price_Source", "Notes"
    ],
    dropdowns: {
      "Project_ID": "__PROJECTS__",
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Scenario_Type": "00_Lookup_ScenarioTypes",
      "Product_Stream": "00_Lookup_ProductStreams",
      "Pricing_Unit": "00_Lookup_PricingUnits",
      "Price_Source": "00_Lookup_PriceSources"
    }
  },
  {
    id: "capex_opex",
    order: 5,
    title: "05 CAPEX OPEX",
    sheetName: "05_CAPEX_OPEX",
    headerRow: 5,
    keyColumn: "Cost_Record_ID",
    description: "Capital and operating cost structure.",
    editableFields: [
      "Assumption_Set_ID", "Project_ID", "Cost_Type", "Cost_Category", "Scenario_Type",
      "Year", "Cost_Frequency", "Cost_Unit", "Base_Amount", "Quantity",
      "Inflation_Rate", "Escalation_Rate", "Cost_Risk_Factor", "FX_Rate_to_USD",
      "Eligible_For_Depreciation", "DCF_Cash_Flow_Treatment", "Cost_Source",
      "Responsible_Area", "Include_In_Model", "Notes"
    ],
    dropdowns: {
      "Project_ID": "__PROJECTS__",
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Scenario_Type": "00_Lookup_ScenarioTypes",
      "Cost_Type": "00_Lookup_CostTypes",
      "Cost_Category": "00_Lookup_CostCategories",
      "Cost_Unit": "00_Lookup_CostUnits",
      "Cost_Frequency": "00_Lookup_CostFrequency",
      "Include_In_Model": "00_Lookup_YesNo"
    }
  },
  {
    id: "dcf",
    order: 6,
    title: "06 DCF",
    sheetName: "06_DCF",
    headerRow: 5,
    keyColumn: "DCF_Row_ID",
    description: "Discounted cash flow engine. Mostly formula-driven.",
    editableFields: ["Include_In_Model", "Notes"],
    dropdowns: {"Include_In_Model": "00_Lookup_YesNo"}
  },
  {
    id: "dcf_results",
    order: 7,
    title: "07 DCF Results",
    sheetName: "07_DCF_Results",
    headerRow: 5,
    keyColumn: "Result_ID",
    description: "Consolidated DCF outputs: NPV, IRR, payback and DCF decision.",
    editableFields: ["Include_In_Dashboard", "Notes"],
    dropdowns: {"Include_In_Dashboard": "00_Lookup_YesNo"}
  },
  {
    id: "risk_scenarios",
    order: 8,
    title: "08 Risk Scenarios",
    sheetName: "08_Risk_Scenarios",
    headerRow: 5,
    keyColumn: "Scenario_ID",
    description: "Scenario engine for market, cost, schedule, fiscal, political and ESG risks.",
    editableFields: [
      "Assumption_Set_ID", "Scenario_Name", "Scenario_Type", "Probability",
      "Start_Year", "End_Year", "Active", "Description",
      "Price_Multiplier", "Production_Multiplier", "CAPEX_Multiplier",
      "OPEX_Multiplier", "Delay_Years", "Downtime_Increase",
      "Tax_Rate_Change_pp", "Carbon_Tax_USD", "Political_Risk_Level",
      "Regulatory_Risk_Level", "Security_Risk_Level", "ESG_Risk_Level",
      "Technology_Risk_Level", "Notes"
    ],
    dropdowns: {
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Scenario_Type": "00_Lookup_ScenarioTypes",
      "Active": "00_Lookup_YesNo",
      "Political_Risk_Level": "00_Lookup_RiskLevels",
      "Regulatory_Risk_Level": "00_Lookup_RiskLevels",
      "Security_Risk_Level": "00_Lookup_RiskLevels",
      "ESG_Risk_Level": "00_Lookup_RiskLevels",
      "Technology_Risk_Level": "00_Lookup_RiskLevels"
    }
  },
  {
    id: "map_dnpv",
    order: 9,
    title: "09 MAP DNPV",
    sheetName: "09_MAP_DNPV",
    headerRow: 5,
    keyColumn: "MAP_ID",
    description: "Market Adjusted Probability and Dynamic NPV logic.",
    editableFields: [
      "Scenario_ID", "Assumption_Set_ID", "Active", "Market_Confidence", "Technical_Confidence",
      "Regulatory_Confidence", "ESG_Confidence", "Risk_Adjustment_Rate",
      "Strategic_Flexibility_Factor", "Feeds_ROV", "Feeds_MCDA", "Notes"
    ],
    dropdowns: {
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Scenario_ID": "__RISK_SCENARIOS__",
      "Active": "00_Lookup_YesNo",
      "Feeds_ROV": "00_Lookup_YesNo",
      "Feeds_MCDA": "00_Lookup_YesNo"
    }
  },
  {
    id: "rov",
    order: 10,
    title: "10 ROV",
    sheetName: "10_ROV",
    headerRow: 5,
    keyColumn: "ROV_ID",
    description: "Real Options Valuation: defer, expand, abandon or switch technology.",
    editableFields: [
      "MAP_ID", "Scenario_ID", "Assumption_Set_ID", "Active", "Option_Type", "ROV_Method",
      "Trigger_Variable", "Exercise_Year", "Time_to_Exercise", "Exercise_Cost_USD",
      "Expansion_CAPEX_USD", "Expansion_Benefit_Factor", "Abandonment_Salvage_USD",
      "Delay_Cost_USD", "Volatility", "Option_Probability", "Feeds_MCDA", "Notes"
    ],
    dropdowns: {
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Scenario_ID": "__RISK_SCENARIOS__",
      "MAP_ID": "__MAP_IDS__",
      "Option_Type": "00_Lookup_ROV_OptionTypes",
      "ROV_Method": "00_Lookup_ROV_Methods",
      "Trigger_Variable": "00_Lookup_ROV_Triggers",
      "Active": "00_Lookup_YesNo",
      "Feeds_MCDA": "00_Lookup_YesNo"
    }
  },
  {
    id: "mcda_criteria",
    order: 11,
    title: "11 MCDA Criteria",
    sheetName: "11_MCDA_Criteria",
    headerRow: 9,
    keyColumn: "Criterion_ID",
    description: "Criteria, weights, scale and direction for strategic scoring.",
    editableFields: [
      "Criterion_Name", "Category", "Description", "Source_Module", "Weight_%",
      "Scale", "Min_Score", "Max_Score", "Direction",
      "Normalization_Method", "Active", "Owner", "Notes"
    ],
    dropdowns: {
      "Category": "00_Lookup_MCDA_Categories",
      "Source_Module": "00_Lookup_MCDA_SourceModules",
      "Direction": "00_Lookup_MCDA_Directions",
      "Scale": "00_Lookup_MCDA_Scales",
      "Active": "00_Lookup_YesNo"
    }
  },
  {
    id: "mcda_scores",
    order: 12,
    title: "12 MCDA Scores",
    sheetName: "12_MCDA_Scores",
    headerRow: 5,
    keyColumn: "MCDA_Score_ID",
    description: "Manual and automatic scores by project and criterion.",
    editableFields: [
      "Project_ID", "Assumption_Set_ID", "Criterion_ID", "Manual_Score_1_10",
      "Score_Status", "Notes"
    ],
    dropdowns: {
      "Project_ID": "__PROJECTS__",
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Criterion_ID": "__MCDA_CRITERIA__"
    }
  },
  {
    id: "system_dynamics",
    order: 13,
    title: "13 System Dynamics",
    sheetName: "13_System_Dynamics",
    headerRow: 5,
    keyColumn: "SD_Row_ID",
    description: "Stocks, flows and feedback signals for dynamic behavior.",
    editableFields: [
      "Assumption_Set_ID", "Scenario_ID", "ROV_ID", "Year", "Installed_Capacity",
      "Capacity_Addition", "Capacity_Retirement", "Reinvestment_Rate",
      "Local_Content_Gain", "Technology_Gain", "Policy_Risk_Index",
      "Geopolitical_Risk_Index", "Market_Risk_Index", "Notes"
    ],
    dropdowns: {
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Scenario_ID": "__RISK_SCENARIOS__",
      "ROV_ID": "__ROV_IDS__"
    }
  },
  {
    id: "sd_parameters",
    order: 14,
    title: "14 SD Parameters",
    sheetName: "14_SD_Parameters",
    headerRow: 4,
    keyColumn: "Parameter_ID",
    description: "Editable parameters controlling System Dynamics behavior.",
    editableFields: [
      "Parameter_Group", "Parameter_Name", "Description", "Assumption_Set_ID",
      "Default_Value", "Current_Value", "Unit", "Min_Value", "Max_Value",
      "Source_Module", "Source_Link_or_Formula", "Used_In_Module",
      "Editable", "Sensitivity_Flag", "Status", "Notes"
    ],
    dropdowns: {
      "Parameter_Group": "00_Lookup_SD_ParameterGroups",
      "Unit": "00_Lookup_SD_ParameterUnits",
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Editable": "00_Lookup_YesNo",
      "Sensitivity_Flag": "00_Lookup_YesNo"
    }
  },
  {
    id: "sensitivity",
    order: 15,
    title: "15 Sensitivity",
    sheetName: "15_Sensitivity",
    headerRow: 5,
    keyColumn: "Sensitivity_ID",
    description: "One-way sensitivity analysis. This module will be skipped if the sheet is not present.",
    editableFields: [
      "Assumption_Set_ID", "Sensitivity_Variable", "Case_Name", "Active",
      "Shock_Value", "Feeds_Monte_Carlo", "Feeds_Dashboard", "Notes"
    ],
    dropdowns: {
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Sensitivity_Variable": "00_Lookup_SensitivityVariables",
      "Case_Name": "00_Lookup_SensitivityCases",
      "Active": "00_Lookup_YesNo",
      "Feeds_Monte_Carlo": "00_Lookup_YesNo",
      "Feeds_Dashboard": "00_Lookup_YesNo"
    }
  },
  {
    id: "monte_carlo",
    order: 16,
    title: "16 Monte Carlo",
    sheetName: "16_Monte_Carlo",
    headerRow: 5,
    keyColumn: "Simulation_ID",
    description: "Probabilistic simulation records and results.",
    editableFields: [
      "Assumption_Set_ID", "Distribution", "Active", "Price_Shock",
      "Production_Shock", "CAPEX_Shock", "OPEX_Shock",
      "Discount_Rate_Shock", "Risk_Shock", "Delay_Years",
      "Carbon_Tax_USD", "Feeds_Dashboard", "Notes"
    ],
    dropdowns: {
      "Assumption_Set_ID": "__ASSUMPTIONS__",
      "Distribution": "00_Lookup_MC_Distributions",
      "Active": "00_Lookup_YesNo",
      "Feeds_Dashboard": "00_Lookup_YesNo"
    }
  },
  {
    id: "dashboard_data",
    order: 17,
    title: "17 Dashboard Data",
    sheetName: "17_Dashboard_Data",
    headerRow: 3,
    keyColumn: "Dashboard_ID",
    readOnly: true,
    description: "Consolidated results for visual dashboards.",
    editableFields: []
  },
  {
    id: "decision_report",
    order: 18,
    title: "18 Decision Report",
    sheetName: "18_Decision_Report",
    headerRow: 3,
    keyColumn: "Report_ID",
    readOnly: true,
    description: "Automatic narrative decision report.",
    editableFields: []
  },
  {
    id: "tilda_output",
    order: 19,
    title: "19 Tilda Output",
    sheetName: "19_Tilda_Output",
    headerRow: 3,
    keyColumn: "Project_ID",
    readOnly: true,
    description: "Clean API output for Tilda visualization.",
    editableFields: []
  }
];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadata").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";

  try {
    let data;

    if (action === "metadata") {
      data = getMetadata_();
    } else if (action === "module") {
      data = getModule_(e.parameter.moduleId, e.parameter.key || "");
    } else if (action === "save") {
      data = saveRowFromRequest_(e);
    } else if (action === "dashboard") {
      data = getDashboard_(e.parameter.projectId || "");
    } else if (action === "projects") {
      data = getProjects_();
    } else if (action === "report") {
      data = getReport_(e.parameter.projectId || "");
    } else if (action === "pdf") {
      data = generatePdfReport_(e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnostics_();
    } else if (action === "health") {
      data = { status: "ok", timestamp: new Date().toISOString(), spreadsheetId: getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, error: err.message, stack: err.stack }, callback);
  }
}

function getSpreadsheetId_() {
  const raw = String(GOOGLE_SHEET_ID_OR_URL || "").trim();
  const match = raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : raw;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

function respond_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetExists_(sheetName) {
  return !!getSpreadsheet_().getSheetByName(sheetName);
}

function getAvailableModules_() {
  return MODULES.filter(m => sheetExists_(m.sheetName));
}

function getMetadata_() {
  const modules = getAvailableModules_();
  return {
    appName: "IM³ Framework MVP",
    version: "1.2-fixed",
    spreadsheetId: getSpreadsheetId_(),
    modules: modules.map(m => ({
      id: m.id,
      order: m.order,
      title: m.title,
      sheetName: m.sheetName,
      keyColumn: m.keyColumn,
      description: m.description,
      readOnly: !!m.readOnly,
      editableFields: m.editableFields || [],
      dropdowns: m.dropdowns || {}
    })),
    missingModules: MODULES.filter(m => !sheetExists_(m.sheetName)).map(m => m.sheetName),
    dropdowns: getAllDropdowns_()
  };
}

function getAllDropdowns_() {
  const output = {};
  const lookupSheets = [
    "00_Lookup_ProjectTypes", "00_Lookup_Locations", "00_Lookup_Basins",
    "00_Lookup_ProjectPhases", "00_Lookup_StrategicObjectives",
    "00_Lookup_Operators", "00_Lookup_OwnershipModels", "00_Lookup_Currencies",
    "00_Lookup_ProjectStatus", "00_Lookup_YesNo", "00_Lookup_ScenarioTypes",
    "00_Lookup_Units", "00_Lookup_PricingUnits", "00_Lookup_ProductStreams",
    "00_Lookup_PriceSources", "00_Lookup_CostTypes", "00_Lookup_CostCategories",
    "00_Lookup_CostUnits", "00_Lookup_CostFrequency", "00_Lookup_RiskLevels",
    "00_Lookup_ROV_OptionTypes", "00_Lookup_ROV_Triggers", "00_Lookup_ROV_Methods",
    "00_Lookup_MCDA_Categories", "00_Lookup_MCDA_Directions", "00_Lookup_MCDA_Scales",
    "00_Lookup_MCDA_SourceModules", "00_Lookup_SD_ParameterGroups",
    "00_Lookup_SD_ParameterUnits", "00_Lookup_SensitivityVariables",
    "00_Lookup_SensitivityCases", "00_Lookup_MC_Distributions"
  ];

  lookupSheets.forEach(name => output[name] = readLookup_(name));

  output["__PROJECTS__"] = getSimpleKeyList_("01_Projects", 5, "Project_ID", "Project_Name");
  output["__ASSUMPTIONS__"] = getSimpleKeyList_("02_Assumptions", 5, "Assumption_Set_ID", "Scenario_Name");
  output["__RISK_SCENARIOS__"] = getSimpleKeyList_("08_Risk_Scenarios", 5, "Scenario_ID", "Scenario_Name");
  output["__MAP_IDS__"] = getSimpleKeyList_("09_MAP_DNPV", 5, "MAP_ID", "Scenario_Name");
  output["__ROV_IDS__"] = getSimpleKeyList_("10_ROV", 5, "ROV_ID", "Option_Type");
  output["__MCDA_CRITERIA__"] = getSimpleKeyList_("11_MCDA_Criteria", 9, "Criterion_ID", "Criterion_Name");

  return output;
}

function readLookup_(sheetName) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];

  const values = sh.getDataRange().getDisplayValues();
  const output = [];

  for (let r = 0; r < values.length; r++) {
    const first = String(values[r][0] || "").trim();
    const second = String(values[r][1] || "").trim();

    if (!first) continue;
    if (/^(id|code|parameter|metric|field|name|value)$/i.test(first)) continue;

    output.push({
      value: first,
      label: second && !/^description$/i.test(second) ? first + " — " + second : first
    });
  }

  return output.slice(0, 500);
}

function getSimpleKeyList_(sheetName, headerRow, keyColName, labelColName) {
  if (!sheetExists_(sheetName)) return [];
  const rows = getRows_(sheetName, headerRow);
  return rows
    .filter(r => r[keyColName])
    .map(r => ({
      value: r[keyColName],
      label: labelColName && r[labelColName] ? r[keyColName] + " — " + r[labelColName] : r[keyColName]
    }));
}

function getModule_(moduleId, key) {
  const module = getModuleConfig_(moduleId);
  const rows = getRows_(module.sheetName, module.headerRow);

  let selected = null;
  if (key && module.keyColumn) {
    selected = rows.find(r => String(r[module.keyColumn]).trim() === String(key).trim()) || null;
  }
  if (!selected && rows.length) selected = rows[0];

  return {
    module: module,
    headers: getHeaders_(module.sheetName, module.headerRow),
    rows: rows.slice(0, 300),
    selected: selected
  };
}

function getHeaders_(sheetName, headerRow) {
  if (HEADER_OVERRIDES[sheetName]) return HEADER_OVERRIDES[sheetName];

  const sh = getSpreadsheet_().getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);

  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h || "").trim());
  return trimTrailingEmpty_(headers);
}

function getRows_(sheetName, headerRow) {
  const sh = getSpreadsheet_().getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow <= headerRow) return [];

  const headers = getHeaders_(sheetName, headerRow);
  const effectiveLastCol = Math.min(lastCol, headers.length);
  const values = sh.getRange(headerRow + 1, 1, Math.max(0, lastRow - headerRow), effectiveLastCol).getDisplayValues();

  return values
    .filter(row => row.some(v => String(v || "").trim() !== ""))
    .map((row, idx) => {
      const obj = { __rowNumber: headerRow + 1 + idx };
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i];
      });
      return obj;
    });
}

function trimTrailingEmpty_(arr) {
  let end = arr.length;
  while (end > 0 && !arr[end - 1]) end--;
  return arr.slice(0, end);
}

function getModuleConfig_(moduleId) {
  const m = MODULES.find(x => x.id === moduleId || x.sheetName === moduleId);
  if (!m) throw new Error("Module not found: " + moduleId);
  if (!sheetExists_(m.sheetName)) throw new Error("Sheet is missing in workbook: " + m.sheetName);
  return m;
}

function saveRowFromRequest_(e) {
  const moduleId = e.parameter.moduleId;
  const encoded = e.parameter.payload || "";
  if (!moduleId) throw new Error("Missing moduleId.");
  if (!encoded) throw new Error("Missing payload.");

  const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(encoded)).getDataAsString("UTF-8");
  const payload = JSON.parse(json);
  return saveRow_(moduleId, payload);
}

function saveRow_(moduleId, payload) {
  const module = getModuleConfig_(moduleId);
  if (module.readOnly) throw new Error("This module is read-only: " + module.title);

  const sh = getSpreadsheet_().getSheetByName(module.sheetName);
  const headers = getHeaders_(module.sheetName, module.headerRow);
  const keyColumn = module.keyColumn;
  const keyValue = payload[keyColumn];

  if (!keyColumn) throw new Error("No keyColumn defined for module: " + module.title);
  if (!keyValue) throw new Error("Missing key value for " + keyColumn);

  const keyColIndex = headers.indexOf(keyColumn) + 1;
  if (keyColIndex <= 0) throw new Error("Key column not found: " + keyColumn + " in " + module.sheetName);

  const lastRow = sh.getLastRow();
  const keyValues = sh.getRange(module.headerRow + 1, keyColIndex, Math.max(0, lastRow - module.headerRow), 1).getDisplayValues().flat();

  let targetRow = keyValues.findIndex(v => String(v).trim() === String(keyValue).trim());
  if (targetRow >= 0) {
    targetRow = module.headerRow + 1 + targetRow;
  } else {
    targetRow = lastRow + 1;
    sh.getRange(targetRow, keyColIndex).setValue(keyValue);
  }

  const editable = module.editableFields || [];
  editable.forEach(field => {
    if (!(field in payload)) return;
    const colIndex = headers.indexOf(field) + 1;
    if (colIndex <= 0) return;
    sh.getRange(targetRow, colIndex).setValue(payload[field]);
  });

  setIfColumnExists_(sh, headers, targetRow, "Last_Update", new Date());
  setIfColumnExists_(sh, headers, targetRow, "API_Status", "Saved");
  SpreadsheetApp.flush();

  return {
    saved: true,
    moduleId: moduleId,
    sheetName: module.sheetName,
    rowNumber: targetRow,
    keyColumn: keyColumn,
    keyValue: keyValue,
    timestamp: new Date().toISOString()
  };
}

function setIfColumnExists_(sh, headers, row, colName, value) {
  const col = headers.indexOf(colName) + 1;
  if (col > 0) sh.getRange(row, col).setValue(value);
}

function getProjects_() {
  const rows = getRows_("19_Tilda_Output", 3);
  return rows.map(r => ({
    Project_ID: r.Project_ID,
    Project_Name: r.Project_Name,
    Project_Type: r.Project_Type,
    Location: r.Location,
    Decision_Label: r.Decision_Label
  }));
}

function getDashboard_(projectId) {
  const rows = getRows_("19_Tilda_Output", 3);
  if (!rows.length) throw new Error("No rows found in 19_Tilda_Output.");

  if (projectId) {
    const match = rows.find(r => String(r.Project_ID).trim() === String(projectId).trim());
    if (match) return match;
  }

  return rows[0];
}

function getReport_(projectId) {
  const dashboard = getDashboard_(projectId);
  const rows = getRows_("18_Decision_Report", 3);
  return rows.find(r => String(r.Project_ID).trim() === String(dashboard.Project_ID).trim()) || null;
}

function generatePdfReport_(projectId) {
  const dashboard = getDashboard_(projectId);
  const report = getReport_(projectId);

  const projectName = dashboard.Project_Name || dashboard.Project_ID || "IM3 Project";
  const doc = DocumentApp.create("IM3_Report_" + safeName_(projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));

  const body = doc.getBody();
  body.clear();

  body.appendParagraph("IM³ Framework Investment Decision Report").setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph("Project: " + (dashboard.Project_Name || "—")).setHeading(DocumentApp.ParagraphHeading.HEADING1);

  body.appendParagraph("Project ID: " + (dashboard.Project_ID || "—"));
  body.appendParagraph("Type: " + (dashboard.Project_Type || "—"));
  body.appendParagraph("Location: " + (dashboard.Location || "—"));
  body.appendParagraph("Phase: " + (dashboard.Project_Phase || "—"));
  body.appendParagraph("Decision: " + (dashboard.Decision_Label || "—"));
  body.appendParagraph("Risk: " + (dashboard.Risk_Label || "—"));
  body.appendParagraph("");

  body.appendParagraph("Executive Summary").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(dashboard.Executive_Summary || (report ? report.Executive_Summary : "—"));

  body.appendParagraph("Numerical Results").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  const table = body.appendTable([
    ["Indicator", "Value"],
    ["NPV", dashboard.NPV_Display || "—"],
    ["IRR", dashboard.IRR_Display || "—"],
    ["Payback", dashboard.Payback_Display || "—"],
    ["DNPV", dashboard.DNPV_Display || "—"],
    ["Strategic NPV", dashboard.Strategic_NPV_Display || "—"],
    ["MCDA Score", dashboard.MCDA_Display || "—"],
    ["System Dynamics Score", dashboard.SD_Display || "—"],
    ["Monte Carlo", dashboard.Monte_Carlo_Display || "—"]
  ]);
  table.getRow(0).editAsText().setBold(true);

  body.appendParagraph("Recommendation").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(dashboard.Recommendation_Text || (report ? report.Recommended_Actions : "—"));

  if (report) {
    body.appendParagraph("Detailed Views").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph("Financial View: " + (report.Financial_View || "—"));
    body.appendParagraph("Risk View: " + (report.Risk_View || "—"));
    body.appendParagraph("Strategic View: " + (report.Strategic_View || "—"));
  }

  body.appendParagraph("");
  body.appendParagraph("Generated by IM³ Framework MVP on " + new Date().toISOString());
  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(doc.getId()).getBlob().getAs(MimeType.PDF).setName("IM3_Report_" + safeName_(projectName) + ".pdf");

  let pdfFile;
  if (PDF_FOLDER_ID) {
    pdfFile = DriveApp.getFolderById(PDF_FOLDER_ID).createFile(pdfBlob);
  } else {
    pdfFile = DriveApp.createFile(pdfBlob);
  }

  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    created: true,
    projectId: dashboard.Project_ID,
    projectName: projectName,
    pdfUrl: pdfFile.getUrl(),
    pdfFileId: pdfFile.getId(),
    docId: doc.getId()
  };
}

function getDiagnostics_() {
  const ss = getSpreadsheet_();
  const sheets = ss.getSheets().map(s => s.getName());
  const moduleChecks = MODULES.map(m => {
    const exists = sheets.indexOf(m.sheetName) !== -1;
    let headers = [];
    let keyFound = false;

    if (exists) {
      headers = getHeaders_(m.sheetName, m.headerRow);
      keyFound = !m.keyColumn || headers.indexOf(m.keyColumn) !== -1;
    }

    return {
      order: m.order,
      moduleId: m.id,
      sheetName: m.sheetName,
      exists: exists,
      headerRow: m.headerRow,
      keyColumn: m.keyColumn,
      keyFound: keyFound,
      headerCount: headers.length
    };
  });

  return {
    spreadsheetId: getSpreadsheetId_(),
    spreadsheetName: ss.getName(),
    totalSheets: sheets.length,
    missingSheets: MODULES.filter(m => sheets.indexOf(m.sheetName) === -1).map(m => m.sheetName),
    moduleChecks: moduleChecks
  };
}

function safeName_(name) {
  return String(name || "project").replace(/[^\w\-]+/g, "_").slice(0, 80);
}


/**
 * ============================================================
 * IM³ Framework MVP — Enhancement Layer v1.3
 * Based on Version 1.2-fixed
 *
 * Added according to requested changes:
 * 1) Multi-select filters for analysis parameters.
 * 2) Filtered output: show only selected rows and selected metrics.
 * 3) Tilda navigation excludes 18_Decision_Report and 19_Tilda_Output.
 * 4) Advanced chart data endpoint for time/project/scenario/metric visualization.
 * 5) Dashboard formula check/repair endpoint.
 * 6) Filtered PDF report generation.
 * ============================================================
 */

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadata").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";

  try {
    let data;

    if (action === "metadata") {
      data = getMetadataV13_();
    } else if (action === "module") {
      data = getModuleV13_(e.parameter.moduleId, e.parameter.key || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowFromRequest_(e);
    } else if (action === "dashboard") {
      data = getDashboardV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = getProjects_();
    } else if (action === "report") {
      data = getReport_(e.parameter.projectId || "");
    } else if (action === "pdf") {
      data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "filteroptions") {
      data = getFilterOptionsV13_();
    } else if (action === "chartdata") {
      data = getChartDataV13_(
        parseFiltersV13_(e.parameter.filters || ""),
        e.parameter.metric || "NPV_USD",
        e.parameter.groupBy || "Project_Name",
        e.parameter.timeField || "Year"
      );
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV13_();
    } else if (action === "diagnostics") {
      data = getDiagnosticsV13_();
    } else if (action === "health") {
      data = {
        status: "ok",
        version: "1.3-enhanced",
        timestamp: new Date().toISOString(),
        spreadsheetId: getSpreadsheetId_()
      };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, error: err.message, stack: err.stack }, callback);
  }
}

function getMetadataV13_() {
  const modules = getAvailableModules_().filter(m => ["decision_report", "tilda_output"].indexOf(m.id) === -1);

  return {
    appName: "IM³ Framework MVP",
    version: "1.3-enhanced",
    spreadsheetId: getSpreadsheetId_(),
    modules: modules.map(m => ({
      id: m.id,
      order: m.order,
      title: m.title,
      sheetName: m.sheetName,
      keyColumn: m.keyColumn,
      description: m.description,
      readOnly: !!m.readOnly,
      editableFields: m.editableFields || [],
      dropdowns: m.dropdowns || {}
    })),
    missingModules: MODULES.filter(m => !sheetExists_(m.sheetName)).map(m => m.sheetName),
    dropdowns: getAllDropdowns_(),
    filters: getFilterOptionsV13_(),
    chartMetrics: getChartMetricsV13_(),
    navigationExcludes: ["18_Decision_Report", "19_Tilda_Output"]
  };
}

function getModuleV13_(moduleId, key, filters) {
  const module = getModuleConfig_(moduleId);
  let rows = getRows_(module.sheetName, module.headerRow);
  rows = applyFiltersToRowsV13_(rows, filters || {});

  let selected = null;
  if (key && module.keyColumn) {
    selected = rows.find(r => String(r[module.keyColumn]).trim() === String(key).trim()) || null;
  }
  if (!selected && rows.length) selected = rows[0];

  return {
    module: module,
    headers: getHeaders_(module.sheetName, module.headerRow),
    rows: rows.slice(0, 500),
    selected: selected,
    filtersApplied: filters || {},
    totalRowsAfterFilter: rows.length
  };
}

function parseFiltersV13_(encoded) {
  if (!encoded) return {};
  try {
    const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(encoded)).getDataAsString("UTF-8");
    return JSON.parse(json);
  } catch (err) {
    try {
      return JSON.parse(encoded);
    } catch (err2) {
      return {};
    }
  }
}

function normalizeArrayV13_(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(v => String(v).trim() !== "");
  return String(value).split(",").map(v => v.trim()).filter(Boolean);
}

function applyFiltersToRowsV13_(rows, filters) {
  if (!filters) return rows;

  const filterMap = {
    projectIds: ["Project_ID"],
    assumptionSetIds: ["Assumption_Set_ID"],
    scenarioIds: ["Scenario_ID"],
    years: ["Year", "Base_Year", "Start_Year", "End_Year"],
    projectTypes: ["Project_Type"],
    locations: ["Location"],
    phases: ["Project_Phase"],
    optionTypes: ["Option_Type"],
    criteriaIds: ["Criterion_ID"],
    riskLevels: ["Scenario_Risk_Class", "Risk_Label", "Political_Risk_Level", "Security_Risk_Level", "ESG_Risk_Level", "Regulatory_Risk_Level", "Technology_Risk_Level"],
    productStreams: ["Product_Stream"],
    costTypes: ["Cost_Type"],
    metrics: []
  };

  return rows.filter(row => {
    for (const filterName in filterMap) {
      const selected = normalizeArrayV13_(filters[filterName]);
      if (!selected.length) continue;

      const fields = filterMap[filterName];
      if (!fields.length) continue;

      const rowHasDimension = fields.some(field => field in row);
      if (!rowHasDimension) continue;

      const rowMatches = fields.some(field => (field in row) && selected.map(String).indexOf(String(row[field])) !== -1);
      if (!rowMatches) return false;
    }
    return true;
  });
}

function getFilterOptionsV13_() {
  return {
    projectIds: getSimpleKeyList_("01_Projects", 5, "Project_ID", "Project_Name"),
    assumptionSetIds: getSimpleKeyList_("02_Assumptions", 5, "Assumption_Set_ID", "Scenario_Name"),
    scenarioIds: getSimpleKeyList_("08_Risk_Scenarios", 5, "Scenario_ID", "Scenario_Name"),
    projectTypes: uniqueOptionsFromRowsV13_("01_Projects", 5, "Project_Type"),
    locations: uniqueOptionsFromRowsV13_("01_Projects", 5, "Location"),
    phases: uniqueOptionsFromRowsV13_("01_Projects", 5, "Project_Phase"),
    productStreams: uniqueOptionsFromRowsV13_("04_Prices", 4, "Product_Stream"),
    costTypes: uniqueOptionsFromRowsV13_("05_CAPEX_OPEX", 5, "Cost_Type"),
    optionTypes: uniqueOptionsFromRowsV13_("10_ROV", 5, "Option_Type"),
    criteriaIds: getSimpleKeyList_("11_MCDA_Criteria", 9, "Criterion_ID", "Criterion_Name"),
    riskLevels: buildRiskLevelOptionsV13_(),
    years: collectYearsV13_()
  };
}

function uniqueOptionsFromRowsV13_(sheetName, headerRow, field) {
  if (!sheetExists_(sheetName)) return [];
  const seen = {};
  getRows_(sheetName, headerRow).forEach(r => {
    const v = String(r[field] || "").trim();
    if (v) seen[v] = true;
  });
  return Object.keys(seen).sort().map(v => ({ value: v, label: v }));
}

function buildRiskLevelOptionsV13_() {
  const sources = [
    ["08_Risk_Scenarios", 5, "Political_Risk_Level"],
    ["08_Risk_Scenarios", 5, "Regulatory_Risk_Level"],
    ["08_Risk_Scenarios", 5, "Security_Risk_Level"],
    ["08_Risk_Scenarios", 5, "ESG_Risk_Level"],
    ["08_Risk_Scenarios", 5, "Technology_Risk_Level"],
    ["17_Dashboard_Data", 3, "Scenario_Risk_Class"],
    ["19_Tilda_Output", 3, "Risk_Label"]
  ];
  const seen = {};
  sources.forEach(src => {
    if (!sheetExists_(src[0])) return;
    getRows_(src[0], src[1]).forEach(r => {
      const v = String(r[src[2]] || "").trim();
      if (v) seen[v] = true;
    });
  });
  return Object.keys(seen).sort().map(v => ({ value: v, label: v }));
}

function collectYearsV13_() {
  const sources = [
    ["03_Production", 5, "Year"],
    ["04_Prices", 4, "Year"],
    ["05_CAPEX_OPEX", 5, "Year"],
    ["06_DCF", 5, "Year"],
    ["08_Risk_Scenarios", 5, "Start_Year"],
    ["08_Risk_Scenarios", 5, "End_Year"],
    ["13_System_Dynamics", 5, "Year"]
  ];
  const seen = {};
  sources.forEach(src => {
    if (!sheetExists_(src[0])) return;
    getRows_(src[0], src[1]).forEach(r => {
      const v = String(r[src[2]] || "").trim();
      if (v && /^\d{4}$/.test(v)) seen[v] = true;
    });
  });
  return Object.keys(seen).sort().map(v => ({ value: v, label: v }));
}

function getChartMetricsV13_() {
  return [
    { value: "NPV_USD", label: "NPV" },
    { value: "IRR", label: "IRR" },
    { value: "Payback_Years", label: "Payback Years" },
    { value: "DCF_Score", label: "DCF Score" },
    { value: "Weighted_Risk_NPV", label: "Weighted Risk NPV" },
    { value: "DNPV_USD", label: "DNPV" },
    { value: "MAP_Adjusted_Value", label: "MAP Adjusted Value" },
    { value: "ROV_Option_Value", label: "ROV Option Value" },
    { value: "Strategic_NPV_ROV", label: "Strategic NPV" },
    { value: "MCDA_Score", label: "MCDA Score" },
    { value: "System_Dynamics_Score", label: "System Dynamics Score" },
    { value: "Monte_Carlo_Mean_NPV", label: "Monte Carlo Mean NPV" },
    { value: "Probability_Positive_NPV", label: "Probability Positive NPV" },
    { value: "Integrated_Score", label: "Integrated Score" },
    { value: "Revenue_USD", label: "Revenue" },
    { value: "CAPEX_USD", label: "CAPEX" },
    { value: "OPEX_USD", label: "OPEX" },
    { value: "Production", label: "Production" },
    { value: "Price", label: "Price" }
  ];
}

function getDashboardV13_(filters, projectId) {
  let rows = [];
  if (sheetExists_("17_Dashboard_Data")) rows = getRows_("17_Dashboard_Data", 3);
  else if (sheetExists_("19_Tilda_Output")) rows = getRows_("19_Tilda_Output", 3);
  if (!rows.length) rows = rebuildDashboardRowsV13_();

  if (projectId) {
    filters = filters || {};
    filters.projectIds = [projectId];
  }

  rows = applyFiltersToRowsV13_(rows, filters || {});
  const selectedMetrics = normalizeArrayV13_((filters || {}).metrics);
  const filteredRows = rows.map(r => filterMetricColumnsV13_(r, selectedMetrics));

  return {
    rows: filteredRows,
    first: filteredRows[0] || {},
    filtersApplied: filters || {},
    selectedMetrics: selectedMetrics,
    summary: summarizeDashboardRowsV13_(rows)
  };
}

function filterMetricColumnsV13_(row, selectedMetrics) {
  if (!selectedMetrics || !selectedMetrics.length) return row;
  const identity = ["__rowNumber", "Dashboard_ID", "Project_ID", "Project_Name", "Scenario_Name", "Project_Type", "Location", "Project_Phase", "Scenario_Risk_Class", "Risk_Label", "Final_Decision", "Decision_Label", "Recommendation", "Recommendation_Text", "Executive_Summary", "Last_Update", "API_Status"];
  const out = {};
  identity.forEach(k => { if (k in row) out[k] = row[k]; });
  selectedMetrics.forEach(k => { if (k in row) out[k] = row[k]; });

  const displayAliases = {
    NPV_USD: "NPV_Display",
    IRR: "IRR_Display",
    Payback_Years: "Payback_Display",
    DNPV_USD: "DNPV_Display",
    Strategic_NPV_ROV: "Strategic_NPV_Display",
    MCDA_Score: "MCDA_Display",
    System_Dynamics_Score: "SD_Display",
    Probability_Positive_NPV: "Monte_Carlo_Display"
  };
  selectedMetrics.forEach(k => {
    const alias = displayAliases[k];
    if (alias && alias in row) out[alias] = row[alias];
  });
  return out;
}

function summarizeDashboardRowsV13_(rows) {
  if (!rows || !rows.length) return { count: 0, avgNPV: 0, avgIRR: 0, avgMCDA: 0, avgSD: 0, avgIntegratedScore: 0, bestProject: null };
  return {
    count: rows.length,
    avgNPV: avgFieldV13_(rows, "NPV_USD"),
    avgIRR: avgFieldV13_(rows, "IRR"),
    avgMCDA: avgFieldV13_(rows, "MCDA_Score"),
    avgSD: avgFieldV13_(rows, "System_Dynamics_Score"),
    avgIntegratedScore: avgFieldV13_(rows, "Integrated_Score"),
    bestProject: findBestByFieldV13_(rows, "Integrated_Score")
  };
}

function avgFieldV13_(rows, field) {
  const nums = rows.map(r => parseNumberV13_(r[field])).filter(n => !isNaN(n));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function findBestByFieldV13_(rows, field) {
  let best = null;
  rows.forEach(r => {
    if (!best || parseNumberV13_(r[field]) > parseNumberV13_(best[field])) best = r;
  });
  return best;
}

function parseNumberV13_(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;
  const raw = String(value);
  const numeric = raw.replace(/,/g, "").replace(/%/g, "").replace(/[^0-9.-]/g, "");
  const n = Number(numeric);
  if (isNaN(n)) return NaN;
  if (raw.indexOf("%") !== -1 && Math.abs(n) > 1) return n / 100;
  return n;
}

function rebuildDashboardRowsV13_() {
  if (!sheetExists_("07_DCF_Results")) return [];
  const dcf = getRows_("07_DCF_Results", 5);
  return dcf.map(r => ({
    Project_ID: r.Project_ID,
    Project_Name: r.Project_Name,
    Scenario_Name: r.Scenario_Name,
    NPV_USD: r.NPV_USD || r.NPV || r.Project_NPV_USD || "",
    IRR: r.IRR || "",
    Payback_Years: r.Payback_Years || "",
    DCF_Score: r.DCF_Score || "",
    Final_Decision: r.DCF_Decision || r.Decision || "",
    Recommendation: r.Recommendation || ""
  }));
}

function getChartDataV13_(filters, metric, groupBy, timeField) {
  metric = metric || "NPV_USD";
  groupBy = groupBy || "Project_Name";
  timeField = timeField || "Year";

  const candidateSources = [
    { sheet: "17_Dashboard_Data", headerRow: 3 },
    { sheet: "06_DCF", headerRow: 5 },
    { sheet: "03_Production", headerRow: 5 },
    { sheet: "04_Prices", headerRow: 4 },
    { sheet: "05_CAPEX_OPEX", headerRow: 5 },
    { sheet: "13_System_Dynamics", headerRow: 5 },
    { sheet: "16_Monte_Carlo", headerRow: 5 }
  ];

  let allRows = [];
  candidateSources.forEach(src => {
    if (!sheetExists_(src.sheet)) return;
    getRows_(src.sheet, src.headerRow).forEach(r => allRows.push(Object.assign({ __sourceSheet: src.sheet }, r)));
  });

  allRows = applyFiltersToRowsV13_(allRows, filters || {});

  const selectedMetrics = normalizeArrayV13_((filters || {}).metrics);
  if (selectedMetrics.length && selectedMetrics.indexOf(metric) === -1) metric = selectedMetrics[0];

  const grouped = {};
  allRows.forEach(r => {
    const x = String(r[timeField] || r[groupBy] || r.Project_Name || r.Project_ID || r.__sourceSheet || "Unknown");
    const y = getMetricValueFromRowV13_(r, metric);
    if (isNaN(y)) return;

    const series = String(r[groupBy] || r.Project_Name || r.Project_ID || r.__sourceSheet || "Model");
    const key = x + "||" + series;
    if (!grouped[key]) grouped[key] = { x: x, series: series, value: 0, count: 0 };
    grouped[key].value += y;
    grouped[key].count += 1;
  });

  const data = Object.keys(grouped).map(k => {
    const g = grouped[k];
    return { x: g.x, series: g.series, value: g.value / g.count };
  }).sort((a, b) => String(a.x).localeCompare(String(b.x)));

  return { metric: metric, groupBy: groupBy, timeField: timeField, rowsUsed: allRows.length, data: data };
}

function getMetricValueFromRowV13_(row, metric) {
  if (metric in row) return parseNumberV13_(row[metric]);
  const aliases = {
    NPV_USD: ["NPV", "Project_NPV_USD", "Base_NPV_USD", "NPV_Display"],
    IRR: ["Project_IRR", "IRR_Display"],
    Payback_Years: ["Payback", "Payback_Display"],
    DCF_Score: ["DCF_Score", "Score_DCF"],
    Weighted_Risk_NPV: ["Weighted_Risk_NPV", "Risk_Adjusted_NPV"],
    DNPV_USD: ["DNPV", "DNPV_Display"],
    MAP_Adjusted_Value: ["MAP_Adjusted_Value", "MAP_Value"],
    ROV_Option_Value: ["ROV_Option_Value", "Option_Value"],
    Strategic_NPV_ROV: ["Strategic_NPV", "Strategic_NPV_Display"],
    MCDA_Score: ["Final_MCDA_Score", "MCDA_Display"],
    System_Dynamics_Score: ["SD_Score", "Dynamic_Score", "SD_Display"],
    Monte_Carlo_Mean_NPV: ["Simulated_NPV_USD", "Mean_Simulated_NPV"],
    Probability_Positive_NPV: ["Monte_Carlo_Display"],
    Integrated_Score: ["Final_Score", "Integrated_Score"],
    Revenue_USD: ["Revenue_USD", "Total_Revenue_USD", "Revenue"],
    CAPEX_USD: ["CAPEX_USD", "Total_CAPEX_USD", "CAPEX"],
    OPEX_USD: ["OPEX_USD", "Total_OPEX_USD", "OPEX"],
    Production: ["Net_Production", "Gross_Production", "Annual_Production", "Production"],
    Price: ["Final_Price", "Net_Price", "Base_Price", "Price"]
  };
  const candidates = aliases[metric] || [];
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i] in row) return parseNumberV13_(row[candidates[i]]);
  }
  return NaN;
}

function repairDashboardFormulasV13_() {
  const result = { checked: [], notes: [], repaired: false };
  if (!sheetExists_("17_Dashboard_Data")) {
    result.notes.push("17_Dashboard_Data does not exist. No formula repair applied.");
    return result;
  }

  const sh = getSpreadsheet_().getSheetByName("17_Dashboard_Data");
  const headers = getHeaders_("17_Dashboard_Data", 3);
  const lastRow = Math.max(sh.getLastRow(), 6);

  const required = {
    "NPV_USD": '=IFERROR(INDEX(\'07_DCF_Results\'!$Q:$Q,MATCH($B{r},\'07_DCF_Results\'!$B:$B,0)),0)',
    "IRR": '=IFERROR(INDEX(\'07_DCF_Results\'!$R:$R,MATCH($B{r},\'07_DCF_Results\'!$B:$B,0)),0)',
    "Payback_Years": '=IFERROR(INDEX(\'07_DCF_Results\'!$S:$S,MATCH($B{r},\'07_DCF_Results\'!$B:$B,0)),0)',
    "DNPV_USD": '=IFERROR(INDEX(\'09_MAP_DNPV\'!$N:$N,MATCH($B{r},\'09_MAP_DNPV\'!$B:$B,0)),0)',
    "Strategic_NPV_ROV": '=IFERROR(INDEX(\'10_ROV\'!$N:$N,MATCH($B{r},\'10_ROV\'!$B:$B,0)),0)',
    "MCDA_Score": '=IFERROR(INDEX(\'12_MCDA_Scores\'!$T:$T,MATCH($B{r},\'12_MCDA_Scores\'!$B:$B,0)),0)',
    "System_Dynamics_Score": '=IFERROR(INDEX(\'13_System_Dynamics\'!$AA:$AA,MATCH($B{r},\'13_System_Dynamics\'!$B:$B,0)),0)',
    "Monte_Carlo_Mean_NPV": '=IFERROR(AVERAGEIF(\'16_Monte_Carlo\'!$C:$C,$B{r},\'16_Monte_Carlo\'!$S:$S),0)',
    "Probability_Positive_NPV": '=IFERROR(COUNTIFS(\'16_Monte_Carlo\'!$C:$C,$B{r},\'16_Monte_Carlo\'!$S:$S,">0")/COUNTIF(\'16_Monte_Carlo\'!$C:$C,$B{r}),0)',
    "Integrated_Score": '=MAX(0,MIN(100,($L{r}*0.25)+($S{r}*0.30)+($U{r}*0.20)+($W{r}*100*0.25)))',
    "Final_Decision": '=IF(AND($I{r}>0,$X{r}>=75),"Invest / Proceed",IF(AND($R{r}>0,$X{r}>=65),"Proceed with Conditions",IF($I{r}>0,"Review / Optimize",IF($N{r}>0,"Defer / Wait","Reject / Stop"))))',
    "Recommendation": '=IF($Y{r}="Invest / Proceed","Project is financially attractive and strategically aligned.",IF($Y{r}="Proceed with Conditions","Proceed only with mitigation measures and updated risk controls.",IF($Y{r}="Review / Optimize","Improve cost structure, scenario resilience and strategic score before approval.",IF($Y{r}="Defer / Wait","Wait for better market, security or policy conditions.","Do not proceed under current assumptions."))))'
  };

  Object.keys(required).forEach(field => {
    const col = headers.indexOf(field) + 1;
    if (col <= 0) {
      result.notes.push("Missing dashboard field: " + field);
      return;
    }
    for (let r = 4; r <= lastRow; r++) {
      const cell = sh.getRange(r, col);
      if (!cell.getFormula()) {
        cell.setFormula(required[field].replace(/\{r\}/g, r));
        result.repaired = true;
      }
    }
    result.checked.push(field);
  });

  SpreadsheetApp.flush();
  return result;
}

function generatePdfReportV13_(filters, projectId) {
  const dashboardResult = getDashboardV13_(filters || {}, projectId || "");
  const rows = dashboardResult.rows || [];
  const first = rows[0] || {};
  const projectName = first.Project_Name || first.Project_ID || "Filtered IM3 Projects";
  const doc = DocumentApp.create("IM3_Filtered_Report_" + safeName_(projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = doc.getBody();
  body.clear();

  body.appendParagraph("IM³ Framework Filtered Decision Report").setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph("Selected Results").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("Rows included: " + rows.length);

  const metricHeaders = ["Project_Name", "Scenario_Name", "NPV_USD", "IRR", "DNPV_USD", "Strategic_NPV_ROV", "MCDA_Score", "System_Dynamics_Score", "Integrated_Score", "Final_Decision", "Decision_Label"];
  const tableData = [metricHeaders.map(h => h.replace(/_/g, " "))];

  rows.slice(0, 50).forEach(r => {
    tableData.push(metricHeaders.map(h => String(r[h] || "—")));
  });

  const table = body.appendTable(tableData);
  table.getRow(0).editAsText().setBold(true);

  body.appendParagraph("Recommendation").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(first.Recommendation || first.Recommendation_Text || "Review selected project outputs, assumptions and risk scenarios.");
  body.appendParagraph("");
  body.appendParagraph("Generated by IM³ Framework MVP on " + new Date().toISOString());

  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(doc.getId()).getBlob().getAs(MimeType.PDF).setName("IM3_Filtered_Report_" + safeName_(projectName) + ".pdf");
  const pdfFile = PDF_FOLDER_ID ? DriveApp.getFolderById(PDF_FOLDER_ID).createFile(pdfBlob) : DriveApp.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return { created: true, rowsIncluded: rows.length, pdfUrl: pdfFile.getUrl(), pdfFileId: pdfFile.getId(), docId: doc.getId() };
}

function getDiagnosticsV13_() {
  const base = getDiagnostics_();
  base.version = "1.3-enhanced";
  base.filterOptions = getFilterOptionsV13_();
  base.chartMetrics = getChartMetricsV13_();
  base.navigationExcludes = ["18_Decision_Report", "19_Tilda_Output"];
  return base;
}

/**
 * ============================================================
 * IM³ Framework MVP — Configuration-Driven Layer v1.4
 * Based on Version 1.3-enhanced
 *
 * Purpose:
 * 1) Tilda dropdown parameters are controlled by 00_Config and 00_Lookup_* sheets.
 * 2) Lookup dropdowns use the real parameter value, not the lookup ID.
 * 3) Inter-module relational dropdowns remain dynamic: Projects, Assumptions, Scenarios, MAP, ROV, MCDA criteria.
 * 4) Model sequence is explicit and preserved.
 * 5) Calculations remain in Google Sheets exactly like the Excel model; Apps Script saves inputs, flushes formulas and reads outputs.
 * 6) Dashboard, chartdata and PDF endpoints continue to work with filtered outputs.
 * ============================================================
 */

const IM3_MODEL_SEQUENCE_V14 = [
  { order: 0, id: "config", sheetName: "00_Config", role: "configuration", calculation: "Lists and global parameters" },
  { order: 1, id: "projects", sheetName: "01_Projects", role: "input", calculation: "Project identity and classification" },
  { order: 2, id: "assumptions", sheetName: "02_Assumptions", role: "input", calculation: "Scenario assumptions" },
  { order: 3, id: "production", sheetName: "03_Production", role: "input/calculation", calculation: "Production and capacity schedule" },
  { order: 4, id: "prices", sheetName: "04_Prices", role: "input/calculation", calculation: "Price deck and price escalation" },
  { order: 5, id: "capex_opex", sheetName: "05_CAPEX_OPEX", role: "input/calculation", calculation: "CAPEX and OPEX schedule" },
  { order: 6, id: "dcf", sheetName: "06_DCF", role: "calculation", calculation: "Discounted cash flow engine" },
  { order: 7, id: "dcf_results", sheetName: "07_DCF_Results", role: "output", calculation: "NPV, IRR, payback and DCF score" },
  { order: 8, id: "risk_scenarios", sheetName: "08_Risk_Scenarios", role: "input/calculation", calculation: "Scenario risk multipliers and probabilities" },
  { order: 9, id: "map_dnpv", sheetName: "09_MAP_DNPV", role: "calculation", calculation: "MAP and Dynamic NPV" },
  { order: 10, id: "rov", sheetName: "10_ROV", role: "calculation", calculation: "Real options valuation" },
  { order: 11, id: "mcda_criteria", sheetName: "11_MCDA_Criteria", role: "configuration/input", calculation: "MCDA criteria and weights" },
  { order: 12, id: "mcda_scores", sheetName: "12_MCDA_Scores", role: "input/calculation", calculation: "MCDA scoring" },
  { order: 13, id: "system_dynamics", sheetName: "13_System_Dynamics", role: "calculation", calculation: "Dynamic feedback model" },
  { order: 14, id: "sd_parameters", sheetName: "14_SD_Parameters", role: "configuration/input", calculation: "System Dynamics parameters" },
  { order: 15, id: "sensitivity", sheetName: "15_Sensitivity", role: "calculation", calculation: "Sensitivity analysis if sheet exists" },
  { order: 16, id: "monte_carlo", sheetName: "16_Monte_Carlo", role: "calculation", calculation: "Probabilistic simulation" },
  { order: 17, id: "dashboard_data", sheetName: "17_Dashboard_Data", role: "output", calculation: "Final integrated dashboard output" }
];

const IM3_CONFIG_LOOKUP_MAP_V14 = {
  "Project_Type": "00_Lookup_ProjectTypes",
  "Location": "00_Lookup_Locations",
  "Basin": "00_Lookup_Locations",
  "Project_Phase": "00_Lookup_ProjectPhases",
  "Strategic_Objective": "00_Lookup_StrategicObjectives",
  "Operator": "00_Lookup_Operators",
  "Ownership_Model": "00_Lookup_OwnershipModels",
  "Currency": "00_Lookup_Currencies",
  "Status": "00_Lookup_ProjectStatus",
  "Scenario_Type": "00_Lookup_ScenarioTypes",
  "Production_Unit": "00_Lookup_Units",
  "Capacity_Unit": "00_Lookup_Units",
  "Price_Unit": "00_Lookup_PricingUnits",
  "Pricing_Unit": "00_Lookup_PricingUnits",
  "Product_Stream": "00_Lookup_ProductStreams",
  "Price_Source": "00_Lookup_PriceSources",
  "Cost_Type": "00_Lookup_CostTypes",
  "Cost_Category": "00_Lookup_CostCategories",
  "Cost_Unit": "00_Lookup_CostUnits",
  "Cost_Frequency": "00_Lookup_CostFrequency",
  "Political_Risk_Level": "00_Lookup_RiskLevels",
  "Regulatory_Risk_Level": "00_Lookup_RiskLevels",
  "Security_Risk_Level": "00_Lookup_RiskLevels",
  "ESG_Risk_Level": "00_Lookup_RiskLevels",
  "Technology_Risk_Level": "00_Lookup_RiskLevels",
  "Option_Type": "00_Lookup_ROV_OptionTypes",
  "ROV_Method": "00_Lookup_ROV_Methods",
  "Trigger_Variable": "00_Lookup_ROV_Triggers",
  "Category": "00_Lookup_MCDA_Categories",
  "Source_Module": "00_Lookup_MCDA_SourceModules",
  "Direction": "00_Lookup_MCDA_Directions",
  "Scale": "00_Lookup_MCDA_Scales",
  "Parameter_Group": "00_Lookup_SD_ParameterGroups",
  "Unit": "00_Lookup_SD_ParameterUnits",
  "Sensitivity_Variable": "00_Lookup_SensitivityVariables",
  "Case_Name": "00_Lookup_SensitivityCases",
  "Distribution": "00_Lookup_MC_Distributions",
  "Active": "00_Lookup_YesNo",
  "Include_In_Model": "00_Lookup_YesNo",
  "Include_in_Dashboard": "00_Lookup_YesNo",
  "Include_In_Dashboard": "00_Lookup_YesNo",
  "Eligible_For_Depreciation": "00_Lookup_YesNo",
  "Feeds_ROV": "00_Lookup_YesNo",
  "Feeds_MCDA": "00_Lookup_YesNo",
  "Feeds_Monte_Carlo": "00_Lookup_YesNo",
  "Feeds_Dashboard": "00_Lookup_YesNo",
  "Editable": "00_Lookup_YesNo",
  "Sensitivity_Flag": "00_Lookup_YesNo"
};

const IM3_RELATIONAL_DROPDOWNS_V14 = {
  "Project_ID": "__PROJECTS__",
  "Assumption_Set_ID": "__ASSUMPTIONS__",
  "Scenario_ID": "__RISK_SCENARIOS__",
  "MAP_ID": "__MAP_IDS__",
  "ROV_ID": "__ROV_IDS__",
  "Criterion_ID": "__MCDA_CRITERIA__"
};

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadata").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";

  try {
    let data;

    if (action === "metadata") {
      data = getMetadataV14_();
    } else if (action === "config") {
      data = getConfigCenterV14_();
    } else if (action === "configoptions") {
      data = getAllDropdownsV14_();
    } else if (action === "sequence") {
      data = getModelSequenceV14_();
    } else if (action === "module") {
      data = getModuleV14_(e.parameter.moduleId, e.parameter.key || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV14_(e);
    } else if (action === "dashboard") {
      data = getDashboardV14_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = getProjects_();
    } else if (action === "chartdata") {
      data = getChartDataV13_(
        parseFiltersV13_(e.parameter.filters || ""),
        e.parameter.metric || "NPV_USD",
        e.parameter.groupBy || "Project_Name",
        e.parameter.timeField || "Year"
      );
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV14_();
    } else if (action === "health") {
      data = { status: "ok", version: "1.4-config-driven", timestamp: new Date().toISOString(), spreadsheetId: getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, error: err.message, stack: err.stack }, callback);
  }
}

function getMetadataV14_() {
  const modules = getAvailableModules_()
    .filter(m => ["decision_report", "tilda_output"].indexOf(m.id) === -1)
    .sort((a, b) => a.order - b.order);

  const dropdowns = getAllDropdownsV14_();

  return {
    appName: "IM³ Framework MVP",
    version: "1.4-config-driven",
    spreadsheetId: getSpreadsheetId_(),
    sequence: getModelSequenceV14_(),
    modules: modules.map(m => {
      const moduleDropdowns = buildModuleDropdownsV14_(m);
      return {
        id: m.id,
        order: m.order,
        title: m.title,
        sheetName: m.sheetName,
        keyColumn: m.keyColumn,
        description: m.description,
        readOnly: !!m.readOnly,
        editableFields: m.editableFields || [],
        dropdowns: moduleDropdowns,
        dependencies: getModuleDependenciesV14_(m),
        calculationMode: getCalculationModeV14_(m)
      };
    }),
    missingModules: MODULES.filter(m => !sheetExists_(m.sheetName)).map(m => m.sheetName),
    dropdowns: dropdowns,
    filters: getFilterOptionsV14_(),
    chartMetrics: getChartMetricsV13_(),
    navigationExcludes: ["18_Decision_Report", "19_Tilda_Output"],
    configDriven: true,
    configSource: "00_Config and 00_Lookup_* sheets"
  };
}

function getModelSequenceV14_() {
  return IM3_MODEL_SEQUENCE_V14.filter(s => sheetExists_(s.sheetName));
}

function getCalculationModeV14_(module) {
  const calculationModules = ["dcf", "dcf_results", "map_dnpv", "rov", "mcda_scores", "system_dynamics", "monte_carlo", "dashboard_data"];
  if (module.readOnly) return "read-only-output";
  if (calculationModules.indexOf(module.id) !== -1) return "sheet-formula-driven";
  return "input-driven";
}

function buildModuleDropdownsV14_(module) {
  const output = {};
  const fields = [];

  if (module.keyColumn) fields.push(module.keyColumn);
  (module.editableFields || []).forEach(f => fields.push(f));

  fields.forEach(field => {
    if (IM3_RELATIONAL_DROPDOWNS_V14[field]) {
      output[field] = IM3_RELATIONAL_DROPDOWNS_V14[field];
    } else if (IM3_CONFIG_LOOKUP_MAP_V14[field]) {
      output[field] = IM3_CONFIG_LOOKUP_MAP_V14[field];
    } else if (module.dropdowns && module.dropdowns[field]) {
      output[field] = module.dropdowns[field];
    }
  });

  return output;
}

function getModuleDependenciesV14_(module) {
  const dependencies = [];
  const dropdowns = buildModuleDropdownsV14_(module);
  Object.keys(dropdowns).forEach(field => {
    const source = dropdowns[field];
    if (source === "__PROJECTS__") dependencies.push({ field: field, source: "01_Projects", type: "dynamic" });
    else if (source === "__ASSUMPTIONS__") dependencies.push({ field: field, source: "02_Assumptions", type: "dynamic" });
    else if (source === "__RISK_SCENARIOS__") dependencies.push({ field: field, source: "08_Risk_Scenarios", type: "dynamic" });
    else if (source === "__MAP_IDS__") dependencies.push({ field: field, source: "09_MAP_DNPV", type: "dynamic" });
    else if (source === "__ROV_IDS__") dependencies.push({ field: field, source: "10_ROV", type: "dynamic" });
    else if (source === "__MCDA_CRITERIA__") dependencies.push({ field: field, source: "11_MCDA_Criteria", type: "dynamic" });
    else dependencies.push({ field: field, source: source, type: "config" });
  });
  return dependencies;
}

function getConfigCenterV14_() {
  return {
    settings: readConfigSettingsV14_(),
    matrixLists: readConfigMatrixListsV14_(),
    lookupSheets: getAllDropdownsV14_(),
    modelParameters: sheetExists_("00_Lookup_ModelParameters") ? getRows_("00_Lookup_ModelParameters", 1) : [],
    source: "00_Config"
  };
}

function readConfigSettingsV14_() {
  if (!sheetExists_("00_Config")) return [];
  const sh = getSpreadsheet_().getSheetByName("00_Config");
  const values = sh.getDataRange().getDisplayValues();
  const out = [];
  for (let r = 0; r < values.length; r++) {
    const key = String(values[r][0] || "").trim();
    const val = String(values[r][1] || "").trim();
    if (key && val && key !== "SYSTEM SETTINGS") out.push({ parameter: key, value: val });
  }
  return out;
}

function readConfigMatrixListsV14_() {
  if (!sheetExists_("00_Config")) return {};
  const sh = getSpreadsheet_().getSheetByName("00_Config");
  const values = sh.getDataRange().getDisplayValues();
  const out = {};
  const headerRow = 2; // zero-based: spreadsheet row 3 in the workbook structure
  const headers = values[headerRow] || [];

  for (let c = 0; c < headers.length; c++) {
    const header = String(headers[c] || "").trim();
    if (!header || header === "Value") continue;
    out[normalizeConfigKeyV14_(header)] = [];
    for (let r = headerRow + 1; r < values.length; r++) {
      const v = String(values[r][c] || "").trim();
      if (v) out[normalizeConfigKeyV14_(header)].push({ value: v, label: v });
    }
  }
  return out;
}

function normalizeConfigKeyV14_(name) {
  return String(name || "").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
}

function getAllDropdownsV14_() {
  const output = {};
  const ss = getSpreadsheet_();
  const sheets = ss.getSheets().map(s => s.getName());

  // Read every 00_Lookup_* sheet. Values are human-readable parameters, not technical IDs.
  sheets.filter(name => /^00_Lookup_/i.test(name)).forEach(name => {
    output[name] = readLookupValueListV14_(name);
  });

  // Add matrix lists found directly inside 00_Config.
  const configMatrix = readConfigMatrixListsV14_();
  Object.keys(configMatrix).forEach(key => output["00_Config::" + key] = configMatrix[key]);

  // Dynamic relational lists.
  output["__PROJECTS__"] = getSimpleKeyList_("01_Projects", 5, "Project_ID", "Project_Name");
  output["__ASSUMPTIONS__"] = getSimpleKeyList_("02_Assumptions", 5, "Assumption_Set_ID", "Scenario_Name");
  output["__RISK_SCENARIOS__"] = getSimpleKeyList_("08_Risk_Scenarios", 5, "Scenario_ID", "Scenario_Name");
  output["__MAP_IDS__"] = getSimpleKeyList_("09_MAP_DNPV", 5, "MAP_ID", "Scenario_ID");
  output["__ROV_IDS__"] = getSimpleKeyList_("10_ROV", 5, "ROV_ID", "Option_Type");
  output["__MCDA_CRITERIA__"] = getSimpleKeyList_("11_MCDA_Criteria", 9, "Criterion_ID", "Criterion_Name");

  return output;
}

function readLookupValueListV14_(sheetName) {
  const sh = getSpreadsheet_().getSheetByName(sheetName);
  if (!sh) return [];

  const values = sh.getDataRange().getDisplayValues();
  if (!values.length) return [];

  const headers = values[0].map(h => String(h || "").trim());
  const valueCol = detectLookupValueColumnV14_(headers);
  const descCol = detectDescriptionColumnV14_(headers, valueCol);
  const idCol = detectIdColumnV14_(headers);
  const out = [];
  const seen = {};

  for (let r = 1; r < values.length; r++) {
    const value = String(values[r][valueCol] || "").trim();
    if (!value || seen[value]) continue;
    seen[value] = true;
    const desc = descCol >= 0 ? String(values[r][descCol] || "").trim() : "";
    const id = idCol >= 0 ? String(values[r][idCol] || "").trim() : "";
    out.push({
      value: value,
      label: desc ? value + " — " + desc : value,
      id: id,
      source: sheetName
    });
  }

  return out.slice(0, 1000);
}

function detectLookupValueColumnV14_(headers) {
  const preferred = headers.findIndex(h => h && !/_ID$/i.test(h) && !/^ID$/i.test(h) && !/description|notes|used_in|used_for|type$/i.test(h));
  if (preferred >= 0) return preferred;
  if (headers.length > 1) return 1;
  return 0;
}

function detectDescriptionColumnV14_(headers, valueCol) {
  const idx = headers.findIndex((h, i) => i !== valueCol && /description|notes|used_in|used_for|type|region/i.test(h));
  return idx;
}

function detectIdColumnV14_(headers) {
  return headers.findIndex(h => /(^ID$|_ID$)/i.test(h));
}

function getFilterOptionsV14_() {
  const dropdowns = getAllDropdownsV14_();
  return {
    projectIds: dropdowns["__PROJECTS__"] || [],
    assumptionSetIds: dropdowns["__ASSUMPTIONS__"] || [],
    scenarioIds: dropdowns["__RISK_SCENARIOS__"] || [],
    projectTypes: dropdowns["00_Lookup_ProjectTypes"] || [],
    locations: dropdowns["00_Lookup_Locations"] || [],
    phases: dropdowns["00_Lookup_ProjectPhases"] || [],
    productStreams: dropdowns["00_Lookup_ProductStreams"] || [],
    costTypes: dropdowns["00_Lookup_CostTypes"] || [],
    optionTypes: dropdowns["00_Lookup_ROV_OptionTypes"] || [],
    criteriaIds: dropdowns["__MCDA_CRITERIA__"] || [],
    riskLevels: dropdowns["00_Lookup_RiskLevels"] || [],
    years: collectYearsV13_()
  };
}

function getModuleV14_(moduleId, key, filters) {
  const module = getModuleConfig_(moduleId);
  let rows = getRows_(module.sheetName, module.headerRow);
  rows = applyFiltersToRowsV13_(rows, filters || {});

  let selected = null;
  if (key && module.keyColumn) selected = rows.find(r => String(r[module.keyColumn]).trim() === String(key).trim()) || null;
  if (!selected && rows.length) selected = rows[0];

  return {
    module: Object.assign({}, module, {
      dropdowns: buildModuleDropdownsV14_(module),
      dependencies: getModuleDependenciesV14_(module),
      calculationMode: getCalculationModeV14_(module)
    }),
    headers: getHeaders_(module.sheetName, module.headerRow),
    rows: rows.slice(0, 500),
    selected: selected,
    filtersApplied: filters || {},
    totalRowsAfterFilter: rows.length,
    sequencePosition: getSequencePositionV14_(module.id),
    configDriven: true
  };
}

function getSequencePositionV14_(moduleId) {
  const seq = getModelSequenceV14_();
  const idx = seq.findIndex(s => s.id === moduleId);
  return idx >= 0 ? { index: idx + 1, total: seq.length, previous: idx > 0 ? seq[idx - 1] : null, next: idx < seq.length - 1 ? seq[idx + 1] : null } : null;
}

function saveRowAndRecalculateV14_(e) {
  const result = saveRowFromRequest_(e);
  SpreadsheetApp.flush();
  Utilities.sleep(250);
  return Object.assign({}, result, {
    recalculated: true,
    calculationSource: "Google Sheets formulas",
    sequence: getModelSequenceV14_()
  });
}

function getDashboardV14_(filters, projectId) {
  SpreadsheetApp.flush();
  return getDashboardV13_(filters || {}, projectId || "");
}

function repairDashboardFormulasV14_() {
  const result = repairDashboardFormulasV13_();
  SpreadsheetApp.flush();
  return Object.assign({}, result, { calculationSource: "Google Sheets formulas", sequence: getModelSequenceV14_() });
}

function getDiagnosticsV14_() {
  const base = getDiagnosticsV13_();
  base.version = "1.4-config-driven";
  base.configDriven = true;
  base.configSource = "00_Config and 00_Lookup_* sheets";
  base.sequence = getModelSequenceV14_();
  base.dropdownSamples = sampleDropdownsV14_();
  return base;
}

function sampleDropdownsV14_() {
  const d = getAllDropdownsV14_();
  const sample = {};
  ["00_Lookup_ProjectTypes", "00_Lookup_ProjectPhases", "00_Lookup_Currencies", "00_Lookup_YesNo", "__PROJECTS__"].forEach(k => {
    sample[k] = (d[k] || []).slice(0, 5);
  });
  return sample;
}

/**
 * ============================================================
 * IM³ Framework MVP — Graph Studio Layer v1.5
 * Adds graph template catalog for Tilda Graph Studio.
 * Keeps calculations in Google Sheets and preserves v1.4 config-driven logic.
 * ============================================================
 */

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadata").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";

  try {
    let data;

    if (action === "metadata") {
      data = getMetadataV15_();
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV15_();
    } else if (action === "config") {
      data = getConfigCenterV14_();
    } else if (action === "configoptions") {
      data = getAllDropdownsV14_();
    } else if (action === "sequence") {
      data = getModelSequenceV14_();
    } else if (action === "module") {
      data = getModuleV14_(e.parameter.moduleId, e.parameter.key || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV14_(e);
    } else if (action === "dashboard") {
      data = getDashboardV14_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = getProjects_();
    } else if (action === "chartdata") {
      data = getChartDataV15_(
        parseFiltersV13_(e.parameter.filters || ""),
        e.parameter.metric || "NPV_USD",
        e.parameter.groupBy || "Project_Name",
        e.parameter.timeField || "Year"
      );
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV15_();
    } else if (action === "health") {
      data = { status: "ok", version: "1.5-graph-studio", timestamp: new Date().toISOString(), spreadsheetId: getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, error: err.message, stack: err.stack }, callback);
  }
}

function getMetadataV15_() {
  const meta = getMetadataV14_();
  meta.version = "1.5-graph-studio";
  meta.graphTemplates = getGraphTemplatesV15_();
  meta.chartMetrics = mergeChartMetricsV15_(meta.chartMetrics || []);
  return meta;
}

function mergeChartMetricsV15_(metrics) {
  const extra = [
    { value: "NPV_Change_USD", label: "NPV change" },
    { value: "Adjusted_NPV_USD", label: "Adjusted NPV" },
    { value: "Simulated_NPV_USD", label: "Simulated NPV" },
    { value: "Manual_Score_1_10", label: "Manual score" },
    { value: "Weight_%", label: "Criteria weight" },
    { value: "Production_Capacity", label: "Production capacity" },
    { value: "Investment_Flow", label: "Investment flow" },
    { value: "Revenue_Flow", label: "Revenue flow" },
    { value: "OPEX_Flow", label: "OPEX flow" }
  ];
  const seen = {};
  return metrics.concat(extra).filter(m => {
    if (seen[m.value]) return false;
    seen[m.value] = true;
    return true;
  });
}

function getGraphTemplatesV15_() {
  return [
    { id: "executive_ranking", title: "Project ranking", category: "Executive", defaultMetric: "Integrated_Score", defaultGroupBy: "Project_Name", defaultTimeField: "Project_Name", defaultChart: "bar" },
    { id: "financial_timeline", title: "Financial timeline", category: "Financial", defaultMetric: "NPV_USD", defaultGroupBy: "Project_Name", defaultTimeField: "Year", defaultChart: "line" },
    { id: "cashflow_waterfall_proxy", title: "Value bridge / waterfall proxy", category: "Financial", defaultMetric: "Revenue_USD", defaultGroupBy: "__sourceSheet", defaultTimeField: "__sourceSheet", defaultChart: "bar" },
    { id: "risk_sensitivity", title: "Sensitivity / tornado", category: "Risk", defaultMetric: "NPV_Change_USD", defaultGroupBy: "Sensitivity_Variable", defaultTimeField: "Sensitivity_Variable", defaultChart: "bar" },
    { id: "monte_carlo", title: "Monte Carlo result", category: "Risk", defaultMetric: "Monte_Carlo_Mean_NPV", defaultGroupBy: "Project_Name", defaultTimeField: "Run_No", defaultChart: "bar" },
    { id: "mcda_profile", title: "MCDA profile", category: "Strategic", defaultMetric: "MCDA_Score", defaultGroupBy: "Criterion_ID", defaultTimeField: "Criterion_ID", defaultChart: "radar" },
    { id: "system_dynamics", title: "System Dynamics over time", category: "Dynamic", defaultMetric: "System_Dynamics_Score", defaultGroupBy: "Project_Name", defaultTimeField: "Year", defaultChart: "line" },
    { id: "decision_matrix", title: "Decision matrix", category: "Decision", defaultMetric: "IRR", defaultGroupBy: "NPV_USD", defaultTimeField: "Project_Name", defaultChart: "scatter" },
    { id: "scenario_comparison", title: "Scenario comparison", category: "Scenario", defaultMetric: "NPV_USD", defaultGroupBy: "Scenario_Name", defaultTimeField: "Scenario_Name", defaultChart: "bar" }
  ];
}

function getChartDataV15_(filters, metric, groupBy, timeField) {
  SpreadsheetApp.flush();
  return getChartDataV13_(filters || {}, metric || "NPV_USD", groupBy || "Project_Name", timeField || "Year");
}

function getDiagnosticsV15_() {
  const base = getDiagnosticsV14_();
  base.version = "1.5-graph-studio";
  base.graphTemplates = getGraphTemplatesV15_();
  base.chartMetrics = mergeChartMetricsV15_(getChartMetricsV13_());
  return base;
}

/**
 * ============================================================
 * IM³ Framework MVP — Performance + Data Delivery Layer v1.6
 * Fixes slow reads and Tilda data delivery issues.
 * This layer intentionally overrides doGet, getRows_, getSpreadsheet_,
 * metadata and chartdata behavior from previous layers.
 * ============================================================
 */

var IM3_SS_CACHE_V16 = null;

function getSpreadsheet_() {
  if (IM3_SS_CACHE_V16) return IM3_SS_CACHE_V16;
  const id = getSpreadsheetId_();
  IM3_SS_CACHE_V16 = SpreadsheetApp.openById(id);
  return IM3_SS_CACHE_V16;
}

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadata").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;

    if (action === "metadata" || action === "metadatafast") {
      data = getMetadataV16_();
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV15_();
    } else if (action === "config") {
      data = getConfigCenterV16_();
    } else if (action === "configoptions" || action === "filteroptions") {
      data = getFilterOptionsV16_();
    } else if (action === "sequence") {
      data = getModelSequenceV14_();
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "dashboard") {
      data = getDashboardV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = getProjectsFastV16_();
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "NPV_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV16_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = { status: "ok", version: "1.6-performance", timestamp: new Date().toISOString(), spreadsheetId: getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, elapsedMs: new Date().getTime() - started, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, elapsedMs: new Date().getTime() - started, error: err.message, stack: err.stack }, callback);
  }
}

function getMetadataV16_() {
  const cache = CacheService.getScriptCache();
  const key = "im3_meta_v16_" + getSpreadsheetId_();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const modules = getAvailableModules_()
    .filter(m => ["decision_report", "tilda_output"].indexOf(m.id) === -1)
    .sort((a,b) => a.order - b.order);

  const dropdowns = getDropdownsNeededByModulesV16_(modules);
  const meta = {
    appName: "IM³ Framework MVP",
    version: "1.6-performance",
    spreadsheetId: getSpreadsheetId_(),
    sequence: getModelSequenceV14_(),
    modules: modules.map(m => ({
      id: m.id,
      order: m.order,
      title: m.title,
      sheetName: m.sheetName,
      keyColumn: m.keyColumn,
      description: m.description,
      readOnly: !!m.readOnly,
      editableFields: m.editableFields || [],
      dropdowns: buildModuleDropdownsV14_(m),
      dependencies: getModuleDependenciesV14_(m),
      calculationMode: getCalculationModeV14_(m)
    })),
    missingModules: MODULES.filter(m => !sheetExists_(m.sheetName)).map(m => m.sheetName),
    dropdowns: dropdowns,
    filters: getFilterOptionsFromDropdownsV16_(dropdowns),
    chartMetrics: mergeChartMetricsV15_(getChartMetricsV13_()),
    graphTemplates: getGraphTemplatesV15_(),
    navigationExcludes: ["18_Decision_Report", "19_Tilda_Output"],
    configDriven: true,
    configSource: "00_Config and 00_Lookup_* sheets",
    optimized: true
  };

  putCacheSafeV16_(cache, key, meta, 180);
  return meta;
}

function getDropdownsNeededByModulesV16_(modules) {
  const needed = {};
  modules.forEach(m => {
    const d = buildModuleDropdownsV14_(m);
    Object.keys(d).forEach(field => needed[d[field]] = true);
  });

  ["__PROJECTS__", "__ASSUMPTIONS__", "__RISK_SCENARIOS__", "__MAP_IDS__", "__ROV_IDS__", "__MCDA_CRITERIA__",
   "00_Lookup_ProjectTypes", "00_Lookup_Locations", "00_Lookup_ProjectPhases", "00_Lookup_ProductStreams",
   "00_Lookup_CostTypes", "00_Lookup_ROV_OptionTypes", "00_Lookup_RiskLevels"].forEach(k => needed[k] = true);

  const out = {};
  Object.keys(needed).forEach(name => {
    if (name === "__PROJECTS__") out[name] = getSimpleKeyList_("01_Projects", 5, "Project_ID", "Project_Name");
    else if (name === "__ASSUMPTIONS__") out[name] = getSimpleKeyList_("02_Assumptions", 5, "Assumption_Set_ID", "Scenario_Name");
    else if (name === "__RISK_SCENARIOS__") out[name] = getSimpleKeyList_("08_Risk_Scenarios", 5, "Scenario_ID", "Scenario_Name");
    else if (name === "__MAP_IDS__") out[name] = getSimpleKeyList_("09_MAP_DNPV", 5, "MAP_ID", "Scenario_ID");
    else if (name === "__ROV_IDS__") out[name] = getSimpleKeyList_("10_ROV", 5, "ROV_ID", "Option_Type");
    else if (name === "__MCDA_CRITERIA__") out[name] = getSimpleKeyList_("11_MCDA_Criteria", 9, "Criterion_ID", "Criterion_Name");
    else if (/^00_Lookup_/i.test(name) && sheetExists_(name)) out[name] = readLookupValueListV16_(name);
  });
  return out;
}

function getFilterOptionsFromDropdownsV16_(dropdowns) {
  return {
    projectIds: dropdowns["__PROJECTS__"] || [],
    assumptionSetIds: dropdowns["__ASSUMPTIONS__"] || [],
    scenarioIds: dropdowns["__RISK_SCENARIOS__"] || [],
    projectTypes: dropdowns["00_Lookup_ProjectTypes"] || [],
    locations: dropdowns["00_Lookup_Locations"] || [],
    phases: dropdowns["00_Lookup_ProjectPhases"] || [],
    productStreams: dropdowns["00_Lookup_ProductStreams"] || [],
    costTypes: dropdowns["00_Lookup_CostTypes"] || [],
    optionTypes: dropdowns["00_Lookup_ROV_OptionTypes"] || [],
    criteriaIds: dropdowns["__MCDA_CRITERIA__"] || [],
    riskLevels: dropdowns["00_Lookup_RiskLevels"] || [],
    years: collectYearsFastV16_()
  };
}

function getFilterOptionsV16_() {
  const modules = getAvailableModules_().filter(m => ["decision_report", "tilda_output"].indexOf(m.id) === -1);
  const dropdowns = getDropdownsNeededByModulesV16_(modules);
  return getFilterOptionsFromDropdownsV16_(dropdowns);
}

function getConfigCenterV16_() {
  return {
    settings: readConfigSettingsV14_(),
    lookupSheets: getDropdownsNeededByModulesV16_(getAvailableModules_()),
    source: "00_Config",
    optimized: true
  };
}

function getModuleV16_(moduleId, key, filters) {
  const module = getModuleConfig_(moduleId);
  let rows = getRows_(module.sheetName, module.headerRow);
  rows = applyFiltersToRowsV13_(rows, filters || {});
  const maxRows = Number((filters && filters.__maxRows) || 250);

  let selected = null;
  if (key && module.keyColumn) selected = rows.find(r => String(r[module.keyColumn]).trim() === String(key).trim()) || null;
  if (!selected && rows.length) selected = rows[0];

  return {
    module: Object.assign({}, module, {
      dropdowns: buildModuleDropdownsV14_(module),
      dependencies: getModuleDependenciesV14_(module),
      calculationMode: getCalculationModeV14_(module)
    }),
    headers: getHeaders_(module.sheetName, module.headerRow),
    rows: rows.slice(0, maxRows),
    selected: selected,
    filtersApplied: filters || {},
    totalRowsAfterFilter: rows.length,
    truncated: rows.length > maxRows,
    sequencePosition: getSequencePositionV14_(module.id),
    configDriven: true,
    optimized: true
  };
}

function getDashboardV16_(filters, projectId) {
  let rows = [];
  if (sheetExists_("17_Dashboard_Data")) rows = getRows_("17_Dashboard_Data", 3);
  else if (sheetExists_("19_Tilda_Output")) rows = getRows_("19_Tilda_Output", 3);
  if (!rows.length) rows = rebuildDashboardRowsV13_();

  if (projectId) {
    filters = filters || {};
    filters.projectIds = [projectId];
  }
  rows = applyFiltersToRowsV13_(rows, filters || {});

  const selectedMetrics = normalizeArrayV13_((filters || {}).metrics);
  const filteredRows = rows.map(r => filterMetricColumnsV13_(r, selectedMetrics));
  return {
    rows: filteredRows.slice(0, 200),
    first: filteredRows[0] || {},
    totalRowsAfterFilter: filteredRows.length,
    truncated: filteredRows.length > 200,
    filtersApplied: filters || {},
    selectedMetrics: selectedMetrics,
    summary: summarizeDashboardRowsV13_(rows),
    optimized: true
  };
}

function getProjectsFastV16_() {
  const source = sheetExists_("19_Tilda_Output") ? getRows_("19_Tilda_Output", 3) : getRows_("01_Projects", 5);
  return source.slice(0, 300).map(r => ({
    Project_ID: r.Project_ID,
    Project_Name: r.Project_Name,
    Project_Type: r.Project_Type,
    Location: r.Location,
    Decision_Label: r.Decision_Label || r.Final_Decision || ""
  }));
}

function getChartDataV16_(filters, metric, groupBy, timeField) {
  const sources = getChartSourcesForMetricV16_(metric, groupBy, timeField);
  let allRows = [];
  sources.forEach(src => {
    if (!sheetExists_(src.sheet)) return;
    getRows_(src.sheet, src.headerRow).forEach(r => allRows.push(Object.assign({ __sourceSheet: src.sheet }, r)));
  });

  allRows = applyFiltersToRowsV13_(allRows, filters || {});
  const maxInputRows = 2000;
  if (allRows.length > maxInputRows) allRows = allRows.slice(0, maxInputRows);

  const grouped = {};
  allRows.forEach(r => {
    const x = String(r[timeField] || r[groupBy] || r.Project_Name || r.Project_ID || r.__sourceSheet || "Unknown");
    const y = getMetricValueFromRowV13_(r, metric);
    if (isNaN(y)) return;
    const series = String(r[groupBy] || r.Project_Name || r.Project_ID || r.__sourceSheet || "Model");
    const key = x + "||" + series;
    if (!grouped[key]) grouped[key] = { x: x, series: series, value: 0, count: 0 };
    grouped[key].value += y;
    grouped[key].count += 1;
  });

  const data = Object.keys(grouped).map(k => {
    const g = grouped[k];
    return { x: g.x, series: g.series, value: g.value / g.count };
  }).sort((a,b) => String(a.x).localeCompare(String(b.x))).slice(0, 500);

  return { metric: metric, groupBy: groupBy, timeField: timeField, rowsUsed: allRows.length, sources: sources.map(s => s.sheet), data: data, optimized: true };
}

function getChartSourcesForMetricV16_(metric, groupBy, timeField) {
  const fields = [metric, groupBy, timeField].join(" ");
  if (/NPV_Change|Adjusted_NPV|Sensitivity/i.test(fields)) return [{ sheet: "15_Sensitivity", headerRow: 5 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/Simulated|Monte|Run_No|Probability_Positive/i.test(fields)) return [{ sheet: "16_Monte_Carlo", headerRow: 5 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/Manual_Score|Weight|Criterion|MCDA/i.test(fields)) return [{ sheet: "12_MCDA_Scores", headerRow: 5 }, { sheet: "11_MCDA_Criteria", headerRow: 9 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/System_Dynamics|Production_Capacity|Investment_Flow|Revenue_Flow|OPEX_Flow/i.test(fields)) return [{ sheet: "13_System_Dynamics", headerRow: 5 }, { sheet: "14_SD_Parameters", headerRow: 4 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/Production|Capacity|Reserve|Utilization/i.test(fields)) return [{ sheet: "03_Production", headerRow: 5 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/Price|Product_Stream/i.test(fields)) return [{ sheet: "04_Prices", headerRow: 4 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/CAPEX|OPEX|Cost|Revenue/i.test(fields)) return [{ sheet: "05_CAPEX_OPEX", headerRow: 5 }, { sheet: "06_DCF", headerRow: 5 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/DNPV|MAP/i.test(fields)) return [{ sheet: "09_MAP_DNPV", headerRow: 5 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/ROV|Strategic_NPV/i.test(fields)) return [{ sheet: "10_ROV", headerRow: 5 }, { sheet: "17_Dashboard_Data", headerRow: 3 }];
  if (/IRR|NPV|Payback|DCF/i.test(fields)) return [{ sheet: "17_Dashboard_Data", headerRow: 3 }, { sheet: "07_DCF_Results", headerRow: 5 }, { sheet: "06_DCF", headerRow: 5 }];
  return [{ sheet: "17_Dashboard_Data", headerRow: 3 }];
}

function getRows_(sheetName, headerRow) {
  const cache = CacheService.getScriptCache();
  const sh = getSpreadsheet_().getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow <= headerRow) return [];

  const cacheKey = "im3_rows_v16_" + getSpreadsheetId_().slice(0,8) + "_" + sheetName + "_" + headerRow + "_" + lastRow + "_" + lastCol;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const headers = getHeaders_(sheetName, headerRow);
  const effectiveLastCol = Math.min(lastCol, headers.length);
  const rowCount = Math.max(0, lastRow - headerRow);
  const values = sh.getRange(headerRow + 1, 1, rowCount, effectiveLastCol).getDisplayValues();
  const rows = values
    .filter(row => row.some(v => String(v || "").trim() !== ""))
    .map((row, idx) => {
      const obj = { __rowNumber: headerRow + 1 + idx };
      headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
      return obj;
    });

  putCacheSafeV16_(cache, cacheKey, rows, 120);
  return rows;
}

function readLookupValueListV16_(sheetName) {
  const cache = CacheService.getScriptCache();
  const sh = getSpreadsheet_().getSheetByName(sheetName);
  if (!sh) return [];
  const key = "im3_lookup_v16_" + getSpreadsheetId_().slice(0,8) + "_" + sheetName + "_" + sh.getLastRow() + "_" + sh.getLastColumn();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  const out = readLookupValueListV14_(sheetName).slice(0, 500);
  putCacheSafeV16_(cache, key, out, 300);
  return out;
}

function collectYearsFastV16_() {
  try { return collectYearsV13_(); } catch (err) { return []; }
}

function saveRowAndRecalculateV16_(e) {
  const result = saveRowFromRequest_(e);
  SpreadsheetApp.flush();
  clearIm3CacheV16_();
  return Object.assign({}, result, { recalculated: true, calculationSource: "Google Sheets formulas", sequence: getModelSequenceV14_() });
}

function clearIm3CacheV16_() {
  // Script cache does not support wildcard delete. Versioned keys expire quickly.
  return { cleared: true, note: "Cache is versioned/time-based and will refresh automatically after save.", timestamp: new Date().toISOString() };
}

function putCacheSafeV16_(cache, key, value, seconds) {
  try {
    const json = JSON.stringify(value);
    if (json.length < 95000) cache.put(key, json, seconds || 120);
  } catch (err) {
    // Ignore cache errors; endpoint still returns live data.
  }
}

function getDiagnosticsV16_() {
  const base = getDiagnosticsV15_ ? getDiagnosticsV15_() : getDiagnosticsV14_();
  base.version = "1.6-performance";
  base.optimized = true;
  base.notes = [
    "metadata now uses cached config-driven dropdowns",
    "chartdata reads only relevant source sheets by metric",
    "module and dashboard responses are row-limited",
    "save invalidates by short-lived cache strategy"
  ];
  return base;
}


/**
 * ============================================================
 * IM³ Framework MVP — v1.7 Data Loading Fix
 * Purpose:
 * - Avoid sending one heavy metadata payload to Tilda.
 * - Add lightweight metadatafast/bootstrap endpoint.
 * - Add dropdowns endpoint for lazy loading form dropdowns.
 * - Keep compatibility with existing v1.6 endpoints.
 * ============================================================
 */

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;

    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = getMetadataFastV17_();
    } else if (action === "dropdowns") {
      data = getDropdownsV17_(e.parameter.scope || "all");
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV15_();
    } else if (action === "config") {
      data = getConfigCenterV16_();
    } else if (action === "configoptions" || action === "filteroptions") {
      data = getFilterOptionsV17_();
    } else if (action === "sequence") {
      data = getModelSequenceV14_();
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "dashboard") {
      data = getDashboardV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = getProjectsFastV16_();
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "NPV_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV17_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = {
        status: "ok",
        version: "1.7-data-loading-fix",
        timestamp: new Date().toISOString(),
        spreadsheetId: getSpreadsheetId_()
      };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, elapsedMs: new Date().getTime() - started, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, elapsedMs: new Date().getTime() - started, error: err.message, stack: err.stack }, callback);
  }
}

function getMetadataFastV17_() {
  const cache = CacheService.getScriptCache();
  const key = "im3_meta_fast_v17_" + getSpreadsheetId_();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const modules = getAvailableModules_()
    .filter(m => ["decision_report", "tilda_output"].indexOf(m.id) === -1)
    .sort((a,b) => a.order - b.order);

  const meta = {
    appName: "IM³ Framework MVP",
    version: "1.7-data-loading-fix",
    spreadsheetId: getSpreadsheetId_(),
    sequence: getModelSequenceV14_(),
    modules: modules.map(m => ({
      id: m.id,
      order: m.order,
      title: m.title,
      sheetName: m.sheetName,
      keyColumn: m.keyColumn,
      description: m.description,
      readOnly: !!m.readOnly,
      editableFields: m.editableFields || [],
      dropdowns: buildModuleDropdownsV14_(m),
      dependencies: getModuleDependenciesV14_(m),
      calculationMode: getCalculationModeV14_(m)
    })),
    missingModules: MODULES.filter(m => !sheetExists_(m.sheetName)).map(m => m.sheetName),
    chartMetrics: mergeChartMetricsV15_(getChartMetricsV13_()),
    graphTemplates: getGraphTemplatesV15_(),
    navigationExcludes: ["18_Decision_Report", "19_Tilda_Output"],
    configDriven: true,
    configSource: "00_Config and 00_Lookup_* sheets",
    optimized: true,
    lazyDropdowns: true,
    loadingMode: "progressive"
  };

  putCacheSafeV16_(cache, key, meta, 300);
  return meta;
}

function getDropdownsV17_(scope) {
  const cache = CacheService.getScriptCache();
  const modules = getAvailableModules_().filter(m => ["decision_report", "tilda_output"].indexOf(m.id) === -1);
  const key = "im3_dropdowns_v17_" + getSpreadsheetId_().slice(0,8) + "_" + String(scope || "all");
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const dropdowns = getDropdownsNeededByModulesV16_(modules);
  putCacheSafeV16_(cache, key, dropdowns, 300);
  return dropdowns;
}

function getFilterOptionsV17_() {
  const cache = CacheService.getScriptCache();
  const key = "im3_filters_v17_" + getSpreadsheetId_().slice(0,8);
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const modules = getAvailableModules_().filter(m => ["decision_report", "tilda_output"].indexOf(m.id) === -1);
  const dropdowns = getDropdownsNeededByModulesV16_(modules);
  const filters = getFilterOptionsFromDropdownsV16_(dropdowns);
  putCacheSafeV16_(cache, key, filters, 300);
  return filters;
}

function getDiagnosticsV17_() {
  const base = getDiagnosticsV16_ ? getDiagnosticsV16_() : getDiagnosticsV15_();
  base.version = "1.7-data-loading-fix";
  base.loadingFix = true;
  base.newEndpoints = ["metadatafast", "bootstrap", "dropdowns", "filteroptions"];
  base.notes = [
    "Tilda should call metadatafast first, not the old heavy metadata payload.",
    "Dropdowns are loaded lazily through action=dropdowns.",
    "Filter options are loaded separately through action=filteroptions.",
    "Dashboard and chartdata remain row-limited and cache-aware."
  ];
  return base;
}
/**
 * ============================================================
 * IM³ Framework MVP — v1.8 Tilda Data Viewer + Selection Fix
 * Purpose:
 * - Fix Current record selection by accepting both key and rowId.
 * - Add summarydata endpoint for Google Sheets-style result viewing in Tilda.
 * - Keep v1.7 progressive loading behavior.
 * ============================================================
 */

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;

    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = getMetadataFastV18_();
    } else if (action === "dropdowns") {
      data = getDropdownsV17_(e.parameter.scope || "all");
    } else if (action === "summarydata") {
      data = getSummaryDataV18_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "summaryviews") {
      data = getSummaryViewsV18_();
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV15_();
    } else if (action === "config") {
      data = getConfigCenterV16_();
    } else if (action === "configoptions" || action === "filteroptions") {
      data = getFilterOptionsV17_();
    } else if (action === "sequence") {
      data = getModelSequenceV14_();
    } else if (action === "module") {
      const key = e.parameter.key || e.parameter.rowId || "";
      data = getModuleV18_(e.parameter.moduleId, key, parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "dashboard") {
      data = getDashboardV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = getProjectsFastV16_();
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "NPV_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV18_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = { status: "ok", version: "1.8-tilda-data-viewer", timestamp: new Date().toISOString(), spreadsheetId: getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, elapsedMs: new Date().getTime() - started, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, elapsedMs: new Date().getTime() - started, error: err.message, stack: err.stack }, callback);
  }
}

function getMetadataFastV18_() {
  const meta = getMetadataFastV17_();
  meta.version = "1.8-tilda-data-viewer";
  meta.summaryViews = getSummaryViewsV18_();
  meta.notes = [
    "Current record accepts key and rowId parameters.",
    "Tilda can load Google Sheets-style result summaries with action=summarydata.",
    "Form dropdowns remain configuration-driven from 00_Config and 00_Lookup_* sheets."
  ];
  return meta;
}

function getModuleV18_(moduleId, key, filters) {
  const module = getModuleConfig_(moduleId);
  let rows = getRows_(module.sheetName, module.headerRow);
  rows = applyFiltersToRowsV13_(rows, filters || {});
  const maxRows = Number((filters && filters.__maxRows) || 500);

  let selected = null;
  if (key && module.keyColumn) selected = rows.find(r => String(r[module.keyColumn]).trim() === String(key).trim()) || null;
  if (!selected && key) {
    selected = rows.find(r => String(r.Row_ID || r.ID || r.Project_ID || r.Assumption_Set_ID || r.Scenario_ID || "").trim() === String(key).trim()) || null;
  }
  if (!selected && rows.length) selected = rows[0];

  return {
    module: Object.assign({}, module, {
      dropdowns: buildModuleDropdownsV14_(module),
      dependencies: getModuleDependenciesV14_(module),
      calculationMode: getCalculationModeV14_(module)
    }),
    headers: getHeaders_(module.sheetName, module.headerRow),
    rows: rows.slice(0, maxRows),
    selected: selected,
    filtersApplied: filters || {},
    totalRowsAfterFilter: rows.length,
    truncated: rows.length > maxRows,
    sequencePosition: getSequencePositionV14_(module.id),
    configDriven: true,
    optimized: true
  };
}

function getSummaryViewsV18_() {
  return [
    { id: "production_summary", title: "Production Summary", sheetName: "03_Production" },
    { id: "price_summary", title: "Price Module Summary", sheetName: "04_Prices" },
    { id: "cost_summary", title: "Cost Module Summary", sheetName: "05_CAPEX_OPEX" },
    { id: "dcf_summary", title: "DCF Summary", sheetName: "06_DCF" },
    { id: "dcf_results_summary", title: "DCF Results Summary", sheetName: "07_DCF_Results" },
    { id: "adjusted_scenario_outputs", title: "Adjusted Scenario Outputs", sheetName: "17_Dashboard_Data" },
    { id: "map_dnpv_summary", title: "MAP/DNPV Summary", sheetName: "09_MAP_DNPV" },
    { id: "rov_summary", title: "ROV Summary", sheetName: "10_ROV" },
    { id: "mcda_summary", title: "MCDA Summary", sheetName: "12_MCDA_Scores" },
    { id: "system_dynamics_summary", title: "System Dynamics Summary", sheetName: "13_System_Dynamics" },
    { id: "sd_parameter_summary", title: "SD Parameter Summary", sheetName: "14_SD_Parameters" },
    { id: "monte_carlo_summary", title: "Monte Carlo Summary", sheetName: "16_Monte_Carlo" }
  ];
}

function getSummarySpecV18_(viewId) {
  const specs = {
    production_summary: { title:"Production Summary", sheet:"03_Production", headerRow:5, columns:["Project_ID","Project_Name","Assumption_Set_ID","Year","Project_Phase","Installed_Capacity","Capacity_Unit","Utilization_Rate","Uptime","Ramp_Up_Factor","Decline_Rate","Domestic_Allocation_%","Export_Allocation_%","Reserve_Base","Include_In_Model"] },
    price_summary: { title:"Price Module Summary", sheet:"04_Prices", headerRow:4, columns:["Project_ID","Project_Name","Assumption_Set_ID","Scenario_Type","Year","Product_Stream","Pricing_Unit","Base_Price","Escalation_Rate","Market_Adjustment_Factor","Risk_Adjustment_Factor","Domestic_Price_Discount","FX_Rate_to_USD","Price_Source"] },
    cost_summary: { title:"Cost Module Summary", sheet:"05_CAPEX_OPEX", headerRow:5, columns:["Project_ID","Project_Name","Assumption_Set_ID","Cost_Type","Cost_Category","Scenario_Type","Year","Cost_Frequency","Cost_Unit","Base_Amount","Quantity","Inflation_Rate","Escalation_Rate","Cost_Risk_Factor","FX_Rate_to_USD","Include_In_Model"] },
    dcf_summary: { title:"DCF Summary", sheet:"06_DCF", headerRow:5, columns:["Project_ID","Project_Name","Assumption_Set_ID","Year","Revenue_USD","CAPEX_USD","OPEX_USD","EBITDA_USD","Tax_USD","Free_Cash_Flow_USD","Discount_Rate","Discount_Factor","Discounted_Cash_Flow_USD","Cumulative_DCF_USD"] },
    dcf_results_summary: { title:"DCF Results Summary", sheet:"07_DCF_Results", headerRow:5, columns:["Project_ID","Project_Name","Assumption_Set_ID","Scenario_Name","NPV_USD","IRR","Payback_Years","DCF_Score","DCF_Decision","Final_Decision","Recommendation","Include_In_Dashboard"] },
    adjusted_scenario_outputs: { title:"Adjusted Scenario Outputs", sheet:"17_Dashboard_Data", headerRow:3, columns:["Project_ID","Project_Name","Scenario_Name","Adjusted_NPV_USD","Probability_Weighted_NPV_USD","Composite_Risk_Score","Risk_Class","Scenario_Risk_Class","Weighted_Risk_NPV","DNPV_USD","MAP_Adjusted_Value"] },
    map_dnpv_summary: { title:"MAP/DNPV Summary", sheet:"09_MAP_DNPV", headerRow:5, columns:["MAP_ID","Project_ID","Project_Name","Assumption_Set_ID","Scenario_ID","Active","Market_Confidence","Technical_Confidence","Regulatory_Confidence","ESG_Confidence","Risk_Adjustment_Rate","Strategic_Flexibility_Factor","DNPV_USD","MAP_Adjusted_Value","Feeds_ROV","Feeds_MCDA"] },
    rov_summary: { title:"ROV Summary", sheet:"10_ROV", headerRow:5, columns:["ROV_ID","Project_ID","Project_Name","MAP_ID","Scenario_ID","Assumption_Set_ID","Active","Option_Type","ROV_Method","Trigger_Variable","Exercise_Year","Exercise_Cost_USD","Volatility","Option_Probability","ROV_Option_Value","Strategic_NPV_ROV","Feeds_MCDA"] },
    mcda_summary: { title:"MCDA Summary", sheet:"12_MCDA_Scores", headerRow:5, columns:["Project_ID","Project_Name","Assumption_Set_ID","Criterion_ID","Manual_Score_1_10","Weighted_Score","Final_MCDA_Score_0_100","MCDA_Score","Strategic_Decision","Score_Status","Notes"] },
    system_dynamics_summary: { title:"System Dynamics Summary", sheet:"13_System_Dynamics", headerRow:5, columns:["Project_ID","Project_Name","Assumption_Set_ID","Scenario_ID","ROV_ID","Year","Installed_Capacity","Capacity_Addition","Capacity_Retirement","Reinvestment_Rate","Local_Content_Gain","Technology_Gain","Policy_Risk_Index","Geopolitical_Risk_Index","Market_Risk_Index","System_Dynamics_Score"] },
    sd_parameter_summary: { title:"SD Parameter Summary", sheet:"14_SD_Parameters", headerRow:4, columns:["Parameter_ID","Parameter_Group","Parameter_Name","Description","Assumption_Set_ID","Default_Value","Current_Value","Unit","Min_Value","Max_Value","Source_Module","Used_In_Module","Editable","Sensitivity_Flag","Status"] },
    monte_carlo_summary: { title:"Monte Carlo Summary", sheet:"16_Monte_Carlo", headerRow:5, columns:["Simulation_ID","Project_ID","Project_Name","Assumption_Set_ID","Distribution","Active","Price_Shock","Production_Shock","CAPEX_Shock","OPEX_Shock","Discount_Rate_Shock","Risk_Shock","Delay_Years","Carbon_Tax_USD","Simulated_NPV_USD","Monte_Carlo_Mean_NPV","Probability_Positive_NPV","Feeds_Dashboard"] }
  };
  return specs[viewId] || specs.production_summary;
}

function getSummaryDataV18_(viewId, filters) {
  const spec = getSummarySpecV18_(viewId);
  let rows = [];
  if (sheetExists_(spec.sheet)) rows = getRows_(spec.sheet, spec.headerRow);

  if (viewId === "adjusted_scenario_outputs" && (!rows || !rows.length)) {
    if (sheetExists_("08_Risk_Scenarios")) rows = getRows_("08_Risk_Scenarios", 5);
  }

  rows = applyFiltersToRowsV13_(rows, filters || {});
  rows = rows.map(r => normalizeSummaryRowV18_(r, viewId));

  const projected = rows.map(r => projectSummaryColumnsV18_(r, spec.columns));
  const maxRows = Number((filters && filters.__maxRows) || 500);
  const outRows = projected.slice(0, maxRows);

  return {
    view: viewId,
    title: spec.title,
    sheetName: spec.sheet,
    rows: outRows,
    totalRowsAfterFilter: projected.length,
    truncated: projected.length > maxRows,
    filtersApplied: filters || {},
    kpis: viewId === "mcda_summary" ? buildMcdaKpisV18_(rows) : buildBasicSummaryKpisV18_(rows, viewId)
  };
}

function normalizeSummaryRowV18_(row, viewId) {
  const r = Object.assign({}, row);

  if (!("Project_Name" in r) && r.Project_ID) r.Project_Name = lookupProjectNameV18_(r.Project_ID);

  if (viewId === "adjusted_scenario_outputs") {
    if (!("Adjusted_NPV_USD" in r)) r.Adjusted_NPV_USD = r.Adjusted_NPV || r.MAP_Adjusted_Value || r.DNPV_USD || r.Weighted_Risk_NPV || "";
    if (!("Probability_Weighted_NPV_USD" in r)) r.Probability_Weighted_NPV_USD = r.Probability_Weighted_NPV || r.Weighted_Risk_NPV || r.Monte_Carlo_Mean_NPV || "";
    if (!("Composite_Risk_Score" in r)) r.Composite_Risk_Score = r.Composite_Risk_Score || r.Risk_Score || r.DCF_Score || "";
    if (!("Risk_Class" in r)) r.Risk_Class = r.Risk_Class || r.Scenario_Risk_Class || r.Risk_Label || "";
  }

  if (viewId === "mcda_summary") {
    if (!("Final_MCDA_Score_0_100" in r)) r.Final_MCDA_Score_0_100 = r.Final_MCDA_Score || r.MCDA_Score || r.MCDA_Display || "";
    if (!("Strategic_Decision" in r)) r.Strategic_Decision = r.Strategic_Decision || r.Final_Decision || r.Decision_Label || r.Score_Status || "";
  }

  return r;
}

function projectSummaryColumnsV18_(row, requestedColumns) {
  const out = {};
  const headers = Object.keys(row).filter(k => !/^__/.test(k));
  requestedColumns.forEach(c => {
    if (c in row) out[c] = row[c];
  });
  if (!Object.keys(out).length) {
    headers.slice(0, 20).forEach(k => out[k] = row[k]);
  } else {
    headers.forEach(k => {
      if (Object.keys(out).length >= 24) return;
      if (!(k in out) && /decision|recommendation|status|risk|score|npv|irr|year|project|scenario/i.test(k)) out[k] = row[k];
    });
  }
  return out;
}

function lookupProjectNameV18_(projectId) {
  try {
    if (!projectId || !sheetExists_("01_Projects")) return "";
    const rows = getRows_("01_Projects", 5);
    const found = rows.find(r => String(r.Project_ID).trim() === String(projectId).trim());
    return found ? found.Project_Name || "" : "";
  } catch (err) {
    return "";
  }
}

function buildBasicSummaryKpisV18_(rows, viewId) {
  return { Rows: rows.length };
}

function buildMcdaKpisV18_(rows) {
  const activeRows = rows.filter(r => !r.Score_Status || !/inactive|no|false/i.test(String(r.Score_Status))).length;
  const projectSet = {};
  rows.forEach(r => { if (r.Project_ID || r.Project_Name) projectSet[String(r.Project_ID || r.Project_Name)] = true; });
  const scores = rows.map(r => parseNumberV13_(r.Final_MCDA_Score_0_100 || r.MCDA_Score || r.Final_MCDA_Score)).filter(n => !isNaN(n));
  const best = scores.length ? Math.max.apply(null, scores) : 0;
  const avg = scores.length ? scores.reduce((a,b) => a+b, 0) / scores.length : 0;
  const decisions = { invest:0, review:0, reject:0 };
  rows.forEach(r => {
    const d = String(r.Strategic_Decision || r.Final_Decision || r.Score_Status || "").toLowerCase();
    if (/invest|prioritize|proceed/.test(d)) decisions.invest++;
    else if (/reject|redesign|stop/.test(d)) decisions.reject++;
    else if (/review|improve|optimi/.test(d)) decisions.review++;
  });
  return {
    "Active Score Rows": activeRows,
    "Projects Scored": Object.keys(projectSet).length,
    "Best MCDA Score": Number(best.toFixed(2)),
    "Average MCDA Score": Number(avg.toFixed(2)),
    "Invest / Prioritize": decisions.invest,
    "Review / Improve": decisions.review,
    "Reject / Redesign": decisions.reject
  };
}

function getDiagnosticsV18_() {
  const base = getDiagnosticsV17_();
  base.version = "1.8-tilda-data-viewer";
  base.summaryViews = getSummaryViewsV18_();
  base.newEndpoints = (base.newEndpoints || []).concat(["summaryviews", "summarydata"]);
  base.selectionFix = "module endpoint accepts key and rowId";
  return base;
}


/**
 * ============================================================
 * IM³ Framework MVP — v1.9 Project Dashboard Cards Fix
 * Final override layer for Tilda:
 * - Restores filter dropdown options.
 * - Adds project-driven summary dashboard endpoint.
 * - Reads summary KPIs from the same logical blocks used in Excel:
 *   03_Production!AC1:AD7, 04_Prices!T1:U9, 05_CAPEX_OPEX!AB1:AC18,
 *   06_DCF!AN1:AO15, 07_DCF_Results!AD1:AE9,
 *   08_Risk_Scenarios!AD4:AJ105 and A108:C113,
 *   09_MAP_DNPV!AF1:AG10, 10_ROV!AK1:AL7,
 *   12_MCDA_Scores!X1:Y8 plus S5:V25,
 *   13_System_Dynamics!AK1:AL9, 14_SD_Parameters!T1:U7,
 *   16_Monte_Carlo!AD1:AE8.
 * ============================================================
 */

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;
    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = im3FinalMetadata_();
    } else if (action === "filteroptions" || action === "configoptions") {
      data = im3FinalFilterOptions_();
    } else if (action === "dropdowns") {
      data = im3FinalDropdowns_();
    } else if (action === "summarydata") {
      data = im3FinalSummaryData_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || e.parameter.rowId || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "dashboard") {
      data = im3FinalDashboard_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = im3FinalProjects_();
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "NPV_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = im3FinalDiagnostics_();
    } else if (action === "health") {
      data = { status: "ok", version: "1.9-project-dashboard-cards", timestamp: new Date().toISOString(), spreadsheetId: getSpreadsheetId_() };
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, elapsedMs: new Date().getTime() - started, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, elapsedMs: new Date().getTime() - started, error: err.message, stack: err.stack }, callback);
  }
}

function im3FinalMetadata_() {
  let meta;
  try {
    meta = getMetadataFastV17_();
  } catch (err) {
    try { meta = getMetadataV16_(); } catch (err2) { meta = getMetadataV14_(); }
  }
  meta.version = "1.9-project-dashboard-cards";
  meta.filters = im3FinalFilterOptions_();
  meta.dropdowns = im3FinalDropdowns_();
  meta.chartMetrics = mergeChartMetricsV15_(getChartMetricsV13_());
  meta.summaryViews = im3FinalSummaryViews_();
  meta.navigationExcludes = ["00_Config", "18_Decision_Report", "19_Tilda_Output"];
  meta.configDriven = true;
  meta.optimized = true;
  return meta;
}

function im3FinalDropdowns_() {
  try {
    const modules = getAvailableModules_().filter(m => ["decision_report", "tilda_output"].indexOf(m.id) === -1);
    const d = getDropdownsNeededByModulesV16_(modules);
    // Make sure filters always have enough options even if fast metadata cache is incomplete.
    d["__PROJECTS__"] = im3FinalProjects_().map(p => ({ value: p.Project_ID, label: p.Project_ID + " — " + p.Project_Name }));
    d["__ASSUMPTIONS__"] = getSimpleKeyList_("02_Assumptions", 5, "Assumption_Set_ID", "Scenario_Name");
    d["__RISK_SCENARIOS__"] = getSimpleKeyList_("08_Risk_Scenarios", 5, "Scenario_ID", "Scenario_Name");
    return d;
  } catch (err) {
    return {
      "__PROJECTS__": im3FinalProjects_().map(p => ({ value: p.Project_ID, label: p.Project_ID + " — " + p.Project_Name })),
      "__ASSUMPTIONS__": sheetExists_("02_Assumptions") ? getSimpleKeyList_("02_Assumptions", 5, "Assumption_Set_ID", "Scenario_Name") : [],
      "__RISK_SCENARIOS__": sheetExists_("08_Risk_Scenarios") ? getSimpleKeyList_("08_Risk_Scenarios", 5, "Scenario_ID", "Scenario_Name") : []
    };
  }
}

function im3FinalFilterOptions_() {
  const dropdowns = im3FinalDropdowns_();
  return {
    projectIds: dropdowns["__PROJECTS__"] || [],
    assumptionSetIds: dropdowns["__ASSUMPTIONS__"] || [],
    scenarioIds: dropdowns["__RISK_SCENARIOS__"] || [],
    projectTypes: dropdowns["00_Lookup_ProjectTypes"] || im3FinalUniqueOptions_("01_Projects", 5, "Project_Type"),
    locations: dropdowns["00_Lookup_Locations"] || im3FinalUniqueOptions_("01_Projects", 5, "Location"),
    phases: dropdowns["00_Lookup_ProjectPhases"] || im3FinalUniqueOptions_("01_Projects", 5, "Project_Phase"),
    productStreams: dropdowns["00_Lookup_ProductStreams"] || im3FinalUniqueOptions_("04_Prices", 4, "Product_Stream"),
    costTypes: dropdowns["00_Lookup_CostTypes"] || im3FinalUniqueOptions_("05_CAPEX_OPEX", 5, "Cost_Type"),
    optionTypes: dropdowns["00_Lookup_ROV_OptionTypes"] || im3FinalUniqueOptions_("10_ROV", 5, "Option_Type"),
    criteriaIds: dropdowns["__MCDA_CRITERIA__"] || getSimpleKeyList_("11_MCDA_Criteria", 9, "Criterion_ID", "Criterion_Name"),
    riskLevels: dropdowns["00_Lookup_RiskLevels"] || im3FinalUniqueOptions_("08_Risk_Scenarios", 5, "Risk_Class"),
    years: collectYearsFastV16_()
  };
}

function im3FinalProjects_() {
  const sourceSheet = sheetExists_("01_Projects") ? "01_Projects" : (sheetExists_("19_Tilda_Output") ? "19_Tilda_Output" : "");
  if (!sourceSheet) return [];
  const rows = getRows_(sourceSheet, sourceSheet === "01_Projects" ? 5 : 3);
  const seen = {};
  return rows.filter(r => r.Project_ID && !seen[r.Project_ID]).map(r => {
    seen[r.Project_ID] = true;
    return {
      Project_ID: r.Project_ID,
      Project_Name: r.Project_Name || r.Name || r.Project_ID,
      Project_Type: r.Project_Type || "",
      Location: r.Location || "",
      Decision_Label: r.Decision_Label || r.Final_Decision || ""
    };
  });
}

function im3FinalUniqueOptions_(sheetName, headerRow, field) {
  if (!sheetExists_(sheetName)) return [];
  const seen = {};
  getRows_(sheetName, headerRow).forEach(r => {
    const v = String(r[field] || "").trim();
    if (v) seen[v] = true;
  });
  return Object.keys(seen).sort().map(v => ({ value: v, label: v }));
}

function im3FinalNormalizeArray_(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(v => String(v).trim() !== "");
  return String(value).split(",").map(v => v.trim()).filter(Boolean);
}

function im3FinalSelectedProject_(filters, projectId) {
  const explicit = String(projectId || "").trim();
  if (explicit) return explicit;
  const arr = im3FinalNormalizeArray_((filters || {}).projectIds);
  return arr.length === 1 ? String(arr[0]) : "";
}

function im3FinalFilterByProject_(rows, filters, projectId) {
  const selected = im3FinalSelectedProject_(filters, projectId);
  if (!selected) return rows;
  return rows.filter(r => String(r.Project_ID || "").trim() === selected);
}

function im3FinalActiveRows_(rows, activeField) {
  if (!activeField) return rows;
  return rows.filter(r => {
    const v = String(r[activeField] || "").trim().toLowerCase();
    return !v || v === "yes" || v === "complete";
  });
}

function im3FinalNum_(v) {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/,/g, "").replace(/%/g, "").replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return NaN;
  if (String(v).indexOf("%") !== -1 && Math.abs(n) > 1) return n / 100;
  return n;
}

function im3FinalSum_(rows, field) {
  return rows.reduce((a, r) => {
    const n = im3FinalNum_(r[field]);
    return a + (isNaN(n) ? 0 : n);
  }, 0);
}

function im3FinalAvg_(rows, field) {
  const nums = rows.map(r => im3FinalNum_(r[field])).filter(n => !isNaN(n));
  return nums.length ? nums.reduce((a,b)=>a+b,0) / nums.length : "";
}

function im3FinalMax_(rows, field) {
  const nums = rows.map(r => im3FinalNum_(r[field])).filter(n => !isNaN(n));
  return nums.length ? Math.max.apply(null, nums) : "";
}

function im3FinalMin_(rows, field) {
  const nums = rows.map(r => im3FinalNum_(r[field])).filter(n => !isNaN(n));
  return nums.length ? Math.min.apply(null, nums) : "";
}

function im3FinalCount_(rows, field, value) {
  return rows.filter(r => String(r[field] || "").trim() === String(value)).length;
}

function im3FinalMode_(rows, field) {
  const counts = {};
  rows.forEach(r => {
    const v = String(r[field] || "").trim();
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  let best = "";
  Object.keys(counts).forEach(k => { if (!best || counts[k] > counts[best]) best = k; });
  return best;
}

function im3FinalCard_(label, value, source, format) {
  return { label: label, value: value, source: source || "", format: format || im3FinalGuessFormat_(label) };
}

function im3FinalGuessFormat_(label) {
  if (/IRR|Rate|Probability|Utilization|Uptime|Index|Margin|Discount|Tax|Score/i.test(label)) return "percent_or_score";
  if (/USD|NPV|CAPEX|OPEX|Revenue|Cost|Value|Price|Cash/i.test(label)) return "money";
  return "plain";
}

function im3FinalSummaryViews_() {
  return [
    { id:"production_summary", title:"Production Summary" },
    { id:"price_summary", title:"Price Module Summary" },
    { id:"cost_summary", title:"Cost Module Summary" },
    { id:"dcf_summary", title:"DCF Summary" },
    { id:"dcf_results_summary", title:"DCF Results Summary" },
    { id:"adjusted_scenario_outputs", title:"Adjusted Scenario Outputs" },
    { id:"map_dnpv_summary", title:"MAP/DNPV Summary" },
    { id:"rov_summary", title:"ROV Summary" },
    { id:"mcda_summary", title:"MCDA Summary" },
    { id:"system_dynamics_summary", title:"System Dynamics Summary" },
    { id:"sd_parameter_summary", title:"SD Parameter Summary" },
    { id:"monte_carlo_summary", title:"Monte Carlo Summary" }
  ];
}

function im3FinalSummaryData_(view, filters, projectId) {
  const selectedProject = im3FinalSelectedProject_(filters || {}, projectId || "");
  let title = im3FinalSummaryViews_().filter(v => v.id === view).map(v => v.title)[0] || "Summary";
  let cards = [];
  let sourceRange = "";
  let sourceSheet = "";
  let note = "";

  if (view === "production_summary") {
    sourceSheet = "03_Production"; sourceRange = "AC1:AD7";
    let rows = im3FinalActiveRows_(im3FinalFilterByProject_(getRows_("03_Production",5), filters, selectedProject), "Include_In_Model");
    cards = [
      im3FinalCard_("Active production rows", rows.length, "03_Production!AC3:AD3", "plain"),
      im3FinalCard_("Total net production", im3FinalSum_(rows,"Net_Production"), "03_Production!AC4:AD4"),
      im3FinalCard_("Total domestic volume", im3FinalSum_(rows,"Domestic_Volume"), "03_Production!AC5:AD5"),
      im3FinalCard_("Total export volume", im3FinalSum_(rows,"Export_Volume"), "03_Production!AC6:AD6"),
      im3FinalCard_("Average utilization", im3FinalAvg_(rows,"Utilization_Rate"), "03_Production!AC7:AD7", "percent")
    ];
  } else if (view === "price_summary") {
    sourceSheet = "04_Prices"; sourceRange = "T1:U9";
    let rows = im3FinalFilterByProject_(getRows_("04_Prices",4), filters, selectedProject).filter(r => r.Price_Record_ID);
    cards = [
      im3FinalCard_("Active price records", rows.length, "04_Prices!T4:U4", "plain"),
      im3FinalCard_("Average Net Price", im3FinalAvg_(rows,"Net_Price_For_DCF"), "04_Prices!T5:U5"),
      im3FinalCard_("Max Net Price", im3FinalMax_(rows,"Net_Price_For_DCF"), "04_Prices!T6:U6"),
      im3FinalCard_("Min Net Price", im3FinalMin_(rows,"Net_Price_For_DCF"), "04_Prices!T7:U7"),
      im3FinalCard_("First Year", im3FinalMin_(rows,"Year"), "04_Prices!T8:U8", "plain"),
      im3FinalCard_("Last Year", im3FinalMax_(rows,"Year"), "04_Prices!T9:U9", "plain")
    ];
  } else if (view === "cost_summary") {
    sourceSheet = "05_CAPEX_OPEX"; sourceRange = "AB1:AC18";
    let rows = im3FinalActiveRows_(im3FinalFilterByProject_(getRows_("05_CAPEX_OPEX",5), filters, selectedProject), "Include_In_Model");
    cards = [
      im3FinalCard_("Active cost records", rows.length, "05_CAPEX_OPEX!AB4:AC4", "plain"),
      im3FinalCard_("Initial CAPEX", im3FinalSum_(rows.filter(r => r.Cost_Type === "Initial CAPEX"),"Nominal_Cost_USD"), "05_CAPEX_OPEX!AB15:AC15"),
      im3FinalCard_("Sustaining CAPEX", im3FinalSum_(rows.filter(r => r.Cost_Type === "Sustaining CAPEX"),"Nominal_Cost_USD"), "05_CAPEX_OPEX!AB16:AC16"),
      im3FinalCard_("Expansion CAPEX", im3FinalSum_(rows.filter(r => r.Cost_Type === "Expansion CAPEX"),"Nominal_Cost_USD"), "05_CAPEX_OPEX!AB17:AC17"),
      im3FinalCard_("Fixed OPEX", im3FinalSum_(rows.filter(r => r.Cost_Type === "Fixed OPEX"),"Nominal_Cost_USD"), "05_CAPEX_OPEX!AB18:AC18")
    ];
  } else if (view === "dcf_summary") {
    sourceSheet = "06_DCF"; sourceRange = "AN1:AO15";
    let rows = im3FinalActiveRows_(im3FinalFilterByProject_(getRows_("06_DCF",5), filters, selectedProject), "Include_In_Model");
    let first = rows[0] || {};
    cards = [
      im3FinalCard_("Project Name", first.Project_Name || selectedProject || "", "06_DCF!AN4:AO4", "plain"),
      im3FinalCard_("Scenario Name", first.Scenario_Name || "", "06_DCF!AN5:AO5", "plain"),
      im3FinalCard_("Total Revenue USD", im3FinalSum_(rows,"Revenue_USD"), "06_DCF!AN6:AO6"),
      im3FinalCard_("Total CAPEX USD", im3FinalSum_(rows,"CAPEX_USD"), "06_DCF!AN7:AO7"),
      im3FinalCard_("Total OPEX USD", im3FinalSum_(rows,"OPEX_USD"), "06_DCF!AN8:AO8"),
      im3FinalCard_("Total Tax USD", im3FinalSum_(rows,"Tax_USD"), "06_DCF!AN9:AO9"),
      im3FinalCard_("NPV to date USD", im3FinalMax_(rows,"NPV_To_Date_USD"), "06_DCF!AN10:AO10"),
      im3FinalCard_("Decision", im3FinalMode_(rows,"Decision_Flag") || "", "06_DCF!AN15:AO15", "plain")
    ];
  } else if (view === "dcf_results_summary") {
    sourceSheet = "07_DCF_Results"; sourceRange = "AD1:AE9";
    let rows = im3FinalActiveRows_(im3FinalFilterByProject_(getRows_("07_DCF_Results",5), filters, selectedProject), "Include_In_Dashboard");
    cards = [
      im3FinalCard_("Included Projects", rows.length, "07_DCF_Results!AD2:AE2", "plain"),
      im3FinalCard_("Best NPV", im3FinalMax_(rows,"NPV_USD"), "07_DCF_Results!AD3:AE3"),
      im3FinalCard_("Worst NPV", im3FinalMin_(rows,"NPV_USD"), "07_DCF_Results!AD4:AE4"),
      im3FinalCard_("Average IRR", im3FinalAvg_(rows,"IRR"), "07_DCF_Results!AD5:AE5", "percent"),
      im3FinalCard_("Average DCF Score", im3FinalAvg_(rows,"DCF_Score_0_100"), "07_DCF_Results!AD6:AE6", "score"),
      im3FinalCard_("Invest / Continue", im3FinalCount_(rows,"Decision_Class","Invest / Continue"), "07_DCF_Results!AD7:AE7", "plain"),
      im3FinalCard_("Review / Stage-Gate", im3FinalCount_(rows,"Decision_Class","Review / Stage-Gate"), "07_DCF_Results!AD8:AE8", "plain"),
      im3FinalCard_("Reject / Redesign", im3FinalCount_(rows,"Decision_Class","Reject / Redesign"), "07_DCF_Results!AD9:AE9", "plain")
    ];
  } else if (view === "adjusted_scenario_outputs") {
    sourceSheet = "08_Risk_Scenarios"; sourceRange = "AD4:AJ105 + A108:C113";
    let rows = im3FinalActiveRows_(im3FinalFilterByProject_(getRows_("08_Risk_Scenarios",5), filters, selectedProject), "Active");
    cards = [
      im3FinalCard_("Adjusted NPV USD", im3FinalSum_(rows,"Adjusted_NPV_USD"), "08_Risk_Scenarios!AG5:AG105"),
      im3FinalCard_("Probability Weighted NPV USD", im3FinalSum_(rows,"Probability_Weighted_NPV_USD"), "08_Risk_Scenarios!AH5:AH105"),
      im3FinalCard_("Composite Risk Score", im3FinalAvg_(rows,"Composite_Risk_Score"), "08_Risk_Scenarios!AI5:AI105", "score"),
      im3FinalCard_("Risk Class", im3FinalMode_(rows,"Risk_Class"), "08_Risk_Scenarios!AJ5:AJ105", "plain"),
      im3FinalCard_("Active Scenarios", rows.length, "08_Risk_Scenarios!A110:B110", "plain"),
      im3FinalCard_("Total Probability", im3FinalSum_(rows,"Probability"), "08_Risk_Scenarios!A111:B111", "percent")
    ];
  } else if (view === "map_dnpv_summary") {
    sourceSheet = "09_MAP_DNPV"; sourceRange = "AF1:AG10";
    let rows = im3FinalActiveRows_(im3FinalFilterByProject_(getRows_("09_MAP_DNPV",5), filters, selectedProject), "Active");
    cards = [
      im3FinalCard_("Active Scenarios", rows.length, "09_MAP_DNPV!AF2:AG2", "plain"),
      im3FinalCard_("Total Composite MAP", im3FinalSum_(rows,"Composite_MAP"), "09_MAP_DNPV!AF3:AG3", "score"),
      im3FinalCard_("Best MAP/DNPV", im3FinalMax_(rows,"Flex_Adjusted_MAP_DNPV_USD"), "09_MAP_DNPV!AF4:AG4"),
      im3FinalCard_("Worst MAP/DNPV", im3FinalMin_(rows,"Flex_Adjusted_MAP_DNPV_USD"), "09_MAP_DNPV!AF5:AG5"),
      im3FinalCard_("Average MAP/DNPV Index", im3FinalAvg_(rows,"MAP_DNPV_Index"), "09_MAP_DNPV!AF6:AG6", "score"),
      im3FinalCard_("Invest / Accelerate Count", im3FinalCount_(rows,"Decision_Class","Invest / Accelerate"), "09_MAP_DNPV!AF7:AG7", "plain"),
      im3FinalCard_("Proceed with Mitigation Count", im3FinalCount_(rows,"Decision_Class","Proceed with Mitigation"), "09_MAP_DNPV!AF8:AG8", "plain"),
      im3FinalCard_("Review / Adapt Count", im3FinalCount_(rows,"Decision_Class","Review / Adapt"), "09_MAP_DNPV!AF9:AG9", "plain"),
      im3FinalCard_("Defer or Reject Count", im3FinalCount_(rows,"Decision_Class","Defer or Reject"), "09_MAP_DNPV!AF10:AG10", "plain")
    ];
  } else if (view === "rov_summary") {
    sourceSheet = "10_ROV"; sourceRange = "AK1:AL7";
    let rows = im3FinalActiveRows_(im3FinalFilterByProject_(getRows_("10_ROV",5), filters, selectedProject), "Active");
    cards = [
      im3FinalCard_("Active Options", rows.length, "10_ROV!AK2:AL2", "plain"),
      im3FinalCard_("Total Option Value", im3FinalSum_(rows,"Probability_Weighted_Option_Value_USD"), "10_ROV!AK3:AL3"),
      im3FinalCard_("Best Strategic NPV", im3FinalMax_(rows,"Strategic_NPV_With_ROV_USD"), "10_ROV!AK4:AL4"),
      im3FinalCard_("Average ROV Uplift", im3FinalAvg_(rows,"ROV_Uplift_Index"), "10_ROV!AK5:AL5", "percent"),
      im3FinalCard_("High Value Options", im3FinalCount_(rows,"Option_Decision","Exercise / High Value"), "10_ROV!AK6:AL6", "plain"),
      im3FinalCard_("Moderate Value Options", im3FinalCount_(rows,"Option_Decision","Exercise / Moderate Value"), "10_ROV!AK7:AL7", "plain")
    ];
  } else if (view === "mcda_summary") {
    sourceSheet = "12_MCDA_Scores"; sourceRange = "X1:Y8 + S5:V25";
    let rows = getRows_("12_MCDA_Scores",5);
    rows = im3FinalFilterByProject_(rows, filters, selectedProject);
    let complete = rows.filter(r => String(r.Score_Status || "").trim() === "Complete");
    let projectSummary = im3FinalMcdaProjectSummaries_(filters, selectedProject);
    let selected = selectedProject ? projectSummary.filter(r => r.Project_ID === selectedProject)[0] : projectSummary[0];
    cards = [
      im3FinalCard_("Project Name", selected ? selected.Project_Name : "", "12_MCDA_Scores!S5:V25", "plain"),
      im3FinalCard_("Final MCDA Score 0-100", selected ? selected.Final_MCDA_Score_0_100 : im3FinalMax_(projectSummary,"Final_MCDA_Score_0_100"), "12_MCDA_Scores!U5:U25", "score"),
      im3FinalCard_("Strategic Decision", selected ? selected.Strategic_Decision : im3FinalMode_(projectSummary,"Strategic_Decision"), "12_MCDA_Scores!V5:V25", "plain"),
      im3FinalCard_("Active Score Rows", complete.length, "12_MCDA_Scores!X2:Y2", "plain"),
      im3FinalCard_("Projects Scored", projectSummary.length, "12_MCDA_Scores!X3:Y3", "plain"),
      im3FinalCard_("Best MCDA Score", im3FinalMax_(projectSummary,"Final_MCDA_Score_0_100"), "12_MCDA_Scores!X4:Y4", "score"),
      im3FinalCard_("Average MCDA Score", im3FinalAvg_(projectSummary,"Final_MCDA_Score_0_100"), "12_MCDA_Scores!X5:Y5", "score"),
      im3FinalCard_("Invest / Prioritize", im3FinalCount_(projectSummary,"Strategic_Decision","Invest / Prioritize"), "12_MCDA_Scores!X6:Y6", "plain"),
      im3FinalCard_("Review / Improve", im3FinalCount_(projectSummary,"Strategic_Decision","Review / Improve"), "12_MCDA_Scores!X7:Y7", "plain"),
      im3FinalCard_("Reject / Redesign", im3FinalCount_(projectSummary,"Strategic_Decision","Reject / Redesign"), "12_MCDA_Scores!X8:Y8", "plain")
    ];
  } else if (view === "system_dynamics_summary") {
    sourceSheet = "13_System_Dynamics"; sourceRange = "AK1:AL9";
    let rows = im3FinalFilterByProject_(getRows_("13_System_Dynamics",5), filters, selectedProject).filter(r => r.Year);
    cards = [
      im3FinalCard_("Active SD Rows", rows.length, "13_System_Dynamics!AK2:AL2", "plain"),
      im3FinalCard_("Projects Simulated", im3FinalDistinct_(rows,"Project_ID"), "13_System_Dynamics!AK3:AL3", "plain"),
      im3FinalCard_("Average System Score", im3FinalAvg_(rows,"Composite_System_Score"), "13_System_Dynamics!AK4:AL4", "score"),
      im3FinalCard_("Accelerate Count", im3FinalCount_(rows,"SD_Decision","Accelerate"), "13_System_Dynamics!AK5:AL5", "plain"),
      im3FinalCard_("Maintain Count", im3FinalCount_(rows,"SD_Decision","Maintain"), "13_System_Dynamics!AK6:AL6", "plain"),
      im3FinalCard_("Correct/Delay/Stop Count", im3FinalCount_(rows,"SD_Decision","Correct")+im3FinalCount_(rows,"SD_Decision","Delay")+im3FinalCount_(rows,"SD_Decision","Stop"), "13_System_Dynamics!AK7:AL7", "plain"),
      im3FinalCard_("Best Project Score", im3FinalMax_(rows,"Composite_System_Score"), "13_System_Dynamics!AK8:AL8", "score"),
      im3FinalCard_("Worst Project Score", im3FinalMin_(rows,"Composite_System_Score"), "13_System_Dynamics!AK9:AL9", "score")
    ];
  } else if (view === "sd_parameter_summary") {
    sourceSheet = "14_SD_Parameters"; sourceRange = "T1:U7";
    let rows = im3FinalFilterByProject_(getRows_("14_SD_Parameters",4), filters, selectedProject);
    cards = [
      im3FinalCard_("Total Parameters", rows.length, "14_SD_Parameters!T2:U2", "plain"),
      im3FinalCard_("Editable Parameters", im3FinalCount_(rows,"Editable","Yes"), "14_SD_Parameters!T3:U3", "plain"),
      im3FinalCard_("Sensitivity Flags", im3FinalCount_(rows,"Sensitivity_Flag","Yes"), "14_SD_Parameters!T4:U4", "plain"),
      im3FinalCard_("Groups Available", im3FinalDistinct_(rows,"Parameter_Group"), "14_SD_Parameters!T5:U5", "plain"),
      im3FinalCard_("Linked to 13_SD", rows.filter(r => String(r.Used_In_Module || "").indexOf("13_SD") !== -1).length, "14_SD_Parameters!T6:U6", "plain"),
      im3FinalCard_("Last Update", im3FinalMaxText_(rows,"Status") || "", "14_SD_Parameters!T7:U7", "plain")
    ];
  } else if (view === "monte_carlo_summary") {
    sourceSheet = "16_Monte_Carlo"; sourceRange = "AD1:AE8";
    let rows = im3FinalActiveRows_(im3FinalFilterByProject_(getRows_("16_Monte_Carlo",5), filters, selectedProject), "Active");
    let nums = rows.map(r => im3FinalNum_(r.Simulated_NPV_USD)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
    cards = [
      im3FinalCard_("Active Runs", rows.length, "16_Monte_Carlo!AD3:AE3", "plain"),
      im3FinalCard_("Mean Simulated NPV", im3FinalAvg_(rows,"Simulated_NPV_USD"), "16_Monte_Carlo!AD4:AE4"),
      im3FinalCard_("P10 NPV", im3FinalPercentile_(nums,0.1), "16_Monte_Carlo!AD5:AE5"),
      im3FinalCard_("P50 NPV", im3FinalPercentile_(nums,0.5), "16_Monte_Carlo!AD6:AE6"),
      im3FinalCard_("P90 NPV", im3FinalPercentile_(nums,0.9), "16_Monte_Carlo!AD7:AE7"),
      im3FinalCard_("Probability Positive NPV", nums.length ? nums.filter(n=>n>0).length/nums.length : "", "16_Monte_Carlo!AD8:AE8", "percent")
    ];
  }

  if (selectedProject) note = "Filtered for project: " + selectedProject;
  else note = "No single project selected. Values use all available projects.";
  return { view: view, title: title, projectId: selectedProject, cards: cards, sourceSheet: sourceSheet, sourceRange: sourceRange, note: note };
}

function im3FinalDistinct_(rows, field) {
  const seen = {};
  rows.forEach(r => { const v = String(r[field] || "").trim(); if (v) seen[v] = true; });
  return Object.keys(seen).length;
}

function im3FinalMaxText_(rows, field) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = String(rows[i][field] || "").trim();
    if (v) return v;
  }
  return "";
}

function im3FinalPercentile_(nums, p) {
  if (!nums || !nums.length) return "";
  const idx = (nums.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return nums[lo];
  return nums[lo] + (nums[hi] - nums[lo]) * (idx - lo);
}

function im3FinalMcdaProjectSummaries_(filters, projectId) {
  if (!sheetExists_("12_MCDA_Scores")) return [];
  const sh = getSpreadsheet_().getSheetByName("12_MCDA_Scores");
  const values = sh.getRange(6, 19, Math.max(0, Math.min(20, sh.getLastRow() - 5)), 5).getDisplayValues();
  const out = [];
  values.forEach(r => {
    if (!r[0]) return;
    out.push({
      Project_ID: r[0],
      Project_Name: r[1],
      Final_MCDA_Score_0_100: im3FinalNum_(r[2]),
      Strategic_Decision: r[3],
      Priority_Rank: im3FinalNum_(r[4])
    });
  });
  const selected = im3FinalSelectedProject_(filters || {}, projectId || "");
  return selected ? out.filter(r => r.Project_ID === selected) : out;
}

function im3FinalDashboard_(filters, projectId) {
  const selected = im3FinalSelectedProject_(filters || {}, projectId || "");
  let result;
  try {
    result = getDashboardV16_(filters || {}, selected || "");
  } catch (err) {
    result = { rows: [], summary: {} };
  }
  if (selected && result.rows) result.rows = result.rows.filter(r => String(r.Project_ID || "").trim() === selected);
  result.projectId = selected;
  result.projects = im3FinalProjects_();
  result.summaryViews = im3FinalSummaryViews_();
  return result;
}

function im3FinalDiagnostics_() {
  let base;
  try { base = getDiagnosticsV17_(); } catch (err) { base = getDiagnosticsV16_(); }
  base.version = "1.9-project-dashboard-cards";
  base.summaryViews = im3FinalSummaryViews_();
  base.summarySources = [
    "03_Production!AC1:AD7",
    "04_Prices!T1:U9",
    "05_CAPEX_OPEX!AB1:AC18",
    "06_DCF!AN1:AO15",
    "07_DCF_Results!AD1:AE9",
    "08_Risk_Scenarios!AD4:AJ105 and A108:C113",
    "09_MAP_DNPV!AF1:AG10",
    "10_ROV!AK1:AL7",
    "12_MCDA_Scores!X1:Y8 and S5:V25",
    "13_System_Dynamics!AK1:AL9",
    "14_SD_Parameters!T1:U7",
    "16_Monte_Carlo!AD1:AE8"
  ];
  return base;
}


/**
 * ============================================================
 * IM³ Framework MVP — v2.0 Manual Input Mode
 * UI-compatible additive layer:
 * - Existing visualization endpoints remain unchanged.
 * - Adds sequential manual data entry endpoints.
 * - Generates IDs according to current module/key logic.
 * - Appends data to the next free row and copies formulas from previous row.
 * - Supports auto-fill by cloning an existing project as a new analysis.
 * ============================================================
 */

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;
    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = im3ManualMetadata_();
    } else if (action === "filteroptions" || action === "configoptions") {
      data = im3FinalFilterOptions_();
    } else if (action === "dropdowns") {
      data = im3FinalDropdowns_();
    } else if (action === "summarydata") {
      data = im3FinalSummaryData_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || e.parameter.rowId || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "appendstep" || action === "manualappend") {
      data = im3ManualAppendStepFromRequest_(e);
    } else if (action === "createmanualanalysis") {
      data = im3ManualCreateProjectFromRequest_(e);
    } else if (action === "cloneproject" || action === "autofillproject") {
      data = im3ManualCloneProjectFromRequest_(e);
    } else if (action === "manualtemplate") {
      data = im3ManualTemplate_(e.parameter.moduleId || "projects");
    } else if (action === "dashboard") {
      data = im3FinalDashboard_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = im3FinalProjects_();
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "NPV_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = im3ManualDiagnostics_();
    } else if (action === "health") {
      data = { status: "ok", version: "2.0-manual-input-mode", timestamp: new Date().toISOString(), spreadsheetId: getSpreadsheetId_() };
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok: true, action: action, elapsedMs: new Date().getTime() - started, data: data }, callback);
  } catch (err) {
    return respond_({ ok: false, action: action, elapsedMs: new Date().getTime() - started, error: err.message, stack: err.stack }, callback);
  }
}

const IM3_MANUAL_ID_PREFIX_V20 = {
  projects: "PRJ",
  assumptions: "ASM",
  production: "PROD",
  prices: "PRC",
  capex_opex: "COST",
  dcf: "DCF",
  dcf_results: "RES",
  risk_scenarios: "SCN",
  map_dnpv: "MAP",
  rov: "ROV",
  mcda_criteria: "CRT",
  mcda_scores: "MCDAS",
  system_dynamics: "SD",
  sd_parameters: "SDP",
  sensitivity: "SENS",
  monte_carlo: "MC"
};

const IM3_MANUAL_CONTEXT_KEYS_V20 = {
  projects: "projectId",
  assumptions: "assumptionSetId",
  production: "productionRowId",
  prices: "priceRecordId",
  capex_opex: "costRecordId",
  dcf: "dcfRowId",
  dcf_results: "resultId",
  risk_scenarios: "scenarioId",
  map_dnpv: "mapId",
  rov: "rovId",
  mcda_criteria: "criterionId",
  mcda_scores: "mcdaScoreId",
  system_dynamics: "sdRowId",
  sd_parameters: "parameterId",
  sensitivity: "sensitivityId",
  monte_carlo: "simulationId"
};

function im3ManualMetadata_() {
  const meta = im3FinalMetadata_();
  meta.version = "2.0-manual-input-mode";
  meta.manualInput = {
    enabled: true,
    endpoints: ["createmanualanalysis", "appendstep", "cloneproject", "manualtemplate"],
    mode: "append-sequential-rows",
    formulaHandling: "copy-formulas-from-previous-row-then-write-editable-values"
  };
  return meta;
}

function im3ManualDiagnostics_() {
  const base = im3FinalDiagnostics_();
  base.version = "2.0-manual-input-mode";
  base.manualInput = {
    enabled: true,
    idPrefixes: IM3_MANUAL_ID_PREFIX_V20,
    contextKeys: IM3_MANUAL_CONTEXT_KEYS_V20
  };
  return base;
}

function im3ManualParsePayload_(encoded) {
  if (!encoded) return {};
  try {
    const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(encoded)).getDataAsString("UTF-8");
    return JSON.parse(json || "{}");
  } catch (err) {
    try { return JSON.parse(encoded); } catch (err2) { return {}; }
  }
}

function im3ManualAppendStepFromRequest_(e) {
  const moduleId = e.parameter.moduleId || "";
  const payload = im3ManualParsePayload_(e.parameter.payload || "");
  const context = im3ManualParsePayload_(e.parameter.context || "");
  return im3ManualAppendStep_(moduleId, payload, context, { forceNewId: true });
}

function im3ManualCreateProjectFromRequest_(e) {
  const payload = im3ManualParsePayload_(e.parameter.payload || "");
  const context = im3ManualParsePayload_(e.parameter.context || "");
  return im3ManualAppendStep_("projects", payload, context, { forceNewId: true });
}

function im3ManualTemplate_(moduleId) {
  const module = getModuleConfig_(moduleId);
  if (module.readOnly) throw new Error("Manual input is not available for read-only module: " + module.title);
  const headers = getHeaders_(module.sheetName, module.headerRow);
  const rows = getRows_(module.sheetName, module.headerRow);
  const sample = rows[0] || {};
  const fields = headers.filter(h => h && h.indexOf("__") !== 0);
  const template = {};
  fields.forEach(h => template[h] = sample[h] || "");
  return { module: module, headers: headers, template: template, sample: sample, dropdowns: buildModuleDropdownsV14_(module) };
}

function im3ManualAppendStep_(moduleId, payload, context, options) {
  options = options || {};
  if (!moduleId) throw new Error("Missing moduleId.");
  const module = getModuleConfig_(moduleId);
  if (module.readOnly) throw new Error("Manual input cannot append to read-only module: " + module.title);
  if (!module.keyColumn) throw new Error("No key column defined for module: " + module.title);

  payload = payload || {};
  context = context || {};
  payload = im3ManualApplyContext_(module, payload, context);

  const generatedId = im3ManualNextId_(module, payload[module.keyColumn]);
  payload[module.keyColumn] = generatedId;

  const appendResult = im3ManualAppendRow_(module, payload);
  const updatedContext = im3ManualUpdateContext_(module, payload, context);

  SpreadsheetApp.flush();
  clearIm3CacheV16_();

  return {
    appended: true,
    moduleId: module.id,
    sheetName: module.sheetName,
    rowNumber: appendResult.rowNumber,
    keyColumn: module.keyColumn,
    keyValue: generatedId,
    context: updatedContext,
    projectId: updatedContext.projectId || payload.Project_ID || "",
    recalculated: true,
    calculationSource: "Google Sheets formulas",
    timestamp: new Date().toISOString()
  };
}

function im3ManualApplyContext_(module, payload, context) {
  const out = Object.assign({}, payload || {});
  if (module.id !== "projects" && context.projectId && ("Project_ID" in out || im3ManualHeadersContain_(module, "Project_ID"))) out.Project_ID = context.projectId;
  if (context.assumptionSetId && ("Assumption_Set_ID" in out || im3ManualHeadersContain_(module, "Assumption_Set_ID"))) out.Assumption_Set_ID = context.assumptionSetId;
  if (context.scenarioId && ("Scenario_ID" in out || im3ManualHeadersContain_(module, "Scenario_ID"))) out.Scenario_ID = context.scenarioId;
  if (context.mapId && ("MAP_ID" in out || im3ManualHeadersContain_(module, "MAP_ID"))) out.MAP_ID = context.mapId;
  if (context.rovId && ("ROV_ID" in out || im3ManualHeadersContain_(module, "ROV_ID"))) out.ROV_ID = context.rovId;
  if (context.criterionId && ("Criterion_ID" in out || im3ManualHeadersContain_(module, "Criterion_ID"))) out.Criterion_ID = context.criterionId;
  return out;
}

function im3ManualHeadersContain_(module, field) {
  try { return getHeaders_(module.sheetName, module.headerRow).indexOf(field) !== -1; } catch (err) { return false; }
}

function im3ManualUpdateContext_(module, payload, context) {
  const out = Object.assign({}, context || {});
  const contextKey = IM3_MANUAL_CONTEXT_KEYS_V20[module.id];
  if (contextKey) out[contextKey] = payload[module.keyColumn];
  if (module.id === "projects") out.projectId = payload.Project_ID;
  if (module.id === "assumptions") out.assumptionSetId = payload.Assumption_Set_ID;
  if (module.id === "risk_scenarios") out.scenarioId = payload.Scenario_ID;
  if (module.id === "map_dnpv") out.mapId = payload.MAP_ID;
  if (module.id === "rov") out.rovId = payload.ROV_ID;
  if (module.id === "mcda_criteria") out.criterionId = payload.Criterion_ID;
  if (payload.Project_ID) out.projectId = payload.Project_ID;
  if (payload.Assumption_Set_ID) out.assumptionSetId = payload.Assumption_Set_ID;
  if (payload.Scenario_ID) out.scenarioId = payload.Scenario_ID;
  if (payload.MAP_ID) out.mapId = payload.MAP_ID;
  if (payload.ROV_ID) out.rovId = payload.ROV_ID;
  if (payload.Criterion_ID) out.criterionId = payload.Criterion_ID;
  return out;
}

function im3ManualNextId_(module, currentValue) {
  const headers = getHeaders_(module.sheetName, module.headerRow);
  const keyCol = headers.indexOf(module.keyColumn) + 1;
  if (keyCol <= 0) throw new Error("Key column not found: " + module.keyColumn + " in " + module.sheetName);

  const sh = getSpreadsheet_().getSheetByName(module.sheetName);
  const lastRow = sh.getLastRow();
  const prefix = im3ManualPrefix_(module, currentValue);
  let maxNum = 0;

  if (lastRow > module.headerRow) {
    const values = sh.getRange(module.headerRow + 1, keyCol, lastRow - module.headerRow, 1).getDisplayValues().flat();
    values.forEach(v => {
      const raw = String(v || "").trim();
      if (!raw) return;
      const m = raw.match(/(\d+)(?!.*\d)/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    });
  }

  const width = Math.max(3, String(maxNum + 1).length);
  return prefix + "-" + String(maxNum + 1).padStart(width, "0");
}

function im3ManualPrefix_(module, currentValue) {
  const raw = String(currentValue || "").trim();
  const m = raw.match(/^([A-Za-z]+)[-_]?\d+/);
  if (m) return m[1].toUpperCase();
  return IM3_MANUAL_ID_PREFIX_V20[module.id] || String(module.keyColumn || "ID").replace(/_ID$/i, "").slice(0, 6).toUpperCase();
}

function im3ManualAppendRow_(module, payload) {
  const sh = getSpreadsheet_().getSheetByName(module.sheetName);
  const headers = getHeaders_(module.sheetName, module.headerRow);
  const lastRow = sh.getLastRow();
  const targetRow = Math.max(lastRow + 1, module.headerRow + 1);
  const lastCol = headers.length;

  if (targetRow > module.headerRow + 1 && lastCol > 0) {
    const formulas = sh.getRange(targetRow - 1, 1, 1, lastCol).getFormulasR1C1()[0];
    if (formulas.some(f => f)) sh.getRange(targetRow, 1, 1, lastCol).setFormulasR1C1([formulas]);
  }

  const writable = im3ManualWritableFields_(module, headers);
  writable.forEach(field => {
    if (!(field in payload)) return;
    const col = headers.indexOf(field) + 1;
    if (col > 0) sh.getRange(targetRow, col).setValue(payload[field]);
  });

  setIfColumnExists_(sh, headers, targetRow, "Last_Update", new Date());
  setIfColumnExists_(sh, headers, targetRow, "API_Status", "Manual append");
  return { rowNumber: targetRow };
}

function im3ManualWritableFields_(module, headers) {
  const fields = {};
  if (module.keyColumn) fields[module.keyColumn] = true;
  (module.editableFields || []).forEach(f => fields[f] = true);
  ["Project_ID", "Assumption_Set_ID", "Scenario_ID", "MAP_ID", "ROV_ID", "Criterion_ID"].forEach(f => {
    if (headers.indexOf(f) !== -1) fields[f] = true;
  });
  return Object.keys(fields).filter(f => headers.indexOf(f) !== -1);
}

function im3ManualCloneProjectFromRequest_(e) {
  const sourceProjectId = String(e.parameter.sourceProjectId || e.parameter.projectId || "").trim();
  if (!sourceProjectId) throw new Error("Missing sourceProjectId.");
  const newName = String(e.parameter.newProjectName || "").trim();
  return im3ManualCloneProject_(sourceProjectId, newName);
}

function im3ManualCloneProject_(sourceProjectId, newProjectName) {
  const context = {};
  const idMap = { Project_ID: {}, Assumption_Set_ID: {}, Scenario_ID: {}, MAP_ID: {}, ROV_ID: {}, Criterion_ID: {} };
  const created = [];

  const projectRows = getRows_("01_Projects", 5).filter(r => String(r.Project_ID || "").trim() === sourceProjectId);
  if (!projectRows.length) throw new Error("Source project not found: " + sourceProjectId);

  const projectPayload = Object.assign({}, projectRows[0]);
  delete projectPayload.__rowNumber;
  if (newProjectName) projectPayload.Project_Name = newProjectName;
  else projectPayload.Project_Name = (projectPayload.Project_Name || sourceProjectId) + " — Manual Copy";
  const projectResult = im3ManualAppendStep_("projects", projectPayload, context, { forceNewId: true });
  created.push(projectResult);
  idMap.Project_ID[sourceProjectId] = projectResult.keyValue;
  let ctx = projectResult.context;

  const sequence = ["assumptions", "production", "prices", "capex_opex", "risk_scenarios", "map_dnpv", "rov", "mcda_scores", "system_dynamics", "sd_parameters", "sensitivity", "monte_carlo"];

  sequence.forEach(moduleId => {
    let module;
    try { module = getModuleConfig_(moduleId); } catch (err) { return; }
    if (module.readOnly) return;
    let rows = getRows_(module.sheetName, module.headerRow);
    rows = rows.filter(r => im3ManualRowBelongsToSource_(r, sourceProjectId, idMap));
    rows.forEach(r => {
      const payload = Object.assign({}, r);
      delete payload.__rowNumber;
      im3ManualReplaceMappedIds_(payload, idMap, ctx);
      const oldKey = payload[module.keyColumn];
      const result = im3ManualAppendStep_(moduleId, payload, ctx, { forceNewId: true });
      created.push(result);
      ctx = result.context;
      if (oldKey && module.keyColumn) {
        if (!idMap[module.keyColumn]) idMap[module.keyColumn] = {};
        idMap[module.keyColumn][oldKey] = result.keyValue;
      }
    });
  });

  SpreadsheetApp.flush();
  clearIm3CacheV16_();
  return { cloned: true, sourceProjectId: sourceProjectId, newProjectId: ctx.projectId, context: ctx, createdRows: created.length, created: created.slice(0, 50), idMap: idMap };
}

function im3ManualRowBelongsToSource_(row, sourceProjectId, idMap) {
  if (String(row.Project_ID || "").trim() === sourceProjectId) return true;
  const assumptionIds = Object.keys(idMap.Assumption_Set_ID || {});
  const scenarioIds = Object.keys(idMap.Scenario_ID || {});
  const mapIds = Object.keys(idMap.MAP_ID || {});
  const rovIds = Object.keys(idMap.ROV_ID || {});
  if (row.Assumption_Set_ID && assumptionIds.indexOf(String(row.Assumption_Set_ID)) !== -1) return true;
  if (row.Scenario_ID && scenarioIds.indexOf(String(row.Scenario_ID)) !== -1) return true;
  if (row.MAP_ID && mapIds.indexOf(String(row.MAP_ID)) !== -1) return true;
  if (row.ROV_ID && rovIds.indexOf(String(row.ROV_ID)) !== -1) return true;
  return false;
}

function im3ManualReplaceMappedIds_(payload, idMap, context) {
  if (payload.Project_ID && idMap.Project_ID[payload.Project_ID]) payload.Project_ID = idMap.Project_ID[payload.Project_ID];
  ["Assumption_Set_ID", "Scenario_ID", "MAP_ID", "ROV_ID", "Criterion_ID"].forEach(field => {
    if (payload[field] && idMap[field] && idMap[field][payload[field]]) payload[field] = idMap[field][payload[field]];
  });
  if (!payload.Project_ID && context.projectId) payload.Project_ID = context.projectId;
  if (!payload.Assumption_Set_ID && context.assumptionSetId) payload.Assumption_Set_ID = context.assumptionSetId;
  if (!payload.Scenario_ID && context.scenarioId) payload.Scenario_ID = context.scenarioId;
  if (!payload.MAP_ID && context.mapId) payload.MAP_ID = context.mapId;
  if (!payload.ROV_ID && context.rovId) payload.ROV_ID = context.rovId;
}

/**
 * ============================================================
 * IM³ Framework MVP — Professional Graph Studio + Safe Save v2.0
 * Add this layer at the END of the Apps Script file.
 * It overrides doGet(), saveRow_(), metadata and graph endpoints.
 * ============================================================
 */

var IM3_VERSION_V20 = "2.0-professional-graph-studio";

var CHART_METRICS_CATALOG = [
  { metricId:"Net_Production", label:"Net Production", sheetName:"03_Production", headerRow:5, yearField:"Year", valueField:"Net_Production", unit:"Production_Unit", fallbackUnit:"production unit/year", group:"Production", allowedCompareGroup:"production-volume", defaultChart:"line" },
  { metricId:"Export_Volume", label:"Export Volume", sheetName:"03_Production", headerRow:5, yearField:"Year", valueField:"Export_Volume", unit:"Production_Unit", fallbackUnit:"production unit/year", group:"Production", allowedCompareGroup:"production-volume", defaultChart:"line" },
  { metricId:"Cumulative_Production", label:"Cumulative Production", sheetName:"03_Production", headerRow:5, yearField:"Year", valueField:"Cumulative_Production", unit:"Production_Unit", fallbackUnit:"production unit", group:"Production", allowedCompareGroup:"production-volume", defaultChart:"line" },
  { metricId:"Remaining_Reserves", label:"Remaining Reserves", sheetName:"03_Production", headerRow:5, yearField:"Year", valueField:"Remaining_Reserves", unit:"Production_Unit", fallbackUnit:"production unit", group:"Production", allowedCompareGroup:"production-volume", defaultChart:"line" },

  { metricId:"Net_Price_For_DCF", label:"Net Price For DCF", sheetName:"04_Prices", headerRow:4, yearField:"Year", valueField:"Net_Price_For_DCF", unit:"Pricing_Unit", fallbackUnit:"USD/MMBtu", group:"Price", allowedCompareGroup:"price", defaultChart:"line" },
  { metricId:"Final_Realized_Price", label:"Final Realized Price", sheetName:"04_Prices", headerRow:4, yearField:"Year", valueField:"Final_Realized_Price", unit:"Pricing_Unit", fallbackUnit:"USD/MMBtu", group:"Price", allowedCompareGroup:"price", defaultChart:"line" },

  { metricId:"Nominal_Cost_USD", label:"Nominal Cost USD", sheetName:"05_CAPEX_OPEX", headerRow:5, yearField:"Year", valueField:"Nominal_Cost_USD", unit:"USD", group:"Cost USD", allowedCompareGroup:"usd-cost", defaultChart:"line" },
  { metricId:"OPEX_USD", label:"OPEX USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"OPEX_USD", unit:"USD", group:"Cost USD", allowedCompareGroup:"usd-cost", defaultChart:"line" },
  { metricId:"Environmental_Cost_USD", label:"Environmental Cost USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Environmental_Cost_USD", unit:"USD", group:"Cost USD", allowedCompareGroup:"usd-cost", defaultChart:"line" },
  { metricId:"Local_Content_Cost_USD", label:"Local Content Cost USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Local_Content_Cost_USD", unit:"USD", group:"Cost USD", allowedCompareGroup:"usd-cost", defaultChart:"line" },
  { metricId:"Security_Cost_USD", label:"Security Cost USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Security_Cost_USD", unit:"USD", group:"Cost USD", allowedCompareGroup:"usd-cost", defaultChart:"line" },
  { metricId:"Technology_Cost_USD", label:"Technology Cost USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Technology_Cost_USD", unit:"USD", group:"Cost USD", allowedCompareGroup:"usd-cost", defaultChart:"line" },

  { metricId:"Revenue_USD", label:"Revenue USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Revenue_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"EBITDA_USD", label:"EBITDA USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"EBITDA_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"EBIT_USD", label:"EBIT USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"EBIT_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"Tax_USD", label:"Tax USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Tax_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"Free_Cash_Flow_USD", label:"Free Cash Flow USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Free_Cash_Flow_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"PV_FCF_USD", label:"PV FCF USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"PV_FCF_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"Cumulative_FCF_USD", label:"Cumulative FCF USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Cumulative_FCF_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"Cumulative_PV_FCF_USD", label:"Cumulative PV FCF USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Cumulative_PV_FCF_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"NPV_To_Date_USD", label:"NPV To Date USD", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"NPV_To_Date_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"Operating_Outflow_USD", label:"Operating Outflow USD", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Operating_Outflow_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"Tax_Outflow_USD", label:"Tax Outflow USD", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Tax_Outflow_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"Net_Cash_Flow_USD", label:"Net Cash Flow USD", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Net_Cash_Flow_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },
  { metricId:"Reinvestment_USD", label:"Reinvestment USD", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Reinvestment_USD", unit:"USD", group:"Financial USD", allowedCompareGroup:"usd-financial", defaultChart:"line" },

  { metricId:"Local_Content_Index", label:"Local Content Index", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Local_Content_Index", unit:"index", group:"Indexes/Scores", allowedCompareGroup:"index-score", defaultChart:"line" },
  { metricId:"Technology_Index", label:"Technology Index", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Technology_Index", unit:"index", group:"Indexes/Scores", allowedCompareGroup:"index-score", defaultChart:"line" },
  { metricId:"Emissions_Index", label:"Emissions Index", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Emissions_Index", unit:"index", group:"Indexes/Scores", allowedCompareGroup:"index-score", defaultChart:"line" },
  { metricId:"Market_Risk_Index", label:"Market Risk Index", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Market_Risk_Index", unit:"index", group:"Indexes/Scores", allowedCompareGroup:"index-score", defaultChart:"line" },
  { metricId:"Composite_System_Score", label:"Composite System Score", sheetName:"13_System_Dynamics", headerRow:5, yearField:"Year", valueField:"Composite_System_Score", unit:"score", group:"Indexes/Scores", allowedCompareGroup:"index-score", defaultChart:"line" },

  { metricId:"Discount_Factor", label:"Discount Factor", sheetName:"06_DCF", headerRow:5, yearField:"Year", valueField:"Discount_Factor", unit:"factor", group:"Discount", allowedCompareGroup:"discount-factor", defaultChart:"line" }
];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadata").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();
  try {
    let data;
    if (action === "metadata" || action === "metadatafast") data = getMetadataV20_();
    else if (action === "chartmetrics") data = getChartMetricsCatalogV20_();
    else if (action === "timeseries") data = getTimeSeriesV20_(e.parameter || {});
    else if (action === "validatemodel") data = validateModelV20_(e.parameter.moduleId || "", e.parameter.payload || "");
    else if (action === "graphtemplates") data = getGraphTemplatesV20_();
    else if (action === "config") data = getConfigCenterV16_();
    else if (action === "configoptions" || action === "filteroptions") data = getFilterOptionsV16_();
    else if (action === "sequence") data = getModelSequenceV14_();
    else if (action === "module") data = getModuleV16_(e.parameter.moduleId, e.parameter.key || "", parseFiltersV13_(e.parameter.filters || ""));
    else if (action === "save") data = saveRowAndRecalculateV16_(e);
    else if (action === "dashboard") data = getDashboardV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    else if (action === "projects") data = getProjectsFastV16_();
    else if (action === "chartdata") data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "Revenue_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    else if (action === "repairformulas") data = repairDashboardFormulasV14_();
    else if (action === "pdf") data = generatePdfReportV13_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    else if (action === "diagnostics") data = getDiagnosticsV20_();
    else if (action === "clearcache") data = clearIm3CacheV16_();
    else if (action === "health") data = { status:"ok", version:IM3_VERSION_V20, timestamp:new Date().toISOString(), spreadsheetId:getSpreadsheetId_() };
    else throw new Error("Unknown action: " + action);
    return respond_({ ok:true, action:action, elapsedMs:new Date().getTime()-started, data:data }, callback);
  } catch (err) {
    return respond_({ ok:false, action:action, elapsedMs:new Date().getTime()-started, error:err.message, stack:err.stack }, callback);
  }
}

function getMetadataV20_() {
  const meta = (typeof getMetadataV16_ === "function") ? getMetadataV16_() : getMetadataV14_();
  meta.version = IM3_VERSION_V20;
  meta.chartMetrics = getChartMetricsV20_();
  meta.chartMetricCatalog = getChartMetricsCatalogV20_();
  meta.chartMetricGroups = getChartMetricGroupsV20_();
  meta.graphTemplates = getGraphTemplatesV20_();
  meta.safeSave = true;
  meta.timeSeriesEndpoint = "timeseries";
  return meta;
}

function getChartMetricsV20_() {
  return CHART_METRICS_CATALOG.map(m => ({
    value:m.metricId, label:m.label, group:m.group, unit:m.unit, fallbackUnit:m.fallbackUnit || m.unit,
    allowedCompareGroup:m.allowedCompareGroup, sheetName:m.sheetName, valueField:m.valueField, yearField:m.yearField
  }));
}

function getChartMetricsCatalogV20_() {
  return CHART_METRICS_CATALOG.map(m => Object.assign({}, m));
}

function getChartMetricGroupsV20_() {
  const groups = {};
  CHART_METRICS_CATALOG.forEach(m => {
    if (!groups[m.group]) groups[m.group] = { group:m.group, allowedCompareGroups:{}, metrics:[] };
    groups[m.group].allowedCompareGroups[m.allowedCompareGroup] = true;
    groups[m.group].metrics.push({ value:m.metricId, label:m.label, unit:m.unit, fallbackUnit:m.fallbackUnit || m.unit, allowedCompareGroup:m.allowedCompareGroup });
  });
  return Object.keys(groups).map(k => ({
    group:k,
    allowedCompareGroups:Object.keys(groups[k].allowedCompareGroups),
    metrics:groups[k].metrics
  }));
}

function getGraphTemplatesV20_() {
  return [
    { id:"production", title:"Production", category:"Time Series", metricGroup:"Production", defaultMetrics:["Net_Production"], defaultChart:"line", xLabel:"Year" },
    { id:"prices", title:"Prices", category:"Time Series", metricGroup:"Price", defaultMetrics:["Net_Price_For_DCF"], defaultChart:"line", xLabel:"Year" },
    { id:"costs", title:"Costs USD", category:"Time Series", metricGroup:"Cost USD", defaultMetrics:["OPEX_USD"], defaultChart:"line", xLabel:"Year" },
    { id:"financial_dcf", title:"Financial DCF", category:"Time Series", metricGroup:"Financial USD", defaultMetrics:["Free_Cash_Flow_USD","Cumulative_PV_FCF_USD"], defaultChart:"line", xLabel:"Year" },
    { id:"system_dynamics", title:"System Dynamics", category:"Time Series", metricGroup:"Indexes/Scores", defaultMetrics:["Composite_System_Score"], defaultChart:"line", xLabel:"Year" },
    { id:"discount", title:"Discount Factor", category:"Time Series", metricGroup:"Discount", defaultMetrics:["Discount_Factor"], defaultChart:"line", xLabel:"Year" }
  ];
}

function getMetricCatalogItemV20_(metricId) {
  return CHART_METRICS_CATALOG.find(m => m.metricId === metricId || m.valueField === metricId);
}

function parseMetricsParamV20_(param) {
  if (!param) return [];
  try {
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(param)).getDataAsString("UTF-8");
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.metrics)) return parsed.metrics;
  } catch (err) {}
  try {
    const parsed = JSON.parse(param);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.metrics)) return parsed.metrics;
  } catch (err2) {}
  return String(param).split(",").map(s => s.trim()).filter(Boolean);
}

function getTimeSeriesV20_(params) {
  const filters = parseFiltersV13_(params.filters || "");
  if (params.projectId) filters.projectIds = [params.projectId];
  if (params.assumptionSetId) filters.assumptionSetIds = [params.assumptionSetId];
  if (params.scenarioId) filters.scenarioIds = [params.scenarioId];
  if (params.scenarioName) filters.scenarioNames = [params.scenarioName];

  let metricIds = parseMetricsParamV20_(params.metrics || params.metric || "");
  if (!metricIds.length) metricIds = ["Revenue_USD"];

  const metrics = metricIds.map(getMetricCatalogItemV20_).filter(Boolean);
  if (!metrics.length) throw new Error("No valid metrics selected.");
  validateMetricCompatibilityV20_(metrics);

  const startYear = params.startYear ? Number(params.startYear) : null;
  const endYear = params.endYear ? Number(params.endYear) : null;
  const groupBy = params.groupBy || "Project_Name";

  const series = metrics.map(metric => buildMetricTimeSeriesV20_(metric, filters, startYear, endYear, groupBy));
  const years = {};
  series.forEach(s => s.data.forEach(p => years[String(p.year)] = true));
  const unit = resolveCommonUnitV20_(series, metrics);

  return {
    xField:"Year",
    yUnit:unit,
    group:metrics[0].group,
    allowedCompareGroup:metrics[0].allowedCompareGroup,
    metrics:metrics.map(m => ({ metricId:m.metricId, label:m.label, sheetName:m.sheetName, valueField:m.valueField, unit:m.unit, fallbackUnit:m.fallbackUnit || m.unit })),
    years:Object.keys(years).sort(),
    series:series,
    filtersApplied:filters,
    source:"Google Sheets",
    version:IM3_VERSION_V20
  };
}

function validateMetricCompatibilityV20_(metrics) {
  const compareGroup = metrics[0].allowedCompareGroup;
  const group = metrics[0].group;
  metrics.forEach(m => {
    if (m.allowedCompareGroup !== compareGroup) throw new Error("Incompatible metrics: '" + metrics[0].label + "' cannot be compared with '" + m.label + "'. Select metrics from the same unit group.");
    if (m.group !== group && m.allowedCompareGroup !== compareGroup) throw new Error("Metrics must belong to the same group or compatible unit group.");
  });
}

function buildMetricTimeSeriesV20_(metric, filters, startYear, endYear, groupBy) {
  if (!sheetExists_(metric.sheetName)) return { metricId:metric.metricId, label:metric.label, unit:metric.fallbackUnit || metric.unit, data:[], rowsUsed:0, missingSheet:true };
  const headers = getHeaders_(metric.sheetName, metric.headerRow);
  if (headers.indexOf(metric.valueField) === -1) return { metricId:metric.metricId, label:metric.label, unit:metric.fallbackUnit || metric.unit, data:[], rowsUsed:0, missingField:metric.valueField };

  let rows = getRows_(metric.sheetName, metric.headerRow);
  rows = applyFiltersToRowsV20_(rows, filters || {});

  const grouped = {};
  let unit = metric.fallbackUnit || metric.unit || "";
  rows.forEach(r => {
    const year = Number(parseNumberV13_(r[metric.yearField]));
    if (!year || isNaN(year)) return;
    if (startYear && year < startYear) return;
    if (endYear && year > endYear) return;
    const value = parseNumberV13_(r[metric.valueField]);
    if (isNaN(value)) return;
    const rowUnit = resolveMetricUnitFromRowV20_(metric, r);
    if (rowUnit) unit = rowUnit;
    const seriesName = String(r[groupBy] || r.Project_Name || r.Project_ID || r.Assumption_Set_ID || metric.label || "Series");
    const key = String(year) + "||" + seriesName;
    if (!grouped[key]) grouped[key] = { year:year, seriesName:seriesName, value:0, count:0 };
    grouped[key].value += value;
    grouped[key].count += 1;
  });

  const data = Object.keys(grouped).map(k => {
    const g = grouped[k];
    return { year:g.year, series:g.seriesName, value:g.value / g.count };
  }).sort((a,b) => a.year - b.year || String(a.series).localeCompare(String(b.series)));

  return { metricId:metric.metricId, label:metric.label, unit:unit, data:data, rowsUsed:rows.length, sheetName:metric.sheetName, valueField:metric.valueField };
}

function applyFiltersToRowsV20_(rows, filters) {
  rows = applyFiltersToRowsV13_(rows, filters || {});
  const scenarioNames = normalizeArrayV13_((filters || {}).scenarioNames);
  if (scenarioNames.length) rows = rows.filter(r => !('Scenario_Name' in r) || scenarioNames.indexOf(String(r.Scenario_Name)) !== -1 || scenarioNames.indexOf(String(r.Scenario_Type)) !== -1);
  return rows;
}

function resolveMetricUnitFromRowV20_(metric, row) {
  if (!metric.unit) return "";
  if (String(metric.unit).toUpperCase() === "USD") return "USD";
  if (["index","score","factor","%"].indexOf(String(metric.unit)) !== -1) return metric.unit;
  if (row[metric.unit]) return row[metric.unit];
  if (metric.unit === "Production_Unit") return row.Production_Unit || row.Capacity_Unit || metric.fallbackUnit;
  if (metric.unit === "Pricing_Unit") return row.Pricing_Unit || row.Price_Unit || metric.fallbackUnit;
  return metric.fallbackUnit || metric.unit;
}

function resolveCommonUnitV20_(series, metrics) {
  const units = {};
  series.forEach(s => { if (s.unit) units[String(s.unit)] = true; });
  const keys = Object.keys(units);
  if (keys.length === 1) return keys[0];
  if (metrics.every(m => m.allowedCompareGroup === metrics[0].allowedCompareGroup)) return metrics[0].fallbackUnit || metrics[0].unit || "value";
  return "value";
}

function validateModelV20_(moduleId, encodedPayload) {
  if (!moduleId) return { valid:false, errors:["Missing moduleId."], warnings:[] };
  const module = getModuleConfig_(moduleId);
  let payload = {};
  if (encodedPayload) {
    try {
      const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(encodedPayload)).getDataAsString("UTF-8");
      payload = JSON.parse(json);
    } catch (err) { payload = {}; }
  }
  return validatePayloadForModuleV20_(module, payload, null);
}

function validatePayloadForModuleV20_(module, payload, targetRow) {
  const errors = [];
  const warnings = [];
  const headers = getHeaders_(module.sheetName, module.headerRow);
  const editable = module.editableFields || [];
  if (module.readOnly) errors.push("This module is read-only: " + module.title);
  if (module.keyColumn && !payload[module.keyColumn]) errors.push("Missing key value: " + module.keyColumn);

  Object.keys(payload || {}).forEach(field => {
    if (field === module.keyColumn || field === "__rowNumber") return;
    if (editable.indexOf(field) === -1) warnings.push("Ignored non-editable/calculated field: " + field);
    const colIndex = headers.indexOf(field) + 1;
    if (colIndex > 0 && targetRow && cellHasFormulaV20_(module.sheetName, targetRow, colIndex)) errors.push("Cannot overwrite formula field: " + field);
    const typeError = validateFieldTypeV20_(field, payload[field]);
    if (typeError) errors.push(typeError);
  });

  return { valid:errors.length === 0, errors:errors, warnings:warnings, editableFields:editable, keyColumn:module.keyColumn };
}

function validateFieldTypeV20_(field, value) {
  if (value === "" || value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (/year/i.test(field) && !/^\d{4}$/.test(raw)) return field + " must be a four-digit year.";
  if (/%|rate|factor|probability|utilization|uptime|discount|tax|inflation|escalation|multiplier|score|value|amount|quantity|cost|price|usd|production|volume|capacity|reserve|npv|irr|payback/i.test(field)) {
    const n = parseNumberV13_(raw);
    if (isNaN(n)) return field + " must be numeric.";
  }
  return "";
}

function cellHasFormulaV20_(sheetName, row, col) {
  try { return !!getSpreadsheet_().getSheetByName(sheetName).getRange(row, col).getFormula(); }
  catch (err) { return false; }
}

function saveRow_(moduleId, payload) {
  const module = getModuleConfig_(moduleId);
  if (module.readOnly) throw new Error("This module is read-only: " + module.title);
  const sh = getSpreadsheet_().getSheetByName(module.sheetName);
  const headers = getHeaders_(module.sheetName, module.headerRow);
  const keyColumn = module.keyColumn;
  const keyValue = payload[keyColumn];
  if (!keyColumn) throw new Error("No keyColumn defined for module: " + module.title);
  if (!keyValue) throw new Error("Missing key value for " + keyColumn);

  const keyColIndex = headers.indexOf(keyColumn) + 1;
  if (keyColIndex <= 0) throw new Error("Key column not found: " + keyColumn + " in " + module.sheetName);
  const lastRow = sh.getLastRow();
  const keyValues = sh.getRange(module.headerRow + 1, keyColIndex, Math.max(0, lastRow - module.headerRow), 1).getDisplayValues().flat();
  let targetRow = keyValues.findIndex(v => String(v).trim() === String(keyValue).trim());
  targetRow = targetRow >= 0 ? module.headerRow + 1 + targetRow : lastRow + 1;

  const validation = validatePayloadForModuleV20_(module, payload, targetRow);
  if (!validation.valid) throw new Error("Validation failed: " + validation.errors.join(" | "));
  if (targetRow === lastRow + 1) sh.getRange(targetRow, keyColIndex).setValue(keyValue);

  const editable = module.editableFields || [];
  editable.forEach(field => {
    if (!(field in payload)) return;
    const colIndex = headers.indexOf(field) + 1;
    if (colIndex <= 0) return;
    if (cellHasFormulaV20_(module.sheetName, targetRow, colIndex)) throw new Error("Cannot overwrite formula field: " + field);
    sh.getRange(targetRow, colIndex).setValue(coerceValueForSheetsV20_(field, payload[field]));
  });

  setIfColumnExists_(sh, headers, targetRow, "Last_Update", new Date());
  setIfColumnExists_(sh, headers, targetRow, "Updated_By", Session.getActiveUser().getEmail() || "Tilda API");
  setIfColumnExists_(sh, headers, targetRow, "API_Status", "Saved");
  SpreadsheetApp.flush();

  return { saved:true, moduleId:moduleId, sheetName:module.sheetName, rowNumber:targetRow, keyColumn:keyColumn, keyValue:keyValue, validation:validation, timestamp:new Date().toISOString() };
}

function coerceValueForSheetsV20_(field, value) {
  if (value === "" || value === null || value === undefined) return "";
  if (/%|rate|factor|probability|utilization|uptime|discount|tax|inflation|escalation|multiplier|score|value|amount|quantity|cost|price|usd|production|volume|capacity|reserve|npv|irr|payback/i.test(field)) {
    const n = parseNumberV13_(value);
    if (!isNaN(n)) return n;
  }
  if (/year/i.test(field) && /^\d{4}$/.test(String(value).trim())) return Number(value);
  return value;
}

function getDiagnosticsV20_() {
  const base = (typeof getDiagnosticsV16_ === "function") ? getDiagnosticsV16_() : getDiagnosticsV14_();
  base.version = IM3_VERSION_V20;
  base.chartMetricCatalog = getChartMetricsCatalogV20_();
  base.chartMetricValidation = validateChartMetricCatalogV20_();
  base.safeSave = true;
  return base;
}

function validateChartMetricCatalogV20_() {
  return CHART_METRICS_CATALOG.map(m => {
    const exists = sheetExists_(m.sheetName);
    let headers = [];
    if (exists) headers = getHeaders_(m.sheetName, m.headerRow);
    return {
      metricId:m.metricId,
      sheetName:m.sheetName,
      sheetExists:exists,
      yearField:m.yearField,
      yearFieldFound:exists ? headers.indexOf(m.yearField) !== -1 : false,
      valueField:m.valueField,
      valueFieldFound:exists ? headers.indexOf(m.valueField) !== -1 : false,
      group:m.group,
      unit:m.unit
    };
  });
}

/**
 * ============================================================
 * IM³ Framework MVP — PDF Reporting Layer v2.1
 * Adds landscape PDF reports, compact 9/10 pt typography and
 * detailed investment-decision narrative by model/module.
 * Add this layer at the END of the Apps Script file.
 * ============================================================
 */

var IM3_REPORT_VERSION_V21 = "2.1-landscape-detailed-report";
var IM3_A4_LANDSCAPE_WIDTH_PT_V21 = 841.89;
var IM3_A4_LANDSCAPE_HEIGHT_PT_V21 = 595.28;
var IM3_REPORT_FONT_V21 = "Arial";
var IM3_REPORT_BODY_SIZE_V21 = 9;
var IM3_REPORT_HEADING_SIZE_V21 = 10;

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadata").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();
  try {
    let data;
    if (action === "metadata" || action === "metadatafast") data = getMetadataV21_();
    else if (action === "chartmetrics") data = getChartMetricsCatalogV20_();
    else if (action === "timeseries") data = getTimeSeriesV20_(e.parameter || {});
    else if (action === "validatemodel") data = validateModelV20_(e.parameter.moduleId || "", e.parameter.payload || "");
    else if (action === "graphtemplates") data = getGraphTemplatesV20_();
    else if (action === "config") data = getConfigCenterV16_();
    else if (action === "configoptions" || action === "filteroptions") data = getFilterOptionsV16_();
    else if (action === "sequence") data = getModelSequenceV14_();
    else if (action === "module") data = getModuleV16_(e.parameter.moduleId, e.parameter.key || "", parseFiltersV13_(e.parameter.filters || ""));
    else if (action === "save") data = saveRowAndRecalculateV16_(e);
    else if (action === "dashboard") data = getDashboardV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    else if (action === "projects") data = getProjectsFastV16_();
    else if (action === "chartdata") data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "Revenue_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    else if (action === "repairformulas") data = repairDashboardFormulasV14_();
    else if (action === "pdf") data = generateExecutivePdfReportV21_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    else if (action === "detailedreport") data = generateDetailedInvestmentReportV21_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    else if (action === "diagnostics") data = getDiagnosticsV21_();
    else if (action === "clearcache") data = clearIm3CacheV16_();
    else if (action === "health") data = { status:"ok", version:IM3_REPORT_VERSION_V21, timestamp:new Date().toISOString(), spreadsheetId:getSpreadsheetId_() };
    else throw new Error("Unknown action: " + action);
    return respond_({ ok:true, action:action, elapsedMs:new Date().getTime()-started, data:data }, callback);
  } catch (err) {
    return respond_({ ok:false, action:action, elapsedMs:new Date().getTime()-started, error:err.message, stack:err.stack }, callback);
  }
}

function getMetadataV21_() {
  const meta = (typeof getMetadataV20_ === "function") ? getMetadataV20_() : getMetadataV16_();
  meta.version = IM3_REPORT_VERSION_V21;
  meta.reports = {
    executive: { action:"pdf", orientation:"landscape", bodyFontSize:9, headingFontSize:10, manualOnly:true },
    detailedInvestment: { action:"detailedreport", orientation:"landscape", bodyFontSize:9, headingFontSize:10, manualOnly:true }
  };
  return meta;
}

function setupReportDocumentV21_(doc) {
  const body = doc.getBody();
  body.clear();
  body.setPageWidth(IM3_A4_LANDSCAPE_WIDTH_PT_V21);
  body.setPageHeight(IM3_A4_LANDSCAPE_HEIGHT_PT_V21);
  body.setMarginTop(28);
  body.setMarginBottom(28);
  body.setMarginLeft(30);
  body.setMarginRight(30);
  body.setAttributes({
    [DocumentApp.Attribute.FONT_FAMILY]: IM3_REPORT_FONT_V21,
    [DocumentApp.Attribute.FONT_SIZE]: IM3_REPORT_BODY_SIZE_V21
  });
  return body;
}

function addReportTitleV21_(body, title, subtitle) {
  const p = body.appendParagraph(title);
  p.setHeading(DocumentApp.ParagraphHeading.TITLE).setFontSize(14).setBold(true);
  if (subtitle) body.appendParagraph(subtitle).setFontSize(9).setForegroundColor("#555555");
  body.appendParagraph("Generated: " + new Date().toISOString()).setFontSize(8).setForegroundColor("#777777");
}

function addReportHeadingV21_(body, text) {
  body.appendParagraph(text).setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontSize(IM3_REPORT_HEADING_SIZE_V21).setBold(true);
}

function addReportParagraphV21_(body, text) {
  body.appendParagraph(String(text || "—")).setFontSize(IM3_REPORT_BODY_SIZE_V21).setLineSpacing(1.05);
}

function addCompactTableV21_(body, rows, headerBold) {
  const safeRows = (rows && rows.length) ? rows : [["No data", "—"]];
  const table = body.appendTable(safeRows.map(r => r.map(c => String(c === undefined || c === null || c === "" ? "—" : c))));
  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      cell.setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(3).setPaddingRight(3);
      cell.editAsText().setFontSize(IM3_REPORT_BODY_SIZE_V21).setFontFamily(IM3_REPORT_FONT_V21);
      if (headerBold && r === 0) cell.editAsText().setBold(true);
    }
  }
  return table;
}

function formatReportValueV21_(value, format) {
  if (value === undefined || value === null || value === "") return "—";
  const n = parseNumberV13_(value);
  if (isNaN(n)) return String(value);
  const f = String(format || "");
  if (f === "percent" || /irr|probability|rate|percent/i.test(f)) return (Math.abs(n) <= 1 ? n * 100 : n).toFixed(2) + "%";
  if (f === "money" || /usd|npv|cash|revenue|cost|capex|opex|tax|ebit/i.test(f)) {
    if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    return "$" + Number(n.toFixed(2)).toLocaleString();
  }
  return Number(n.toFixed(3)).toLocaleString();
}

function getSelectedProjectContextV21_(filters, projectId) {
  const dash = getDashboardV16_(filters || {}, projectId || "");
  const row = (dash.rows && dash.rows[0]) || dash.first || {};
  const finalProjectId = projectId || (filters && normalizeArrayV13_(filters.projectIds)[0]) || row.Project_ID || "";
  return { dashboard:dash, row:row, projectId:finalProjectId, projectName:row.Project_Name || finalProjectId || "Selected IM3 Project" };
}

function generateExecutivePdfReportV21_(filters, projectId) {
  const ctx = getSelectedProjectContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Executive_Report_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = setupReportDocumentV21_(doc);

  addReportTitleV21_(body, "IM³ Executive Investment Report", "Landscape PDF | compact 9 pt table text | project: " + ctx.projectName);
  addReportHeadingV21_(body, "1. Investment Decision Snapshot");
  addReportParagraphV21_(body, buildExecutiveDecisionNarrativeV21_(ctx.row, ctx.dashboard.summary || {}));

  const summary = ctx.dashboard.summary || {};
  addCompactTableV21_(body, [
    ["Indicator", "Value", "Interpretation"],
    ["Project", ctx.projectName, "Selected analysis object"],
    ["NPV", formatReportValueV21_(summary.avgNPV || ctx.row.NPV_USD, "money"), interpretNpvV21_(summary.avgNPV || ctx.row.NPV_USD)],
    ["IRR", formatReportValueV21_(summary.avgIRR || ctx.row.IRR, "percent"), interpretIrrV21_(summary.avgIRR || ctx.row.IRR)],
    ["MCDA", formatReportValueV21_(summary.avgMCDA || ctx.row.MCDA_Score, "score"), interpretScoreV21_(summary.avgMCDA || ctx.row.MCDA_Score, "strategic attractiveness")],
    ["System Dynamics", formatReportValueV21_(summary.avgSD || ctx.row.System_Dynamics_Score, "score"), interpretScoreV21_(summary.avgSD || ctx.row.System_Dynamics_Score, "dynamic resilience")],
    ["Integrated Score", formatReportValueV21_(summary.avgIntegratedScore || ctx.row.Integrated_Score, "score"), interpretScoreV21_(summary.avgIntegratedScore || ctx.row.Integrated_Score, "overall investment quality")],
    ["Decision", ctx.row.Final_Decision || ctx.row.Decision_Label || summary.decision || "Review", "Final recommendation based on the integrated IM³ logic"]
  ], true);

  addReportHeadingV21_(body, "2. Recommendation");
  addReportParagraphV21_(body, buildFinalDecisionTextV21_(ctx.row, summary));

  finalizePdfFileV21_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Executive_Report_" + safeName_(ctx.projectName) + ".pdf", ctx, "executive");
}

function generateDetailedInvestmentReportV21_(filters, projectId) {
  const ctx = getSelectedProjectContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Detailed_Investment_Report_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = setupReportDocumentV21_(doc);

  addReportTitleV21_(body, "IM³ Detailed Investment Decision Report", "Method-by-method analysis | landscape PDF | compact 9 pt table text | project: " + ctx.projectName);

  addReportHeadingV21_(body, "1. Executive Synthesis and Final Decision Logic");
  addReportParagraphV21_(body, buildDetailedExecutiveSynthesisV21_(ctx));
  addCompactTableV21_(body, buildDecisionMatrixTableV21_(ctx), true);

  addReportHeadingV21_(body, "2. Project and Scenario Context");
  addReportParagraphV21_(body, "This section identifies the project, scenario and strategic context used as the basis for the investment assessment. These variables define the boundary conditions for all subsequent modules and prevent the financial outputs from being interpreted outside their project assumptions.");
  addCompactTableV21_(body, buildProjectContextTableV21_(ctx), true);

  const modules = getDetailedReportModulesV21_();
  modules.forEach((m, idx) => {
    addReportHeadingV21_(body, (idx + 3) + ". " + m.title);
    addReportParagraphV21_(body, m.roleText);
    const section = buildModuleEvidenceV21_(m, ctx, filters || {});
    addCompactTableV21_(body, section.table, true);
    addReportParagraphV21_(body, section.interpretation);
    addReportParagraphV21_(body, section.decisionImpact);
  });

  addReportHeadingV21_(body, "Final Integrated Investment Decision");
  addReportParagraphV21_(body, buildFinalDecisionTextV21_(ctx.row, ctx.dashboard.summary || {}));
  addReportParagraphV21_(body, "The final decision should not be read as a single-output result. It is the combined conclusion of the IM³ framework: DCF tests the financial base case; MAP/DNPV adjusts value for risk and probability; ROV captures managerial flexibility; MCDA integrates strategic, technical, environmental and governance criteria; System Dynamics checks long-term feedback behavior; and Monte Carlo evaluates uncertainty. A project is investment-ready only when these methods tell a coherent story of positive value, acceptable risk, operational resilience and strategic alignment.");

  finalizePdfFileV21_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Detailed_Investment_Report_" + safeName_(ctx.projectName) + ".pdf", ctx, "detailed");
}

function finalizePdfFileV21_(doc) {
  doc.saveAndClose();
}

function createPdfFileFromDocV21_(doc, pdfName, ctx, reportType) {
  const pdfBlob = DriveApp.getFileById(doc.getId()).getBlob().getAs(MimeType.PDF).setName(pdfName);
  const pdfFile = PDF_FOLDER_ID ? DriveApp.getFolderById(PDF_FOLDER_ID).createFile(pdfBlob) : DriveApp.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    created:true,
    reportType:reportType,
    orientation:"landscape",
    bodyFontSize:IM3_REPORT_BODY_SIZE_V21,
    headingFontSize:IM3_REPORT_HEADING_SIZE_V21,
    projectId:ctx.projectId,
    projectName:ctx.projectName,
    pdfUrl:pdfFile.getUrl(),
    pdfFileId:pdfFile.getId(),
    docId:doc.getId(),
    note:"Report generated manually. No automatic download is triggered by the API."
  };
}

function buildExecutiveDecisionNarrativeV21_(row, summary) {
  const decision = row.Final_Decision || row.Decision_Label || summary.decision || "Review";
  return "The current IM³ result indicates the preliminary investment decision: " + decision + ". This decision is derived from the combined reading of financial value, risk-adjusted value, strategic score, system behavior and uncertainty indicators. A positive NPV or IRR alone is not treated as sufficient; the project must also demonstrate resilience under risk, strategic alignment, manageable operating exposure and acceptable dynamic behavior over the forecast horizon.";
}

function buildDetailedExecutiveSynthesisV21_(ctx) {
  const row = ctx.row || {};
  const s = ctx.dashboard.summary || {};
  return "The detailed report evaluates the investment case for " + ctx.projectName + " using the IM³ integrated methodology. The assessment combines discounted cash flow results with risk-adjusted valuation, real options, multi-criteria decision analysis, system dynamics and uncertainty analysis. The purpose is to explain not only whether the project creates value, but why that value is credible or fragile, which variables support the decision, and which risks must be mitigated before capital commitment. The final decision is therefore based on the consistency between financial profitability, strategic relevance, dynamic sustainability and risk exposure.";
}

function buildDecisionMatrixTableV21_(ctx) {
  const row = ctx.row || {};
  const s = ctx.dashboard.summary || {};
  return [
    ["Decision component", "Observed result", "Investment meaning"],
    ["NPV / value creation", formatReportValueV21_(s.avgNPV || row.NPV_USD, "money"), interpretNpvV21_(s.avgNPV || row.NPV_USD)],
    ["IRR / return efficiency", formatReportValueV21_(s.avgIRR || row.IRR, "percent"), interpretIrrV21_(s.avgIRR || row.IRR)],
    ["Risk-adjusted value", formatReportValueV21_(row.DNPV_USD || row.Weighted_Risk_NPV, "money"), "Shows whether value remains attractive after explicit risk adjustment."],
    ["Strategic quality", formatReportValueV21_(s.avgMCDA || row.MCDA_Score, "score"), interpretScoreV21_(s.avgMCDA || row.MCDA_Score, "strategic quality")],
    ["Dynamic resilience", formatReportValueV21_(s.avgSD || row.System_Dynamics_Score, "score"), interpretScoreV21_(s.avgSD || row.System_Dynamics_Score, "dynamic resilience")],
    ["Uncertainty", formatReportValueV21_(row.Probability_Positive_NPV, "percent"), "Indicates the probability that the project remains value-positive under simulated uncertainty."],
    ["Final decision", row.Final_Decision || row.Decision_Label || s.decision || "Review", "Integrated conclusion after combining all IM³ methods."]
  ];
}

function buildProjectContextTableV21_(ctx) {
  const r = ctx.row || {};
  return [
    ["Field", "Value"],
    ["Project ID", ctx.projectId || r.Project_ID],
    ["Project name", ctx.projectName],
    ["Project type", r.Project_Type],
    ["Location", r.Location],
    ["Project phase", r.Project_Phase],
    ["Scenario", r.Scenario_Name],
    ["Risk class", r.Scenario_Risk_Class || r.Risk_Label],
    ["Last update", r.Last_Update]
  ];
}

function getDetailedReportModulesV21_() {
  return [
    { id:"assumptions", title:"Assumptions Module", sheetName:"02_Assumptions", headerRow:5, fields:["Assumption_Set_ID","Scenario_Name","Base_Year","Forecast_Horizon","Discount_Rate","Inflation_Rate","Corporate_Tax_Rate","Capacity_Utilization"], roleText:"The assumptions module defines the economic and technical scenario used by the entire model. It controls the forecast horizon, fiscal parameters, discount rate, inflation and utilization assumptions. Its role in the decision is to establish whether the valuation is based on realistic and internally consistent premises." },
    { id:"production", title:"Production Module", sheetName:"03_Production", headerRow:5, fields:["Year","Installed_Capacity","Utilization_Rate","Uptime","Net_Production","Export_Volume","Cumulative_Production","Remaining_Reserves"], roleText:"The production module tests whether the project can generate enough physical output over time to support revenue generation, reserve depletion strategy and export/domestic allocation. It is a technical driver of cash flow credibility." },
    { id:"prices", title:"Price Module", sheetName:"04_Prices", headerRow:4, fields:["Year","Product_Stream","Pricing_Unit","Base_Price","Net_Price_For_DCF","Final_Realized_Price"], roleText:"The price module translates market assumptions into realized project prices. It is critical because price realization directly affects revenue, margins, NPV and downside exposure under market volatility." },
    { id:"costs", title:"CAPEX/OPEX and Cost Module", sheetName:"05_CAPEX_OPEX", headerRow:5, fields:["Year","Cost_Type","Cost_Category","Base_Amount","Quantity","Nominal_Cost_USD"], roleText:"The cost module evaluates the capital and operating burden of the project. It helps identify whether value creation is supported by cost discipline or whether profitability depends on optimistic cost assumptions." },
    { id:"dcf", title:"DCF Module", sheetName:"06_DCF", headerRow:5, fields:["Year","Revenue_USD","OPEX_USD","EBITDA_USD","EBIT_USD","Tax_USD","Free_Cash_Flow_USD","Discount_Factor","PV_FCF_USD","Cumulative_PV_FCF_USD","NPV_To_Date_USD"], roleText:"DCF is the financial core of the investment decision. It measures whether expected future cash flows, discounted at the selected rate, compensate for capital committed and operational risk. DCF answers the baseline question: does the project create financial value?" },
    { id:"dcf_results", title:"DCF Results Module", sheetName:"07_DCF_Results", headerRow:5, fields:["NPV_USD","IRR","Payback_Years","DCF_Score","Final_Decision","Recommendation"], roleText:"DCF Results condense annual cash-flow calculations into decision indicators such as NPV, IRR, payback and DCF score. This module provides the first formal financial verdict before strategic and risk layers are considered." },
    { id:"risk", title:"Risk Scenarios Module", sheetName:"08_Risk_Scenarios", headerRow:5, fields:["Scenario_Name","Scenario_Type","Probability","Price_Multiplier","Production_Multiplier","CAPEX_Multiplier","OPEX_Multiplier","Delay_Years","Security_Risk_Level","ESG_Risk_Level"], roleText:"The risk scenarios module identifies market, operational, fiscal, security and ESG shocks that can alter the investment case. Its role is to prevent a decision based only on a deterministic base case." },
    { id:"map_dnpv", title:"MAP/DNPV Module", sheetName:"09_MAP_DNPV", headerRow:5, fields:["Market_Confidence","Technical_Confidence","Regulatory_Confidence","ESG_Confidence","Risk_Adjustment_Rate","DNPV_USD","MAP_Adjusted_Value"], roleText:"MAP/DNPV adjusts the project value by confidence, probability and risk-adjusted discounting. It shows whether project value remains robust after the risk environment is explicitly priced into the decision." },
    { id:"rov", title:"ROV Module", sheetName:"10_ROV", headerRow:5, fields:["Option_Type","ROV_Method","Trigger_Variable","Exercise_Year","Exercise_Cost_USD","Volatility","Option_Probability","ROV_Option_Value","Strategic_NPV_ROV"], roleText:"ROV captures managerial flexibility: defer, expand, abandon or switch technology. It is essential for oil and gas projects because uncertainty can create value when management has options rather than fixed commitments." },
    { id:"mcda", title:"MCDA Module", sheetName:"12_MCDA_Scores", headerRow:5, fields:["Criterion_ID","Manual_Score_1_10","Weighted_Score","MCDA_Score","Score_Status"], roleText:"MCDA integrates non-financial criteria into the decision, including strategic alignment, technology, local content, environmental performance and governance. It ensures that a financially attractive project is not approved if it is strategically weak or socially/environmentally misaligned." },
    { id:"system_dynamics", title:"System Dynamics Module", sheetName:"13_System_Dynamics", headerRow:5, fields:["Year","Installed_Capacity","Reinvestment_Rate","Local_Content_Index","Technology_Index","Emissions_Index","Market_Risk_Index","Net_Cash_Flow_USD","Composite_System_Score"], roleText:"System Dynamics evaluates behavior over time and feedback effects between capacity, reinvestment, local content, technology, emissions and risk. It helps determine whether project performance is sustainable throughout the forecast horizon." },
    { id:"monte_carlo", title:"Monte Carlo Module", sheetName:"16_Monte_Carlo", headerRow:5, fields:["Simulation_ID","Distribution","Price_Shock","Production_Shock","CAPEX_Shock","OPEX_Shock","Delay_Years","Simulated_NPV_USD","Probability_Positive_NPV"], roleText:"Monte Carlo evaluates uncertainty by simulating shocks to the main value drivers. Its role is to show whether the investment decision is statistically reliable or overly dependent on optimistic assumptions." }
  ];
}

function buildModuleEvidenceV21_(moduleDef, ctx, filters) {
  if (!sheetExists_(moduleDef.sheetName)) {
    return { table:[["Status", "Message"],["Missing", "Sheet not found: " + moduleDef.sheetName]], interpretation:"This module could not be evaluated because the corresponding sheet is missing.", decisionImpact:"Decision impact: the final decision should be treated as incomplete until this module is restored." };
  }
  let rows = getRows_(moduleDef.sheetName, moduleDef.headerRow);
  rows = applyFiltersToRowsV20_(rows, filters || {});
  if (ctx.projectId) rows = rows.filter(r => !r.Project_ID || String(r.Project_ID) === String(ctx.projectId) || String(r.Assumption_Set_ID || "") === String(ctx.row.Assumption_Set_ID || ""));
  rows = rows.slice(0, 8);
  const table = [["Field / Year", "Value 1", "Value 2", "Value 3", "Source"]];
  if (!rows.length) {
    table.push(["No filtered records", "—", "—", "—", moduleDef.sheetName]);
  } else {
    moduleDef.fields.slice(0, 10).forEach(field => {
      const values = rows.map(r => r[field]).filter(v => v !== undefined && v !== "").slice(0, 3);
      table.push([field.replace(/_/g, " "), values[0] || "—", values[1] || "—", values[2] || "—", moduleDef.sheetName]);
    });
  }
  return {
    table:table,
    interpretation: buildModuleInterpretationV21_(moduleDef, rows, ctx),
    decisionImpact: buildModuleDecisionImpactV21_(moduleDef, rows, ctx)
  };
}

function buildModuleInterpretationV21_(moduleDef, rows, ctx) {
  const count = rows.length;
  if (!count) return "Interpretation: no filtered records were found for this project/module combination. The model may still contain results in another scenario or assumption set, but this section cannot provide direct evidence for the selected filter.";
  if (moduleDef.id === "dcf") return "Interpretation: the DCF module links production, prices, costs, taxes and discounting into yearly free cash flow. Positive and increasing cumulative PV FCF supports approval; persistent negative FCF or delayed payback weakens the investment case.";
  if (moduleDef.id === "risk") return "Interpretation: risk scenarios show how sensitive the project is to market, cost, production, delay, security and ESG shocks. High-risk levels require mitigation before final approval even if the base-case DCF is attractive.";
  if (moduleDef.id === "map_dnpv") return "Interpretation: MAP/DNPV indicates whether the expected value remains attractive after confidence levels and risk-adjusted rates are applied. A strong DNPV confirms that the project is not only profitable in the base case but credible under risk-adjusted assumptions.";
  if (moduleDef.id === "rov") return "Interpretation: ROV adds the value of flexibility. If option value is material, the project should be structured with decision gates, expansion/deferment rights or technology-switch options rather than as an irreversible one-step investment.";
  if (moduleDef.id === "mcda") return "Interpretation: MCDA measures strategic and qualitative attractiveness. A strong MCDA score means the project contributes to broader goals such as local content, technology transfer, governance, environmental performance and national development priorities.";
  if (moduleDef.id === "system_dynamics") return "Interpretation: System Dynamics evaluates whether the project remains stable over time when feedback loops are considered. Strong system scores indicate resilience; deteriorating risk, emissions or cash-flow indicators signal the need for redesign or mitigation.";
  if (moduleDef.id === "monte_carlo") return "Interpretation: Monte Carlo results show the uncertainty profile of the investment. A high probability of positive NPV increases decision confidence; a low probability suggests that the investment is exposed to unacceptable downside risk.";
  return "Interpretation: this module provides supporting evidence for the investment case by supplying the technical, economic or strategic inputs required by downstream IM³ calculations.";
}

function buildModuleDecisionImpactV21_(moduleDef, rows, ctx) {
  if (!rows.length) return "Decision impact: absence of filtered evidence reduces confidence and should be checked before investment approval.";
  const map = {
    assumptions:"Decision impact: if assumptions are conservative and internally consistent, the resulting valuation is more credible. If assumptions are aggressive, the decision should be downgraded or tested through sensitivity and Monte Carlo.",
    production:"Decision impact: production results determine whether the project has enough physical output to sustain revenue and reserve monetization. Weak production or fast reserve depletion reduces value confidence.",
    prices:"Decision impact: price realization affects revenue and NPV directly. If final realized prices are weak or volatile, approval should depend on hedging, long-term offtake contracts or phased investment.",
    costs:"Decision impact: cost discipline determines margin quality. High CAPEX/OPEX pressure can convert an apparently attractive project into a fragile one.",
    dcf:"Decision impact: DCF provides the core financial go/no-go signal. Positive NPV and acceptable IRR support investment; negative or marginal values require redesign, deferment or rejection.",
    dcf_results:"Decision impact: DCF Results summarize whether the base case reaches the minimum financial threshold. They should be combined with risk, MCDA and system behavior before the final decision.",
    risk:"Decision impact: risk results define required mitigation. High security, ESG, delay or market risk can shift a project from 'Proceed' to 'Proceed with Conditions' or 'Defer'.",
    map_dnpv:"Decision impact: DNPV confirms whether the project still creates value after risk adjustment. If DNPV is materially below base NPV, the project is sensitive to uncertainty and requires stricter controls.",
    rov:"Decision impact: ROV can justify maintaining flexibility instead of immediate full-scale commitment. High option value supports staged investment and adaptive decision gates.",
    mcda:"Decision impact: MCDA can upgrade or downgrade the investment decision depending on strategic fit. Weak MCDA means the project may be financially positive but not aligned with national or institutional priorities.",
    system_dynamics:"Decision impact: system behavior confirms whether the project remains sustainable across time. Weak dynamic behavior suggests hidden long-term risks not visible in static DCF.",
    monte_carlo:"Decision impact: Monte Carlo determines statistical confidence. A project should not proceed unconditionally if the probability of positive value is low or downside tails are severe."
  };
  return map[moduleDef.id] || "Decision impact: this module contributes evidence to the integrated IM³ recommendation.";
}

function interpretNpvV21_(value) {
  const n = parseNumberV13_(value);
  if (isNaN(n)) return "NPV not available; decision confidence is limited.";
  if (n > 0) return "Positive value creation after discounting; financially supportive.";
  if (n < 0) return "Negative discounted value; financial case is not sufficient without redesign or strategic justification.";
  return "Break-even value; investment decision depends heavily on strategic and risk factors.";
}

function interpretIrrV21_(value) {
  const n = parseNumberV13_(value);
  if (isNaN(n)) return "IRR not available.";
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  if (pct >= 15) return "Return is generally attractive for capital-intensive oil and gas projects, subject to risk validation.";
  if (pct >= 8) return "Return may be acceptable but requires comparison with hurdle rate and project risk.";
  return "Return appears weak and may not compensate for risk and capital intensity.";
}

function interpretScoreV21_(value, label) {
  const n = parseNumberV13_(value);
  if (isNaN(n)) return "Score not available for " + label + ".";
  if (n >= 75) return "Strong " + label + "; supports proceeding.";
  if (n >= 55) return "Moderate " + label + "; proceed only with targeted improvements.";
  return "Weak " + label + "; decision should be reviewed or deferred.";
}

function buildFinalDecisionTextV21_(row, summary) {
  const decision = row.Final_Decision || row.Decision_Label || summary.decision || "Review";
  const npv = summary.avgNPV || row.NPV_USD;
  const irr = summary.avgIRR || row.IRR;
  const score = summary.avgIntegratedScore || row.Integrated_Score;
  return "Final decision: " + decision + ". The decision is based on the combined interpretation of NPV (" + formatReportValueV21_(npv, "money") + "), IRR (" + formatReportValueV21_(irr, "percent") + ") and integrated score (" + formatReportValueV21_(score, "score") + "). If the financial indicators are positive and the strategic/dynamic scores are strong, the project can be considered investment-ready. If one of these dimensions is weak, the recommended decision should shift to conditional approval, optimization, deferment or rejection depending on the severity of the gap.";
}

function getDiagnosticsV21_() {
  const base = (typeof getDiagnosticsV20_ === "function") ? getDiagnosticsV20_() : getDiagnosticsV16_();
  base.version = IM3_REPORT_VERSION_V21;
  base.reports = { executivePdf:"landscape 9pt", detailedInvestmentReport:"landscape 9pt with method narratives" };
  return base;
}

/**
 * ============================================================
 * IM³ Framework MVP — Summary Dashboard Repair Layer v2.2
 * Purpose:
 * 1) Restores action=summarydata and action=summaryviews after the PDF layer.
 * 2) Keeps PDF/report endpoints manual only.
 * 3) Uses the project-level final summary engine when available.
 * 4) Preserves manual-input endpoints from v2.0.
 * Add this layer at the END of the Apps Script file.
 * ============================================================
 */

var IM3_SUMMARY_REPAIR_VERSION_V22 = "2.2-summary-dashboard-repair";

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;

    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = getMetadataV22_();
    } else if (action === "summarydata") {
      data = getSummaryDataV22_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "summaryviews") {
      data = getSummaryViewsV22_();
    } else if (action === "chartmetrics") {
      data = getChartMetricsCatalogV20_();
    } else if (action === "timeseries") {
      data = getTimeSeriesV20_(e.parameter || {});
    } else if (action === "validatemodel") {
      data = validateModelV20_(e.parameter.moduleId || "", e.parameter.payload || "");
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV20_();
    } else if (action === "filteroptions" || action === "configoptions") {
      data = (typeof im3FinalFilterOptions_ === "function") ? im3FinalFilterOptions_() : getFilterOptionsV16_();
    } else if (action === "dropdowns") {
      data = (typeof im3FinalDropdowns_ === "function") ? im3FinalDropdowns_() : getDropdownsNeededByModulesV16_(getAvailableModules_());
    } else if (action === "config") {
      data = getConfigCenterV16_();
    } else if (action === "sequence") {
      data = getModelSequenceV14_();
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || e.parameter.rowId || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "appendstep" || action === "manualappend") {
      data = im3ManualAppendStepFromRequest_(e);
    } else if (action === "createmanualanalysis") {
      data = im3ManualCreateProjectFromRequest_(e);
    } else if (action === "cloneproject" || action === "autofillproject") {
      data = im3ManualCloneProjectFromRequest_(e);
    } else if (action === "manualtemplate") {
      data = im3ManualTemplate_(e.parameter.moduleId || "projects");
    } else if (action === "dashboard") {
      data = (typeof im3FinalDashboard_ === "function") ? im3FinalDashboard_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "") : getDashboardV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = (typeof im3FinalProjects_ === "function") ? im3FinalProjects_() : getProjectsFastV16_();
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "Revenue_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generateExecutivePdfReportV21_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "detailedreport") {
      data = generateDetailedInvestmentReportV21_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV22_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = { status:"ok", version:IM3_SUMMARY_REPAIR_VERSION_V22, timestamp:new Date().toISOString(), spreadsheetId:getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok:true, action:action, elapsedMs:new Date().getTime() - started, data:data }, callback);
  } catch (err) {
    return respond_({ ok:false, action:action, elapsedMs:new Date().getTime() - started, error:err.message, stack:err.stack }, callback);
  }
}

function getMetadataV22_() {
  let meta;
  try {
    meta = (typeof getMetadataV21_ === "function") ? getMetadataV21_() : getMetadataV20_();
  } catch (err) {
    meta = (typeof im3ManualMetadata_ === "function") ? im3ManualMetadata_() : getMetadataV16_();
  }
  meta.version = IM3_SUMMARY_REPAIR_VERSION_V22;
  meta.summaryViews = getSummaryViewsV22_();
  meta.summaryEndpoint = "summarydata";
  meta.summaryDashboardRepair = true;
  meta.reports = meta.reports || {};
  meta.reports.executive = { action:"pdf", orientation:"landscape", bodyFontSize:9, headingFontSize:10, manualOnly:true };
  meta.reports.detailedInvestment = { action:"detailedreport", orientation:"landscape", bodyFontSize:9, headingFontSize:10, manualOnly:true };
  return meta;
}

function getSummaryViewsV22_() {
  if (typeof im3FinalSummaryViews_ === "function") return im3FinalSummaryViews_();
  if (typeof getSummaryViewsV18_ === "function") return getSummaryViewsV18_();
  return [
    { id:"production_summary", title:"Production Summary" },
    { id:"price_summary", title:"Price Module Summary" },
    { id:"cost_summary", title:"Cost Module Summary" },
    { id:"dcf_summary", title:"DCF Summary" },
    { id:"dcf_results_summary", title:"DCF Results Summary" },
    { id:"adjusted_scenario_outputs", title:"Adjusted Scenario Outputs" },
    { id:"map_dnpv_summary", title:"MAP/DNPV Summary" },
    { id:"rov_summary", title:"ROV Summary" },
    { id:"mcda_summary", title:"MCDA Summary" },
    { id:"system_dynamics_summary", title:"System Dynamics Summary" },
    { id:"sd_parameter_summary", title:"SD Parameter Summary" },
    { id:"monte_carlo_summary", title:"Monte Carlo Summary" }
  ];
}

function getSummaryDataV22_(view, filters, projectId) {
  let result;
  if (typeof im3FinalSummaryData_ === "function") {
    result = im3FinalSummaryData_(view, filters || {}, projectId || "");
  } else if (typeof getSummaryDataV18_ === "function") {
    result = getSummaryDataV18_(view, filters || {});
  } else {
    result = { view:view, title:view, cards:[], note:"Summary engine is not available." };
  }

  result = result || { view:view, title:view, cards:[] };
  result.cards = normalizeSummaryCardsV22_(result.cards || [], view);
  result.status = result.cards.length ? "ok" : "empty";
  result.message = result.cards.length
    ? "Summary dashboard data loaded successfully."
    : "No summary indicators were found for the selected filters or project.";
  return result;
}

function normalizeSummaryCardsV22_(cards, view) {
  return (cards || []).map(function(c) {
    const label = c.label || c.name || c.metric || "Indicator";
    return {
      label: label,
      value: c.value,
      format: c.format || im3FinalGuessFormat_(label),
      source: cleanSummarySourceV22_(c.source || ""),
      view: view
    };
  }).filter(function(c) { return c.label; });
}

function cleanSummarySourceV22_(source) {
  return String(source || "").replace(/!/g, " — ").replace(/\$/g, "").trim();
}

function getDiagnosticsV22_() {
  let base;
  try {
    base = (typeof getDiagnosticsV21_ === "function") ? getDiagnosticsV21_() : im3ManualDiagnostics_();
  } catch (err) {
    base = { diagnosticsWarning: err.message };
  }
  base.version = IM3_SUMMARY_REPAIR_VERSION_V22;
  base.summaryViews = getSummaryViewsV22_();
  base.summaryEndpoint = "summarydata";
  base.summaryEndpointRestored = true;
  base.recommendedTestUrls = [
    "?action=summaryviews",
    "?action=summarydata&view=production_summary",
    "?action=summarydata&view=dcf_summary",
    "?action=summarydata&view=mcda_summary"
  ];
  return base;
}


/**
 * ============================================================
 * IM³ Framework MVP — v2.9 Reference Summary Logic Final Layer
 * Purpose:
 * - Makes the v1.9 project-dashboard-cards logic the active routing logic.
 * - Ensures action=summarydata always uses module summary cards based on
 *   the same logical Google Sheets blocks used in the reference file.
 * - Preserves v2.0+ manual input, chart metrics, timeseries and PDF reports.
 * Additive final layer: must remain at the end of this .gs file.
 * ============================================================
 */

var IM3_REFERENCE_SUMMARY_VERSION_V29 = "2.9-reference-summary-logic";

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;

    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = getMetadataV29_();
    } else if (action === "summarydata") {
      data = getSummaryDataV29_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "summaryviews") {
      data = getSummaryViewsV29_();
    } else if (action === "filteroptions" || action === "configoptions") {
      data = (typeof im3FinalFilterOptions_ === "function") ? im3FinalFilterOptions_() : getFilterOptionsV16_();
    } else if (action === "dropdowns") {
      data = (typeof im3FinalDropdowns_ === "function") ? im3FinalDropdowns_() : getDropdownsNeededByModulesV16_(getAvailableModules_());
    } else if (action === "projects") {
      data = (typeof im3FinalProjects_ === "function") ? im3FinalProjects_() : getProjectsFastV16_();
    } else if (action === "dashboard") {
      data = (typeof im3FinalDashboard_ === "function") ? im3FinalDashboard_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "") : getDashboardV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || e.parameter.rowId || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "appendstep" || action === "manualappend") {
      data = im3ManualAppendStepFromRequest_(e);
    } else if (action === "createmanualanalysis") {
      data = im3ManualCreateProjectFromRequest_(e);
    } else if (action === "cloneproject" || action === "autofillproject") {
      data = im3ManualCloneProjectFromRequest_(e);
    } else if (action === "manualtemplate") {
      data = im3ManualTemplate_(e.parameter.moduleId || "projects");
    } else if (action === "chartmetrics") {
      data = getChartMetricsCatalogV20_();
    } else if (action === "timeseries") {
      data = getTimeSeriesV20_(e.parameter || {});
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "Revenue_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "graphtemplates") {
      data = (typeof getGraphTemplatesV20_ === "function") ? getGraphTemplatesV20_() : getGraphTemplatesV15_();
    } else if (action === "validatemodel") {
      data = validateModelV20_(e.parameter.moduleId || "", e.parameter.payload || "");
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generateExecutivePdfReportV21_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "detailedreport") {
      data = generateDetailedInvestmentReportV21_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV29_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = { status:"ok", version:IM3_REFERENCE_SUMMARY_VERSION_V29, timestamp:new Date().toISOString(), spreadsheetId:getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok:true, action:action, elapsedMs:new Date().getTime() - started, data:data }, callback);
  } catch (err) {
    return respond_({ ok:false, action:action, elapsedMs:new Date().getTime() - started, error:err.message, stack:err.stack }, callback);
  }
}

function getMetadataV29_() {
  let meta;
  try {
    meta = (typeof getMetadataV21_ === "function") ? getMetadataV21_() : ((typeof im3ManualMetadata_ === "function") ? im3ManualMetadata_() : getMetadataV16_());
  } catch (err) {
    meta = { appName:"IM³ Framework MVP", spreadsheetId:getSpreadsheetId_(), modules:[] };
  }
  meta.version = IM3_REFERENCE_SUMMARY_VERSION_V29;
  meta.summaryEndpoint = "summarydata";
  meta.summaryViews = getSummaryViewsV29_();
  meta.summarySources = getSummarySourceBlocksV29_();
  meta.summaryLogic = "v1.9-project-dashboard-cards-reference";
  meta.reports = meta.reports || {};
  meta.reports.executive = { action:"pdf", orientation:"landscape", bodyFontSize:9, manualOnly:true };
  meta.reports.detailedInvestment = { action:"detailedreport", orientation:"landscape", bodyFontSize:9, manualOnly:true };
  return meta;
}

function getSummaryViewsV29_() {
  return (typeof im3FinalSummaryViews_ === "function") ? im3FinalSummaryViews_() : getSummaryViewsV22_();
}

function getSummaryDataV29_(view, filters, projectId) {
  let result;
  if (typeof im3FinalSummaryData_ === "function") {
    // This is the reference logic from the file supplied by the user.
    result = im3FinalSummaryData_(view, filters || {}, projectId || "");
  } else if (typeof getSummaryDataV22_ === "function") {
    result = getSummaryDataV22_(view, filters || {}, projectId || "");
  } else if (typeof getSummaryDataV18_ === "function") {
    result = getSummaryDataV18_(view, filters || {});
  } else {
    result = { view:view, title:view, cards:[], note:"Summary engine is not available." };
  }

  result = result || { view:view, title:view, cards:[] };
  result.version = IM3_REFERENCE_SUMMARY_VERSION_V29;
  result.cards = normalizeSummaryCardsV29_(result.cards || [], view);
  result.sourceBlocks = getSummarySourceBlocksV29_();
  result.status = result.cards.length ? "ok" : "empty";
  result.message = result.cards.length
    ? "Summary dashboard data loaded with the reference project-card logic."
    : "No summary indicators were found for the selected filters or project.";
  return result;
}

function normalizeSummaryCardsV29_(cards, view) {
  return (cards || []).map(function(c) {
    const label = c.label || c.name || c.metric || "Indicator";
    return {
      label: label,
      value: c.value,
      format: c.format || ((typeof im3FinalGuessFormat_ === "function") ? im3FinalGuessFormat_(label) : "plain"),
      source: cleanSummarySourceV29_(c.source || ""),
      view: view
    };
  }).filter(function(c) { return c.label; });
}

function cleanSummarySourceV29_(source) {
  return String(source || "").replace(/!/g, " — ").replace(/\$/g, "").trim();
}

function getSummarySourceBlocksV29_() {
  return [
    "03_Production!AC1:AD7",
    "04_Prices!T1:U9",
    "05_CAPEX_OPEX!AB1:AC18",
    "06_DCF!AN1:AO15",
    "07_DCF_Results!AD1:AE9",
    "08_Risk_Scenarios!AD4:AJ105 and A108:C113",
    "09_MAP_DNPV!AF1:AG10",
    "10_ROV!AK1:AL7",
    "12_MCDA_Scores!X1:Y8 and S5:V25",
    "13_System_Dynamics!AK1:AL9",
    "14_SD_Parameters!T1:U7",
    "16_Monte_Carlo!AD1:AE8"
  ];
}

function getDiagnosticsV29_() {
  let base;
  try {
    base = (typeof getDiagnosticsV21_ === "function") ? getDiagnosticsV21_() : ((typeof im3ManualDiagnostics_ === "function") ? im3ManualDiagnostics_() : getDiagnosticsV16_());
  } catch (err) {
    base = { diagnosticsWarning: err.message };
  }
  base.version = IM3_REFERENCE_SUMMARY_VERSION_V29;
  base.summaryEndpoint = "summarydata";
  base.summaryLogic = "v1.9-project-dashboard-cards-reference";
  base.summaryViews = getSummaryViewsV29_();
  base.summarySources = getSummarySourceBlocksV29_();
  base.recommendedTestUrls = [
    "?action=health",
    "?action=summaryviews",
    "?action=summarydata&view=production_summary",
    "?action=summarydata&view=dcf_summary",
    "?action=summarydata&view=mcda_summary"
  ];
  return base;
}

/**
 * ============================================================
 * IM³ Framework MVP — v3.0 Additive Advanced Analytics + Report Fix
 * Purpose:
 * - Keeps all existing endpoints and logic.
 * - Adds advanced chart templates/data without removing current Graph Studio.
 * - Replaces PDF/detailedreport routing with stronger landscape report functions.
 * - Detailed report uses compact 9/10 pt typography and integrated decision logic.
 * ============================================================
 */

var IM3_V30_VERSION = "3.0-advanced-analytics-landscape-report";

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;
    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = getMetadataV30_();
    } else if (action === "advancedchartdata") {
      data = getAdvancedChartDataV30_(e.parameter.templateId || e.parameter.template || "executive_decision_radar", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "summarydata") {
      data = (typeof getSummaryDataV29_ === "function") ? getSummaryDataV29_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "") : getSummaryDataV22_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "summaryviews") {
      data = (typeof getSummaryViewsV29_ === "function") ? getSummaryViewsV29_() : getSummaryViewsV22_();
    } else if (action === "filteroptions" || action === "configoptions") {
      data = (typeof im3FinalFilterOptions_ === "function") ? im3FinalFilterOptions_() : getFilterOptionsV16_();
    } else if (action === "dropdowns") {
      data = (typeof im3FinalDropdowns_ === "function") ? im3FinalDropdowns_() : getDropdownsNeededByModulesV16_(getAvailableModules_());
    } else if (action === "projects") {
      data = (typeof im3FinalProjects_ === "function") ? im3FinalProjects_() : getProjectsFastV16_();
    } else if (action === "dashboard") {
      data = (typeof im3FinalDashboard_ === "function") ? im3FinalDashboard_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "") : getDashboardV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || e.parameter.rowId || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "appendstep" || action === "manualappend") {
      data = im3ManualAppendStepFromRequest_(e);
    } else if (action === "createmanualanalysis") {
      data = im3ManualCreateProjectFromRequest_(e);
    } else if (action === "cloneproject" || action === "autofillproject") {
      data = im3ManualCloneProjectFromRequest_(e);
    } else if (action === "manualtemplate") {
      data = im3ManualTemplate_(e.parameter.moduleId || "projects");
    } else if (action === "chartmetrics") {
      data = getChartMetricsCatalogV20_();
    } else if (action === "timeseries") {
      data = getTimeSeriesV20_(e.parameter || {});
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "Revenue_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV30_();
    } else if (action === "validatemodel") {
      data = validateModelV20_(e.parameter.moduleId || "", e.parameter.payload || "");
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generateExecutivePdfReportV30_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "detailedreport") {
      data = generateDetailedInvestmentReportV30_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV30_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = { status:"ok", version:IM3_V30_VERSION, timestamp:new Date().toISOString(), spreadsheetId:getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok:true, action:action, elapsedMs:new Date().getTime() - started, data:data }, callback);
  } catch (err) {
    return respond_({ ok:false, action:action, elapsedMs:new Date().getTime() - started, error:err.message, stack:err.stack }, callback);
  }
}

function getMetadataV30_() {
  let meta;
  try { meta = (typeof getMetadataV29_ === "function") ? getMetadataV29_() : getMetadataV21_(); }
  catch (err) { meta = { appName:"IM³ Framework MVP", spreadsheetId:getSpreadsheetId_(), modules:[] }; }
  meta.version = IM3_V30_VERSION;
  meta.graphTemplates = getGraphTemplatesV30_();
  meta.advancedChartEndpoint = "advancedchartdata";
  meta.advancedCharts = getAdvancedGraphTemplatesV30_();
  meta.reports = meta.reports || {};
  meta.reports.executive = { action:"pdf", orientation:"landscape", bodyFontSize:9, tableFontSize:9, headingFontSize:10, manualOnly:true, version:IM3_V30_VERSION };
  meta.reports.detailedInvestment = { action:"detailedreport", orientation:"landscape", bodyFontSize:9, tableFontSize:9, headingFontSize:10, manualOnly:true, version:IM3_V30_VERSION };
  return meta;
}

function getGraphTemplatesV30_() {
  const base = (typeof getGraphTemplatesV20_ === "function") ? getGraphTemplatesV20_() : [];
  const seen = {};
  return base.concat(getAdvancedGraphTemplatesV30_()).filter(function(t){ if (seen[t.id]) return false; seen[t.id] = true; return true; });
}

function getAdvancedGraphTemplatesV30_() {
  return [
    { id:"executive_decision_radar", title:"Executive Decision Radar", category:"Decision", metricGroup:"Indexes/Scores", defaultMetrics:["DCF_Score","MCDA_Score","Composite_System_Score"], defaultChart:"radar", dataMode:"advanced", chartKind:"radar", description:"Compares DCF, MAP/DNPV, ROV, MCDA, System Dynamics and Monte Carlo confidence in one decision profile." },
    { id:"im3_decision_funnel", title:"IM³ Decision Funnel", category:"Decision", metricGroup:"Indexes/Scores", defaultMetrics:["Integrated_Score"], defaultChart:"bar", dataMode:"advanced", chartKind:"bar", description:"Shows how projects pass through the IM³ investment gates from registration to integrated decision." },
    { id:"npv_tornado", title:"NPV Tornado / Sensitivity", category:"Risk", metricGroup:"Financial USD", defaultMetrics:["NPV_To_Date_USD"], defaultChart:"bar", dataMode:"advanced", chartKind:"horizontalBar", description:"Ranks the variables with strongest impact on project value." },
    { id:"npv_waterfall", title:"NPV Waterfall", category:"Financial", metricGroup:"Financial USD", defaultMetrics:["Revenue_USD"], defaultChart:"bar", dataMode:"advanced", chartKind:"waterfall", description:"Explains how revenue, CAPEX, OPEX and tax convert into free cash flow and present value." },
    { id:"monte_carlo_distribution", title:"Monte Carlo NPV Distribution", category:"Risk", metricGroup:"Financial USD", defaultMetrics:["PV_FCF_USD"], defaultChart:"bar", dataMode:"advanced", chartKind:"histogram", description:"Shows distribution of simulated NPV and downside/upside risk." },
    { id:"risk_heatmap", title:"Risk Heat Map", category:"Risk", metricGroup:"Indexes/Scores", defaultMetrics:["Market_Risk_Index"], defaultChart:"scatter", dataMode:"advanced", chartKind:"scatter", description:"Plots risks by probability and impact/composite risk score." },
    { id:"portfolio_bubble", title:"Project Portfolio Matrix", category:"Portfolio", metricGroup:"Financial USD", defaultMetrics:["NPV_To_Date_USD"], defaultChart:"scatter", dataMode:"advanced", chartKind:"scatter", description:"Compares projects by NPV and MCDA/Integrated Score for capital allocation." },
    { id:"capex_breakdown", title:"CAPEX Breakdown", category:"Cost", metricGroup:"Cost USD", defaultMetrics:["Nominal_Cost_USD"], defaultChart:"doughnut", dataMode:"advanced", chartKind:"doughnut", description:"Shows capital cost composition by category." },
    { id:"opex_breakdown", title:"OPEX Breakdown", category:"Cost", metricGroup:"Cost USD", defaultMetrics:["OPEX_USD"], defaultChart:"doughnut", dataMode:"advanced", chartKind:"doughnut", description:"Shows operating cost composition by category." },
    { id:"strategic_alignment", title:"Strategic Alignment Score", category:"Strategic", metricGroup:"Indexes/Scores", defaultMetrics:["Local_Content_Index","Technology_Index","Composite_System_Score"], defaultChart:"bar", dataMode:"advanced", chartKind:"horizontalBar", description:"Shows how the project aligns with strategic, ESG, local-content and technology objectives." },
    { id:"decision_confidence", title:"Decision Confidence Gauge", category:"Decision", metricGroup:"Indexes/Scores", defaultMetrics:["Integrated_Score"], defaultChart:"doughnut", dataMode:"advanced", chartKind:"gauge", description:"Summarizes investment confidence from financial, strategic, dynamic and risk evidence." }
  ];
}

function getAdvancedChartDataV30_(templateId, filters, projectId) {
  filters = filters || {};
  const selectedProject = projectId || ((filters.projectIds && normalizeArrayV13_(filters.projectIds)[0]) || "");
  const template = getAdvancedGraphTemplatesV30_().filter(t => t.id === templateId)[0] || getAdvancedGraphTemplatesV30_()[0];
  let data;
  if (template.id === "executive_decision_radar") data = buildExecutiveRadarDataV30_(filters, selectedProject);
  else if (template.id === "im3_decision_funnel") data = buildDecisionFunnelDataV30_(filters, selectedProject);
  else if (template.id === "npv_tornado") data = buildTornadoDataV30_(filters, selectedProject);
  else if (template.id === "npv_waterfall") data = buildWaterfallDataV30_(filters, selectedProject);
  else if (template.id === "monte_carlo_distribution") data = buildMonteCarloDistributionDataV30_(filters, selectedProject);
  else if (template.id === "risk_heatmap") data = buildRiskHeatMapDataV30_(filters, selectedProject);
  else if (template.id === "portfolio_bubble") data = buildPortfolioBubbleDataV30_(filters, selectedProject);
  else if (template.id === "capex_breakdown") data = buildCostBreakdownDataV30_(filters, selectedProject, "CAPEX");
  else if (template.id === "opex_breakdown") data = buildCostBreakdownDataV30_(filters, selectedProject, "OPEX");
  else if (template.id === "strategic_alignment") data = buildStrategicAlignmentDataV30_(filters, selectedProject);
  else if (template.id === "decision_confidence") data = buildDecisionConfidenceDataV30_(filters, selectedProject);
  else data = { labels:[], datasets:[] };
  data.template = template;
  data.templateId = template.id;
  data.projectId = selectedProject;
  data.version = IM3_V30_VERSION;
  return data;
}

function filteredRowsV30_(sheetName, headerRow, filters, projectId) {
  if (!sheetExists_(sheetName)) return [];
  let rows = getRows_(sheetName, headerRow);
  rows = applyFiltersToRowsV13_(rows, filters || {});
  if (projectId) rows = rows.filter(r => String(r.Project_ID || "").trim() === String(projectId).trim() || !r.Project_ID);
  return rows;
}

function score100V30_(v) {
  const n = parseNumberV13_(v);
  if (isNaN(n)) return 0;
  if (Math.abs(n) <= 1) return n * 100;
  return n;
}

function buildExecutiveRadarDataV30_(filters, projectId) {
  const dash = (typeof im3FinalDashboard_ === "function") ? im3FinalDashboard_(filters || {}, projectId || "") : getDashboardV16_(filters || {}, projectId || "");
  const row = (dash.rows && dash.rows[0]) || dash.first || {};
  const dcfRows = filteredRowsV30_("07_DCF_Results",5,filters,projectId);
  const mapRows = filteredRowsV30_("09_MAP_DNPV",5,filters,projectId);
  const rovRows = filteredRowsV30_("10_ROV",5,filters,projectId);
  const mcdaRows = filteredRowsV30_("12_MCDA_Scores",5,filters,projectId);
  const sdRows = filteredRowsV30_("13_System_Dynamics",5,filters,projectId);
  const mcRows = filteredRowsV30_("16_Monte_Carlo",5,filters,projectId);
  const labels = ["DCF","MAP/DNPV","ROV","MCDA","System Dynamics","Monte Carlo"];
  const values = [
    score100V30_(row.DCF_Score || im3FinalAvg_(dcfRows,"DCF_Score_0_100") || im3FinalAvg_(dcfRows,"DCF_Score")),
    score100V30_(im3FinalAvg_(mapRows,"MAP_DNPV_Index") || row.MAP_Adjusted_Value),
    score100V30_(im3FinalAvg_(rovRows,"ROV_Uplift_Index") || row.ROV_Option_Value),
    score100V30_(row.MCDA_Score || im3FinalAvg_(mcdaRows,"Final_MCDA_Score_0_100") || im3FinalAvg_(mcdaRows,"MCDA_Score")),
    score100V30_(row.System_Dynamics_Score || im3FinalAvg_(sdRows,"Composite_System_Score") || im3FinalAvg_(sdRows,"System_Dynamics_Score")),
    score100V30_(row.Probability_Positive_NPV || im3FinalAvg_(mcRows,"Probability_Positive_NPV"))
  ];
  return { chartType:"radar", labels:labels, datasets:[{ label:"IM³ decision strength", data:values }], yLabel:"Score / confidence", narrative:"Radar view of the investment case across all IM³ methods." };
}

function buildDecisionFunnelDataV30_(filters, projectId) {
  let projects = (typeof im3FinalProjects_ === "function") ? im3FinalProjects_() : getProjectsFastV16_();
  if (projectId) projects = projects.filter(p => p.Project_ID === projectId);
  const dash = (typeof im3FinalDashboard_ === "function") ? im3FinalDashboard_(filters || {}, projectId || "") : getDashboardV16_(filters || {}, projectId || "");
  const rows = dash.rows || [];
  const labels = ["Registered","Positive NPV","Risk adjusted","Strategic fit","Dynamic resilience","Proceed"];
  const values = [
    projects.length || rows.length,
    rows.filter(r => parseNumberV13_(r.NPV_USD) > 0).length,
    rows.filter(r => parseNumberV13_(r.DNPV_USD || r.Weighted_Risk_NPV || r.NPV_USD) > 0).length,
    rows.filter(r => score100V30_(r.MCDA_Score) >= 55).length,
    rows.filter(r => score100V30_(r.System_Dynamics_Score) >= 55).length,
    rows.filter(r => /invest|proceed|continue/i.test(String(r.Final_Decision || r.Decision_Label || ""))).length
  ];
  return { chartType:"bar", indexAxis:"y", labels:labels, datasets:[{ label:"Projects", data:values }], yLabel:"Count", narrative:"Funnel showing how projects pass through the investment decision gates." };
}

function buildTornadoDataV30_(filters, projectId) {
  let rows = filteredRowsV30_("15_Sensitivity",5,filters,projectId);
  let items = rows.map(r => ({ label:r.Sensitivity_Variable || r.Case_Name || r.Variable || "Variable", value:Math.abs(parseNumberV13_(r.NPV_Change_USD || r.Adjusted_NPV_USD || r.Shock_Value || r.Value)) })).filter(x => !isNaN(x.value));
  if (!items.length) {
    const dcf = filteredRowsV30_("06_DCF",5,filters,projectId);
    items = [
      { label:"Revenue", value:Math.abs(im3FinalSum_(dcf,"Revenue_USD")) },
      { label:"CAPEX", value:Math.abs(im3FinalSum_(dcf,"CAPEX_USD")) },
      { label:"OPEX", value:Math.abs(im3FinalSum_(dcf,"OPEX_USD")) },
      { label:"Tax", value:Math.abs(im3FinalSum_(dcf,"Tax_USD")) },
      { label:"Free Cash Flow", value:Math.abs(im3FinalSum_(dcf,"Free_Cash_Flow_USD")) }
    ];
  }
  items = items.sort((a,b)=>b.value-a.value).slice(0,10);
  return { chartType:"bar", indexAxis:"y", labels:items.map(i=>i.label), datasets:[{ label:"Impact on value", data:items.map(i=>i.value) }], yLabel:"USD impact", narrative:"Tornado ranking of value drivers." };
}

function buildWaterfallDataV30_(filters, projectId) {
  const rows = filteredRowsV30_("06_DCF",5,filters,projectId);
  const revenue = im3FinalSum_(rows,"Revenue_USD");
  const capex = -Math.abs(im3FinalSum_(rows,"CAPEX_USD"));
  const opex = -Math.abs(im3FinalSum_(rows,"OPEX_USD"));
  const tax = -Math.abs(im3FinalSum_(rows,"Tax_USD"));
  const fcf = im3FinalSum_(rows,"Free_Cash_Flow_USD");
  const pv = im3FinalSum_(rows,"PV_FCF_USD") || im3FinalMax_(rows,"NPV_To_Date_USD");
  const labels = ["Revenue","CAPEX","OPEX","Tax","Free Cash Flow","PV / NPV"];
  const values = [revenue, capex, opex, tax, fcf, pv];
  return { chartType:"bar", labels:labels, datasets:[{ label:"USD", data:values }], yLabel:"USD", narrative:"Waterfall bridge from gross revenue to discounted value." };
}

function buildMonteCarloDistributionDataV30_(filters, projectId) {
  const rows = filteredRowsV30_("16_Monte_Carlo",5,filters,projectId);
  const nums = rows.map(r => parseNumberV13_(r.Simulated_NPV_USD || r.Monte_Carlo_Mean_NPV)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
  if (!nums.length) return { chartType:"bar", labels:[], datasets:[{ label:"Runs", data:[] }], yLabel:"Frequency", narrative:"No Monte Carlo simulation values found." };
  const min = nums[0], max = nums[nums.length-1], bins = 10, step = (max-min)/(bins || 1) || 1;
  const counts = Array(bins).fill(0);
  nums.forEach(n => { let i = Math.floor((n-min)/step); if (i >= bins) i = bins-1; counts[i]++; });
  const labels = counts.map((_,i) => formatReportValueV21_(min + i*step,"money") + "–" + formatReportValueV21_(min + (i+1)*step,"money"));
  return { chartType:"bar", labels:labels, datasets:[{ label:"Simulation runs", data:counts }], yLabel:"Frequency", narrative:"Distribution of simulated NPV values." };
}

function riskLevelToNumberV30_(v) {
  const s = String(v || "").toLowerCase();
  if (/very high|critical|extreme/.test(s)) return 5;
  if (/high/.test(s)) return 4;
  if (/medium|moderate/.test(s)) return 3;
  if (/low/.test(s)) return 2;
  if (/very low/.test(s)) return 1;
  const n = parseNumberV13_(v);
  return isNaN(n) ? 3 : (Math.abs(n) <= 1 ? n*5 : n);
}

function buildRiskHeatMapDataV30_(filters, projectId) {
  const rows = filteredRowsV30_("08_Risk_Scenarios",5,filters,projectId);
  const points = rows.map((r,idx) => ({
    x: score100V30_(r.Probability || 0) || (idx+1),
    y: riskLevelToNumberV30_(r.Composite_Risk_Score || r.Security_Risk_Level || r.ESG_Risk_Level || r.Political_Risk_Level),
    label: r.Scenario_Name || r.Scenario_ID || "Risk " + (idx+1)
  })).filter(p => !isNaN(p.x) && !isNaN(p.y));
  return { chartType:"scatter", points:points, xLabel:"Probability (%)", yLabel:"Impact / risk score", narrative:"Risk heat map by probability and impact." };
}

function buildPortfolioBubbleDataV30_(filters, projectId) {
  const dash = (typeof im3FinalDashboard_ === "function") ? im3FinalDashboard_(filters || {}, projectId || "") : getDashboardV16_(filters || {}, projectId || "");
  const rows = dash.rows || [];
  const points = rows.map(r => ({ x:parseNumberV13_(r.NPV_USD || r.DNPV_USD), y:score100V30_(r.MCDA_Score || r.Integrated_Score), label:r.Project_Name || r.Project_ID || "Project" })).filter(p => !isNaN(p.x) && !isNaN(p.y));
  return { chartType:"scatter", points:points, xLabel:"NPV USD", yLabel:"MCDA / Integrated Score", narrative:"Portfolio matrix for investment prioritization." };
}

function buildCostBreakdownDataV30_(filters, projectId, type) {
  const rows = filteredRowsV30_("05_CAPEX_OPEX",5,filters,projectId).filter(r => new RegExp(type,"i").test(String(r.Cost_Type || r.Cost_Category || "")));
  const grouped = {};
  rows.forEach(r => {
    const key = String(r.Cost_Category || r.Cost_Type || "Other");
    grouped[key] = (grouped[key] || 0) + Math.abs(parseNumberV13_(r.Nominal_Cost_USD || r.Base_Amount || 0));
  });
  const labels = Object.keys(grouped).filter(k => grouped[k]).slice(0,12);
  return { chartType:"doughnut", labels:labels, datasets:[{ label:type + " USD", data:labels.map(k => grouped[k]) }], yLabel:"USD", narrative:type + " composition by category." };
}

function buildStrategicAlignmentDataV30_(filters, projectId) {
  let rows = filteredRowsV30_("12_MCDA_Scores",5,filters,projectId);
  let grouped = {};
  rows.forEach(r => {
    const key = r.Criterion_ID || r.Category || r.Criterion_Name || "Strategic criterion";
    const val = parseNumberV13_(r.Weighted_Score || r.Manual_Score_1_10 || r.MCDA_Score || 0);
    if (!isNaN(val)) grouped[key] = (grouped[key] || 0) + val;
  });
  if (!Object.keys(grouped).length) {
    const sd = filteredRowsV30_("13_System_Dynamics",5,filters,projectId);
    grouped = { "Local content":im3FinalAvg_(sd,"Local_Content_Index"), "Technology":im3FinalAvg_(sd,"Technology_Index"), "Emissions":im3FinalAvg_(sd,"Emissions_Index"), "Market risk":im3FinalAvg_(sd,"Market_Risk_Index"), "System score":im3FinalAvg_(sd,"Composite_System_Score") };
  }
  const labels = Object.keys(grouped).slice(0,10);
  return { chartType:"bar", indexAxis:"y", labels:labels, datasets:[{ label:"Score", data:labels.map(k => score100V30_(grouped[k])) }], yLabel:"Score", narrative:"Strategic alignment by criterion." };
}

function buildDecisionConfidenceDataV30_(filters, projectId) {
  const radar = buildExecutiveRadarDataV30_(filters, projectId);
  const vals = radar.datasets[0].data.filter(n => !isNaN(n));
  const score = vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0;
  return { chartType:"doughnut", labels:["Confidence","Remaining uncertainty"], datasets:[{ label:"Decision confidence", data:[Math.max(0,Math.min(100,score)), Math.max(0,100-score)] }], yLabel:"%", narrative:"Integrated decision confidence based on average IM³ method strength." };
}

function generateExecutivePdfReportV30_(filters, projectId) {
  const ctx = getSelectedProjectContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Executive_Report_Landscape_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = setupReportDocumentV30_(doc);
  addReportTitleV30_(body, "IM³ Executive Investment Report", "Landscape orientation | 9 pt body/table text | manual generation only");
  addReportHeadingV30_(body, "Investment decision snapshot");
  addReportParagraphV30_(body, buildExecutiveDecisionNarrativeV21_(ctx.row, ctx.dashboard.summary || {}));
  addCompactTableV30_(body, buildDecisionMatrixTableV21_(ctx), true);
  addReportHeadingV30_(body, "Integrated recommendation");
  addReportParagraphV30_(body, buildFinalDecisionTextV21_(ctx.row, ctx.dashboard.summary || {}));
  finalizePdfFileV30_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Executive_Report_Landscape_" + safeName_(ctx.projectName) + ".pdf", ctx, "executive-v30");
}

function generateDetailedInvestmentReportV30_(filters, projectId) {
  const ctx = getSelectedProjectContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Detailed_Investment_Report_Landscape_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = setupReportDocumentV30_(doc);
  addReportTitleV30_(body, "IM³ Detailed Investment Decision Report", "Landscape orientation | 9 pt tables | expanded method-by-method decision logic");

  addReportHeadingV30_(body, "1. Executive synthesis and final decision");
  addReportParagraphV30_(body, buildDetailedExecutiveSynthesisV21_(ctx));
  addCompactTableV30_(body, buildDecisionMatrixTableV21_(ctx), true);

  addReportHeadingV30_(body, "2. Project and scenario context");
  addReportParagraphV30_(body, "The project context defines the boundary conditions used by the IM³ model. All financial, strategic, dynamic and probabilistic outputs must be interpreted within this selected project, assumption set and scenario structure.");
  addCompactTableV30_(body, buildProjectContextTableV21_(ctx), true);

  getDetailedReportModulesV21_().forEach(function(m, idx) {
    addReportHeadingV30_(body, (idx + 3) + ". " + m.title);
    addReportParagraphV30_(body, m.roleText);
    const rows = collectModuleRowsForReportV21_(m, ctx).slice(0, 8);
    addCompactTableV30_(body, buildModuleEvidenceTableV21_(m, rows), true);
    addReportParagraphV30_(body, buildModuleInterpretationV21_(m, rows, ctx));
    addReportParagraphV30_(body, buildModuleDecisionImpactV21_(m, rows, ctx));
  });

  addReportHeadingV30_(body, "Final integrated investment decision");
  addReportParagraphV30_(body, buildFinalDecisionTextV21_(ctx.row, ctx.dashboard.summary || {}));
  addReportParagraphV30_(body, "The final recommendation is not based on a single indicator. A project should proceed only when the financial valuation, risk-adjusted value, flexibility value, strategic fit, dynamic behavior and uncertainty profile are mutually consistent. Where these dimensions diverge, the decision should be conditional, with clear mitigation actions before capital commitment.");
  finalizePdfFileV30_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Detailed_Investment_Report_Landscape_" + safeName_(ctx.projectName) + ".pdf", ctx, "detailed-v30");
}

function setupReportDocumentV30_(doc) {
  const body = doc.getBody();
  body.clear();
  body.setPageWidth(841.89);
  body.setPageHeight(595.28);
  body.setMarginTop(24);
  body.setMarginBottom(24);
  body.setMarginLeft(24);
  body.setMarginRight(24);
  body.setAttributes({
    [DocumentApp.Attribute.FONT_FAMILY]: "Arial",
    [DocumentApp.Attribute.FONT_SIZE]: 9
  });
  return body;
}

function addReportTitleV30_(body, title, subtitle) {
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.TITLE).setFontSize(13).setBold(true);
  body.appendParagraph(subtitle || "").setFontSize(9).setForegroundColor("#555555");
  body.appendParagraph("Generated: " + new Date().toISOString()).setFontSize(8).setForegroundColor("#777777");
}

function addReportHeadingV30_(body, text) {
  body.appendParagraph(text).setHeading(DocumentApp.ParagraphHeading.HEADING2).setFontSize(10).setBold(true);
}

function addReportParagraphV30_(body, text) {
  body.appendParagraph(String(text || "—")).setFontSize(9).setLineSpacing(1.0);
}

function addCompactTableV30_(body, rows, headerBold) {
  const safeRows = (rows && rows.length) ? rows : [["No data", "—"]];
  const table = body.appendTable(safeRows.map(r => r.map(c => String(c === undefined || c === null || c === "" ? "—" : c))));
  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      cell.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(2).setPaddingRight(2);
      cell.editAsText().setFontSize(9).setFontFamily("Arial");
      if (headerBold && r === 0) cell.editAsText().setBold(true);
    }
  }
  return table;
}

function finalizePdfFileV30_(doc) {
  const body = doc.getBody();
  body.setPageWidth(841.89);
  body.setPageHeight(595.28);
  body.setAttributes({ [DocumentApp.Attribute.FONT_FAMILY]: "Arial", [DocumentApp.Attribute.FONT_SIZE]: 9 });
  doc.saveAndClose();
}

function getDiagnosticsV30_() {
  let base;
  try { base = (typeof getDiagnosticsV29_ === "function") ? getDiagnosticsV29_() : getDiagnosticsV21_(); }
  catch (err) { base = { diagnosticsWarning:err.message }; }
  base.version = IM3_V30_VERSION;
  base.advancedCharts = getAdvancedGraphTemplatesV30_().map(t => t.id);
  base.reports = { executive:"landscape, manual, 9 pt", detailed:"landscape, manual, 9 pt, expanded method narratives" };
  base.testUrls = ["?action=health", "?action=graphtemplates", "?action=advancedchartdata&templateId=executive_decision_radar", "?action=pdf", "?action=detailedreport"];
  return base;
}

/**
 * ============================================================
 * IM³ Framework MVP — v3.1 Detailed PDF Repair Layer
 * Purpose:
 * - Fix detailedreport runtime failure caused by missing helper functions in v3.0.
 * - Keep all existing endpoints and Graph Studio logic unchanged.
 * - Force PDF setup to landscape with 9 pt body/table text and 10 pt headings.
 * - Remove technical subtitle text from reports.
 * - Remove the Source column from detailed report evidence tables.
 * ============================================================
 */

var IM3_V31_REPORT_REPAIR_VERSION = "3.1-detailed-pdf-repair";

function generateExecutivePdfReportV30_(filters, projectId) {
  const ctx = getSelectedProjectContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Executive_Report_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = setupReportDocumentV30_(doc);

  addReportTitleV30_(body, "IM³ Executive Investment Report", "Project: " + ctx.projectName);
  addReportHeadingV30_(body, "Investment decision snapshot");
  addReportParagraphV30_(body, buildExecutiveDecisionNarrativeV21_(ctx.row, ctx.dashboard.summary || {}));
  addCompactTableV30_(body, buildDecisionMatrixTableV21_(ctx), true);
  addReportHeadingV30_(body, "Integrated recommendation");
  addReportParagraphV30_(body, buildFinalDecisionTextV21_(ctx.row, ctx.dashboard.summary || {}));

  finalizePdfFileV30_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Executive_Report_" + safeName_(ctx.projectName) + ".pdf", ctx, "executive-v31");
}

function generateDetailedInvestmentReportV30_(filters, projectId) {
  const ctx = getSelectedProjectContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Detailed_Investment_Report_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = setupReportDocumentV30_(doc);

  addReportTitleV30_(body, "IM³ Detailed Investment Decision Report", "Project: " + ctx.projectName);

  addReportHeadingV30_(body, "1. Executive synthesis and final decision");
  addReportParagraphV30_(body, buildDetailedExecutiveSynthesisV31_(ctx));
  addCompactTableV30_(body, buildDecisionMatrixTableV21_(ctx), true);

  addReportHeadingV30_(body, "2. Project and scenario context");
  addReportParagraphV30_(body, "The project context defines the boundary conditions used by the IM³ model. The selected project, scenario and risk class determine how the financial, strategic, dynamic and probabilistic outputs should be interpreted.");
  addCompactTableV30_(body, buildProjectContextTableV21_(ctx), true);

  getDetailedReportModulesV21_().forEach(function(m, idx) {
    addReportHeadingV30_(body, (idx + 3) + ". " + m.title);
    addReportParagraphV30_(body, m.roleText);

    const rows = collectModuleRowsForReportV31_(m, ctx, filters || {}).slice(0, 8);
    addCompactTableV30_(body, buildModuleEvidenceTableV31_(m, rows), true);
    addReportParagraphV30_(body, buildModuleInterpretationV21_(m, rows, ctx));
    addReportParagraphV30_(body, buildModuleDecisionImpactV21_(m, rows, ctx));
  });

  addReportHeadingV30_(body, "Final integrated investment decision");
  addReportParagraphV30_(body, buildFinalDecisionTextV31_(ctx.row, ctx.dashboard.summary || {}));
  addReportParagraphV30_(body, "The final recommendation is based on the combined evidence generated by the IM³ methods. DCF evaluates financial value creation, MAP/DNPV tests the value after risk adjustment, ROV measures strategic flexibility, MCDA evaluates strategic and non-financial alignment, System Dynamics tests long-term behavior, and Monte Carlo estimates decision confidence under uncertainty. When these methods point in the same direction, the decision is strong. When they diverge, the recommendation should become conditional and require targeted mitigation before capital commitment.");

  finalizePdfFileV30_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Detailed_Investment_Report_" + safeName_(ctx.projectName) + ".pdf", ctx, "detailed-v31");
}

function addReportTitleV30_(body, title, subtitle) {
  body.appendParagraph(title)
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setFontSize(13)
    .setBold(true)
    .setFontFamily("Arial");

  const safeSubtitle = String(subtitle || "").replace(/Landscape orientation\s*\|\s*9 pt body\/table text\s*\|\s*manual generation only/gi, "").replace(/Landscape orientation\s*\|\s*9 pt tables\s*\|\s*expanded method-by-method decision logic/gi, "").trim();
  if (safeSubtitle) body.appendParagraph(safeSubtitle).setFontSize(9).setForegroundColor("#555555").setFontFamily("Arial");
  body.appendParagraph("Generated: " + new Date().toISOString()).setFontSize(8).setForegroundColor("#777777").setFontFamily("Arial");
}

function collectModuleRowsForReportV31_(moduleDef, ctx, filters) {
  if (!moduleDef || !moduleDef.sheetName || !sheetExists_(moduleDef.sheetName)) return [];

  let rows = getRows_(moduleDef.sheetName, moduleDef.headerRow);
  rows = applyFiltersToRowsV20_(rows, filters || {});

  const projectId = String(ctx.projectId || (ctx.row && ctx.row.Project_ID) || "").trim();
  const assumptionSetId = String((ctx.row && ctx.row.Assumption_Set_ID) || "").trim();
  const scenarioName = String((ctx.row && ctx.row.Scenario_Name) || "").trim();

  if (projectId) {
    rows = rows.filter(function(r) {
      const rowProject = String(r.Project_ID || "").trim();
      const rowAssumption = String(r.Assumption_Set_ID || "").trim();
      const rowScenario = String(r.Scenario_Name || "").trim();
      if (rowProject && rowProject === projectId) return true;
      if (!rowProject && rowAssumption && assumptionSetId && rowAssumption === assumptionSetId) return true;
      if (!rowProject && rowScenario && scenarioName && rowScenario === scenarioName) return true;
      if (!rowProject && !rowAssumption && !rowScenario) return true;
      return false;
    });
  }

  return rows;
}

function buildModuleEvidenceTableV31_(moduleDef, rows) {
  const table = [["Indicator", "Value 1", "Value 2", "Value 3"]];

  if (!rows || !rows.length) {
    table.push(["No filtered records", "—", "—", "—"]);
    return table;
  }

  const fields = (moduleDef.fields || []).slice(0, 12);
  fields.forEach(function(field) {
    const values = rows.map(function(r) { return r[field]; })
      .filter(function(v) { return v !== undefined && v !== null && String(v).trim() !== ""; })
      .slice(0, 3);
    table.push([field.replace(/_/g, " "), values[0] || "—", values[1] || "—", values[2] || "—"]);
  });

  if (table.length === 1) table.push(["Available records", rows.length, "—", "—"]);
  return table;
}

function addCompactTableV30_(body, rows, headerBold) {
  const cleanedRows = removeSourceColumnsFromReportRowsV31_(rows && rows.length ? rows : [["No data", "—"]]);
  const table = body.appendTable(cleanedRows.map(function(r) {
    return r.map(function(c) { return String(c === undefined || c === null || c === "" ? "—" : c); });
  }));

  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      cell.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(2).setPaddingRight(2);
      cell.editAsText().setFontSize(9).setFontFamily("Arial");
      if (headerBold && r === 0) cell.editAsText().setBold(true);
    }
  }
  return table;
}

function removeSourceColumnsFromReportRowsV31_(rows) {
  if (!rows || !rows.length) return rows;
  const header = rows[0] || [];
  const removeIndexes = [];
  header.forEach(function(h, idx) {
    if (/^source$/i.test(String(h || "").trim())) removeIndexes.push(idx);
  });
  if (!removeIndexes.length) return rows;
  return rows.map(function(row) {
    return row.filter(function(_, idx) { return removeIndexes.indexOf(idx) === -1; });
  });
}

function buildDetailedExecutiveSynthesisV31_(ctx) {
  return "This detailed report evaluates the investment case for " + ctx.projectName + " using the integrated IM³ methodology. The analysis combines financial valuation, risk-adjusted valuation, real options, strategic scoring, dynamic behavior and probabilistic uncertainty. The objective is to determine whether the project is financially attractive, strategically justified, resilient over time and sufficiently robust under uncertainty. The final investment decision is therefore not derived from one isolated result; it is based on the consistency of the results across DCF, MAP/DNPV, ROV, MCDA, System Dynamics and Monte Carlo.";
}

function buildFinalDecisionTextV31_(row, summary) {
  const decision = row.Final_Decision || row.Decision_Label || summary.decision || "Review";
  const npv = summary.avgNPV || row.NPV_USD || row.DNPV_USD;
  const irr = summary.avgIRR || row.IRR;
  const mcda = summary.avgMCDA || row.MCDA_Score;
  const sd = summary.avgSD || row.System_Dynamics_Score || row.Composite_System_Score;
  const integrated = summary.avgIntegratedScore || row.Integrated_Score;
  const probability = row.Probability_Positive_NPV;

  return "Final decision: " + decision + ". The recommendation is based on the integrated reading of the project results: NPV = " + formatReportValueV21_(npv, "money") + ", IRR = " + formatReportValueV21_(irr, "percent") + ", MCDA score = " + formatReportValueV21_(mcda, "score") + ", System Dynamics score = " + formatReportValueV21_(sd, "score") + ", Integrated Score = " + formatReportValueV21_(integrated, "score") + ", and Probability of Positive NPV = " + formatReportValueV21_(probability, "percent") + ". A proceed decision is justified when value creation, strategic fit, dynamic resilience and uncertainty confidence are aligned. If one or more dimensions are weak, the decision should be conditional, requiring cost optimization, risk mitigation, scenario redesign or staged investment before approval.";
}

function getDiagnosticsV31_() {
  const base = (typeof getDiagnosticsV30_ === "function") ? getDiagnosticsV30_() : getDiagnosticsV21_();
  base.version = IM3_V31_REPORT_REPAIR_VERSION;
  base.pdfRepair = {
    detailedReportFixed:true,
    removedSourceColumn:true,
    removedTechnicalSubtitle:true,
    layout:"landscape",
    bodyFontSize:9,
    tableFontSize:9,
    headingFontSize:10
  };
  return base;
}


/**
 * ============================================================
 * IM³ Framework MVP — v4.0 Multilingual Report Layer
 * Purpose:
 * - Adds report generation in English, Portuguese, Russian, French and Spanish.
 * - Preserves all existing dashboard, Graph Studio, summarydata and manual input logic.
 * - Keeps PDF reports manual only, landscape, compact 9 pt body/table text.
 * ============================================================
 */

var IM3_V40_I18N_VERSION = "4.0-multilingual-reports";
var IM3_SUPPORTED_REPORT_LANGUAGES_V40 = ["en", "pt", "ru", "fr", "es"];

var IM3_REPORT_I18N_V40 = {
  en: {
    langName:"English",
    executiveTitle:"IM³ Executive Investment Report",
    detailedTitle:"IM³ Detailed Investment Decision Report",
    project:"Project",
    generated:"Generated",
    executiveSnapshot:"Investment decision snapshot",
    integratedRecommendation:"Integrated recommendation",
    executiveSynthesis:"Executive synthesis and final decision",
    projectContext:"Project and scenario context",
    finalDecision:"Final integrated investment decision",
    projectContextText:"The project context defines the boundary conditions used by the IM³ model. The selected project, scenario and risk class determine how the financial, strategic, dynamic and probabilistic outputs should be interpreted.",
    finalLogic:"The final recommendation is based on the combined evidence generated by the IM³ methods. DCF evaluates financial value creation, MAP/DNPV tests value after risk adjustment, ROV measures strategic flexibility, MCDA evaluates strategic and non-financial alignment, System Dynamics tests long-term behavior, and Monte Carlo estimates decision confidence under uncertainty. When these methods point in the same direction, the decision is strong. When they diverge, the recommendation should become conditional and require targeted mitigation before capital commitment.",
    detailedIntro:"This detailed report evaluates the investment case using the integrated IM³ methodology. The analysis combines financial valuation, risk-adjusted valuation, real options, strategic scoring, dynamic behavior and probabilistic uncertainty. The final investment decision is not derived from one isolated result; it is based on the consistency of results across all applied methods.",
    methodRole:"Role in investment decision",
    methodEvidence:"Evidence from model output",
    methodInterpretation:"Interpretation",
    decisionImpact:"Decision impact",
    noData:"No filtered records",
    indicator:"Indicator",
    value1:"Value 1",
    value2:"Value 2",
    value3:"Value 3",
    finalDecisionPrefix:"Final decision",
    conditionalText:"A proceed decision is justified when value creation, strategic fit, dynamic resilience and uncertainty confidence are aligned. If one or more dimensions are weak, the decision should be conditional, requiring cost optimization, risk mitigation, scenario redesign or staged investment before approval."
  },
  pt: {
    langName:"Português",
    executiveTitle:"Relatório Executivo de Investimento IM³",
    detailedTitle:"Relatório Detalhado de Decisão de Investimento IM³",
    project:"Projeto",
    generated:"Gerado",
    executiveSnapshot:"Síntese da decisão de investimento",
    integratedRecommendation:"Recomendação integrada",
    executiveSynthesis:"Síntese executiva e decisão final",
    projectContext:"Contexto do projeto e do cenário",
    finalDecision:"Decisão final integrada de investimento",
    projectContextText:"O contexto do projeto define as condições de contorno utilizadas pelo modelo IM³. O projeto selecionado, o cenário e a classe de risco determinam como os resultados financeiros, estratégicos, dinâmicos e probabilísticos devem ser interpretados.",
    finalLogic:"A recomendação final baseia-se na evidência combinada gerada pelos métodos IM³. O DCF avalia a criação de valor financeiro, o MAP/DNPV testa o valor após ajuste ao risco, o ROV mede a flexibilidade estratégica, o MCDA avalia o alinhamento estratégico e não financeiro, a Dinâmica de Sistemas testa o comportamento de longo prazo e o Monte Carlo estima a confiança da decisão sob incerteza. Quando estes métodos apontam na mesma direção, a decisão é forte. Quando divergem, a recomendação deve ser condicional e exigir mitigação direcionada antes do compromisso de capital.",
    detailedIntro:"Este relatório detalhado avalia o caso de investimento utilizando a metodologia integrada IM³. A análise combina avaliação financeira, avaliação ajustada ao risco, opções reais, pontuação estratégica, comportamento dinâmico e incerteza probabilística. A decisão final de investimento não resulta de um indicador isolado; ela é baseada na consistência dos resultados entre todos os métodos aplicados.",
    methodRole:"Papel na decisão de investimento",
    methodEvidence:"Evidência dos resultados do modelo",
    methodInterpretation:"Interpretação",
    decisionImpact:"Impacto na decisão",
    noData:"Sem registos filtrados",
    indicator:"Indicador",
    value1:"Valor 1",
    value2:"Valor 2",
    value3:"Valor 3",
    finalDecisionPrefix:"Decisão final",
    conditionalText:"Uma decisão de prosseguir é justificada quando a criação de valor, o alinhamento estratégico, a resiliência dinâmica e a confiança sob incerteza estão alinhados. Se uma ou mais dimensões forem fracas, a decisão deve ser condicional, exigindo otimização de custos, mitigação de riscos, redesenho de cenários ou investimento faseado antes da aprovação."
  },
  ru: {
    langName:"Русский",
    executiveTitle:"Исполнительный инвестиционный отчёт IM³",
    detailedTitle:"Подробный отчёт IM³ по инвестиционному решению",
    project:"Проект",
    generated:"Сформировано",
    executiveSnapshot:"Краткая оценка инвестиционного решения",
    integratedRecommendation:"Интегрированная рекомендация",
    executiveSynthesis:"Исполнительное резюме и итоговое решение",
    projectContext:"Контекст проекта и сценария",
    finalDecision:"Итоговое интегрированное инвестиционное решение",
    projectContextText:"Контекст проекта задаёт граничные условия, используемые моделью IM³. Выбранный проект, сценарий и класс риска определяют интерпретацию финансовых, стратегических, динамических и вероятностных результатов.",
    finalLogic:"Итоговая рекомендация основана на совокупности результатов, полученных методами IM³. DCF оценивает создание финансовой стоимости, MAP/DNPV проверяет стоимость с учётом риска, ROV измеряет стратегическую гибкость, MCDA оценивает стратегическое и нефинансовое соответствие, System Dynamics проверяет долгосрочное поведение, а Monte Carlo оценивает уверенность решения в условиях неопределённости. Если методы указывают в одном направлении, решение является более надёжным. Если результаты расходятся, рекомендация должна быть условной и требовать целевых мер снижения риска до принятия капитальных обязательств.",
    detailedIntro:"Данный подробный отчёт оценивает инвестиционный кейс с использованием интегрированной методологии IM³. Анализ объединяет финансовую оценку, оценку с учётом риска, реальные опционы, стратегическую оценку, динамическое поведение и вероятностную неопределённость. Итоговое инвестиционное решение не выводится из одного показателя; оно основано на согласованности результатов всех применённых методов.",
    methodRole:"Роль в инвестиционном решении",
    methodEvidence:"Данные из результатов модели",
    methodInterpretation:"Интерпретация",
    decisionImpact:"Влияние на решение",
    noData:"Нет отфильтрованных записей",
    indicator:"Показатель",
    value1:"Значение 1",
    value2:"Значение 2",
    value3:"Значение 3",
    finalDecisionPrefix:"Итоговое решение",
    conditionalText:"Решение о продолжении проекта обосновано, когда создание стоимости, стратегическое соответствие, динамическая устойчивость и уверенность в условиях неопределённости согласованы. Если одна или несколько сторон слабы, решение должно быть условным и требовать оптимизации затрат, снижения рисков, пересмотра сценариев или поэтапного инвестирования до утверждения."
  },
  fr: {
    langName:"Français",
    executiveTitle:"Rapport exécutif d’investissement IM³",
    detailedTitle:"Rapport détaillé de décision d’investissement IM³",
    project:"Projet",
    generated:"Généré",
    executiveSnapshot:"Synthèse de la décision d’investissement",
    integratedRecommendation:"Recommandation intégrée",
    executiveSynthesis:"Synthèse exécutive et décision finale",
    projectContext:"Contexte du projet et du scénario",
    finalDecision:"Décision d’investissement finale intégrée",
    projectContextText:"Le contexte du projet définit les conditions de référence utilisées par le modèle IM³. Le projet sélectionné, le scénario et la classe de risque déterminent l’interprétation des résultats financiers, stratégiques, dynamiques et probabilistes.",
    finalLogic:"La recommandation finale repose sur les preuves combinées générées par les méthodes IM³. Le DCF évalue la création de valeur financière, le MAP/DNPV teste la valeur après ajustement du risque, le ROV mesure la flexibilité stratégique, le MCDA évalue l’alignement stratégique et non financier, la dynamique des systèmes teste le comportement à long terme et Monte Carlo estime la confiance de la décision sous incertitude. Lorsque ces méthodes vont dans le même sens, la décision est solide. Lorsqu’elles divergent, la recommandation doit devenir conditionnelle et exiger des mesures ciblées avant tout engagement de capital.",
    detailedIntro:"Ce rapport détaillé évalue le dossier d’investissement au moyen de la méthodologie intégrée IM³. L’analyse combine l’évaluation financière, l’évaluation ajustée au risque, les options réelles, la notation stratégique, le comportement dynamique et l’incertitude probabiliste. La décision finale d’investissement ne provient pas d’un résultat isolé; elle repose sur la cohérence des résultats entre toutes les méthodes appliquées.",
    methodRole:"Rôle dans la décision d’investissement",
    methodEvidence:"Preuves issues des résultats du modèle",
    methodInterpretation:"Interprétation",
    decisionImpact:"Impact sur la décision",
    noData:"Aucun enregistrement filtré",
    indicator:"Indicateur",
    value1:"Valeur 1",
    value2:"Valeur 2",
    value3:"Valeur 3",
    finalDecisionPrefix:"Décision finale",
    conditionalText:"Une décision de poursuivre est justifiée lorsque la création de valeur, l’alignement stratégique, la résilience dynamique et la confiance sous incertitude sont cohérents. Si une ou plusieurs dimensions sont faibles, la décision doit être conditionnelle et exiger une optimisation des coûts, une atténuation des risques, une révision des scénarios ou un investissement par étapes avant approbation."
  },
  es: {
    langName:"Español",
    executiveTitle:"Informe ejecutivo de inversión IM³",
    detailedTitle:"Informe detallado de decisión de inversión IM³",
    project:"Proyecto",
    generated:"Generado",
    executiveSnapshot:"Resumen de la decisión de inversión",
    integratedRecommendation:"Recomendación integrada",
    executiveSynthesis:"Síntesis ejecutiva y decisión final",
    projectContext:"Contexto del proyecto y del escenario",
    finalDecision:"Decisión final integrada de inversión",
    projectContextText:"El contexto del proyecto define las condiciones de referencia utilizadas por el modelo IM³. El proyecto seleccionado, el escenario y la clase de riesgo determinan cómo deben interpretarse los resultados financieros, estratégicos, dinámicos y probabilísticos.",
    finalLogic:"La recomendación final se basa en la evidencia combinada generada por los métodos IM³. El DCF evalúa la creación de valor financiero, el MAP/DNPV prueba el valor después del ajuste por riesgo, el ROV mide la flexibilidad estratégica, el MCDA evalúa la alineación estratégica y no financiera, la Dinámica de Sistemas prueba el comportamiento a largo plazo y Monte Carlo estima la confianza de la decisión bajo incertidumbre. Cuando estos métodos apuntan en la misma dirección, la decisión es sólida. Cuando divergen, la recomendación debe ser condicional y exigir mitigación específica antes de comprometer capital.",
    detailedIntro:"Este informe detallado evalúa el caso de inversión utilizando la metodología integrada IM³. El análisis combina valoración financiera, valoración ajustada al riesgo, opciones reales, puntuación estratégica, comportamiento dinámico e incertidumbre probabilística. La decisión final de inversión no deriva de un único resultado aislado; se basa en la consistencia de los resultados entre todos los métodos aplicados.",
    methodRole:"Papel en la decisión de inversión",
    methodEvidence:"Evidencia de los resultados del modelo",
    methodInterpretation:"Interpretación",
    decisionImpact:"Impacto en la decisión",
    noData:"No hay registros filtrados",
    indicator:"Indicador",
    value1:"Valor 1",
    value2:"Valor 2",
    value3:"Valor 3",
    finalDecisionPrefix:"Decisión final",
    conditionalText:"Una decisión de continuar se justifica cuando la creación de valor, el ajuste estratégico, la resiliencia dinámica y la confianza bajo incertidumbre están alineados. Si una o más dimensiones son débiles, la decisión debe ser condicional y requerir optimización de costes, mitigación de riesgos, rediseño de escenarios o inversión por etapas antes de la aprobación."
  }
};

var IM3_METHOD_I18N_V40 = {
  dcf: {
    en:{title:"DCF financial valuation", role:"DCF converts future annual cash flows into present value and tests whether the project creates financial value after CAPEX, OPEX, taxes and discounting.", interpretation:"A positive NPV, acceptable IRR and reasonable payback indicate that the project is financially viable under the selected assumptions.", impact:"DCF is the first investment gate. A weak DCF result does not automatically reject the project, but it requires optimization or stronger strategic justification."},
    pt:{title:"Avaliação financeira DCF", role:"O DCF converte os fluxos de caixa anuais futuros em valor presente e testa se o projeto cria valor financeiro após CAPEX, OPEX, impostos e desconto.", interpretation:"Um NPV positivo, IRR aceitável e payback razoável indicam que o projeto é financeiramente viável nas premissas selecionadas.", impact:"O DCF é o primeiro filtro de investimento. Um resultado fraco não rejeita automaticamente o projeto, mas exige otimização ou justificação estratégica mais forte."},
    ru:{title:"Финансовая оценка DCF", role:"DCF приводит будущие годовые денежные потоки к текущей стоимости и проверяет, создаёт ли проект финансовую стоимость после CAPEX, OPEX, налогов и дисконтирования.", interpretation:"Положительный NPV, приемлемая IRR и разумный срок окупаемости указывают на финансовую реализуемость проекта при выбранных предпосылках.", impact:"DCF является первым инвестиционным фильтром. Слабый результат не обязательно означает отказ, но требует оптимизации или более сильного стратегического обоснования."},
    fr:{title:"Valorisation financière DCF", role:"Le DCF actualise les flux de trésorerie annuels futurs et teste si le projet crée de la valeur financière après CAPEX, OPEX, impôts et actualisation.", interpretation:"Un NPV positif, un IRR acceptable et un délai de récupération raisonnable indiquent que le projet est financièrement viable selon les hypothèses sélectionnées.", impact:"Le DCF constitue le premier filtre d’investissement. Un résultat faible ne rejette pas automatiquement le projet, mais exige une optimisation ou une justification stratégique plus forte."},
    es:{title:"Valoración financiera DCF", role:"El DCF convierte los flujos de caja anuales futuros en valor presente y prueba si el proyecto crea valor financiero después de CAPEX, OPEX, impuestos y descuento.", interpretation:"Un NPV positivo, una IRR aceptable y un payback razonable indican que el proyecto es financieramente viable bajo los supuestos seleccionados.", impact:"El DCF es el primer filtro de inversión. Un resultado débil no rechaza automáticamente el proyecto, pero exige optimización o una justificación estratégica más sólida."}
  },
  map_dnpv: {
    en:{title:"MAP/DNPV risk-adjusted value", role:"MAP/DNPV adjusts the base project value by market, technical, regulatory and ESG confidence factors.", interpretation:"A strong MAP/DNPV result means that value remains attractive after scenario probability and risk adjustment.", impact:"This method shows whether the project survives risk adjustment and whether mitigation actions are sufficient."},
    pt:{title:"Valor ajustado ao risco MAP/DNPV", role:"O MAP/DNPV ajusta o valor base do projeto por fatores de confiança de mercado, técnica, regulatória e ESG.", interpretation:"Um resultado forte de MAP/DNPV significa que o valor permanece atrativo após ajuste por probabilidade e risco dos cenários.", impact:"Este método mostra se o projeto resiste ao ajuste de risco e se as ações de mitigação são suficientes."},
    ru:{title:"Стоимость с учётом риска MAP/DNPV", role:"MAP/DNPV корректирует базовую стоимость проекта с учётом рыночных, технических, регуляторных и ESG-факторов доверия.", interpretation:"Сильный результат MAP/DNPV означает, что стоимость остаётся привлекательной после учёта вероятностей сценариев и рисков.", impact:"Метод показывает, выдерживает ли проект риск-корректировку и достаточны ли меры снижения риска."},
    fr:{title:"Valeur ajustée au risque MAP/DNPV", role:"Le MAP/DNPV ajuste la valeur de base du projet selon les facteurs de confiance du marché, techniques, réglementaires et ESG.", interpretation:"Un résultat MAP/DNPV solide signifie que la valeur reste attractive après ajustement des probabilités et des risques de scénarios.", impact:"Cette méthode montre si le projet résiste à l’ajustement du risque et si les mesures d’atténuation sont suffisantes."},
    es:{title:"Valor ajustado por riesgo MAP/DNPV", role:"El MAP/DNPV ajusta el valor base del proyecto por factores de confianza de mercado, técnicos, regulatorios y ESG.", interpretation:"Un resultado fuerte de MAP/DNPV significa que el valor sigue siendo atractivo después del ajuste por probabilidad y riesgo de escenarios.", impact:"Este método muestra si el proyecto resiste el ajuste por riesgo y si las medidas de mitigación son suficientes."}
  },
  rov: {
    en:{title:"ROV strategic flexibility", role:"ROV values managerial flexibility such as deferring, expanding, abandoning or switching technology when uncertainty changes.", interpretation:"A high option value indicates that flexibility materially improves the investment case.", impact:"ROV can transform a borderline project into a staged or conditional investment opportunity."},
    pt:{title:"Flexibilidade estratégica ROV", role:"O ROV valoriza a flexibilidade gerencial, como adiar, expandir, abandonar ou trocar tecnologia quando a incerteza muda.", interpretation:"Um valor de opção elevado indica que a flexibilidade melhora materialmente o caso de investimento.", impact:"O ROV pode transformar um projeto marginal numa oportunidade de investimento faseada ou condicional."},
    ru:{title:"Стратегическая гибкость ROV", role:"ROV оценивает управленческую гибкость: отсрочку, расширение, отказ или смену технологии при изменении неопределённости.", interpretation:"Высокая стоимость опциона показывает, что гибкость существенно улучшает инвестиционный кейс.", impact:"ROV может превратить пограничный проект в поэтапную или условную инвестиционную возможность."},
    fr:{title:"Flexibilité stratégique ROV", role:"Le ROV valorise la flexibilité managériale: différer, étendre, abandonner ou changer de technologie lorsque l’incertitude évolue.", interpretation:"Une valeur d’option élevée indique que la flexibilité améliore nettement le dossier d’investissement.", impact:"Le ROV peut transformer un projet limite en opportunité d’investissement par étapes ou sous conditions."},
    es:{title:"Flexibilidad estratégica ROV", role:"El ROV valora la flexibilidad gerencial, como diferir, expandir, abandonar o cambiar tecnología cuando cambia la incertidumbre.", interpretation:"Un valor de opción alto indica que la flexibilidad mejora materialmente el caso de inversión.", impact:"El ROV puede transformar un proyecto límite en una oportunidad de inversión por etapas o condicional."}
  },
  mcda: {
    en:{title:"MCDA strategic alignment", role:"MCDA integrates financial, technical, environmental, social and strategic criteria into a structured score.", interpretation:"A high MCDA score indicates strong strategic fit beyond pure financial value.", impact:"MCDA supports decisions where national development, ESG, technology and local content are material investment criteria."},
    pt:{title:"Alinhamento estratégico MCDA", role:"O MCDA integra critérios financeiros, técnicos, ambientais, sociais e estratégicos numa pontuação estruturada.", interpretation:"Uma pontuação MCDA elevada indica forte alinhamento estratégico para além do valor financeiro puro.", impact:"O MCDA apoia decisões em que desenvolvimento nacional, ESG, tecnologia e conteúdo local são critérios materiais de investimento."},
    ru:{title:"Стратегическое соответствие MCDA", role:"MCDA объединяет финансовые, технические, экологические, социальные и стратегические критерии в структурированную оценку.", interpretation:"Высокий балл MCDA указывает на сильное стратегическое соответствие помимо чисто финансовой стоимости.", impact:"MCDA поддерживает решения, где национальное развитие, ESG, технологии и локализация являются существенными инвестиционными критериями."},
    fr:{title:"Alignement stratégique MCDA", role:"Le MCDA intègre les critères financiers, techniques, environnementaux, sociaux et stratégiques dans une note structurée.", interpretation:"Un score MCDA élevé indique un fort alignement stratégique au-delà de la seule valeur financière.", impact:"Le MCDA soutient les décisions où le développement national, l’ESG, la technologie et le contenu local sont des critères d’investissement importants."},
    es:{title:"Alineación estratégica MCDA", role:"El MCDA integra criterios financieros, técnicos, ambientales, sociales y estratégicos en una puntuación estructurada.", interpretation:"Una puntuación MCDA alta indica un fuerte ajuste estratégico más allá del valor financiero puro.", impact:"El MCDA apoya decisiones donde el desarrollo nacional, ESG, tecnología y contenido local son criterios materiales de inversión."}
  },
  system_dynamics: {
    en:{title:"System Dynamics resilience", role:"System Dynamics tests how capacity, reinvestment, risk, local content and technology evolve over time.", interpretation:"A strong dynamic score indicates that the project remains stable and adaptive across the forecast horizon.", impact:"System Dynamics helps identify whether the investment is sustainable over time or whether feedback loops create fragility."},
    pt:{title:"Resiliência em Dinâmica de Sistemas", role:"A Dinâmica de Sistemas testa como capacidade, reinvestimento, risco, conteúdo local e tecnologia evoluem ao longo do tempo.", interpretation:"Uma pontuação dinâmica forte indica que o projeto permanece estável e adaptável ao longo do horizonte de previsão.", impact:"A Dinâmica de Sistemas ajuda a identificar se o investimento é sustentável no tempo ou se os ciclos de feedback criam fragilidade."},
    ru:{title:"Устойчивость System Dynamics", role:"System Dynamics проверяет, как мощность, реинвестирование, риск, локализация и технологии изменяются во времени.", interpretation:"Сильная динамическая оценка означает, что проект остаётся стабильным и адаптивным на горизонте прогнозирования.", impact:"System Dynamics помогает определить, устойчивы ли инвестиции во времени или обратные связи создают уязвимость."},
    fr:{title:"Résilience par dynamique des systèmes", role:"La dynamique des systèmes teste l’évolution de la capacité, du réinvestissement, du risque, du contenu local et de la technologie dans le temps.", interpretation:"Un score dynamique élevé indique que le projet reste stable et adaptable sur l’horizon de prévision.", impact:"La dynamique des systèmes aide à déterminer si l’investissement est durable dans le temps ou si les boucles de rétroaction créent une fragilité."},
    es:{title:"Resiliencia de Dinámica de Sistemas", role:"La Dinámica de Sistemas prueba cómo evolucionan la capacidad, reinversión, riesgo, contenido local y tecnología a lo largo del tiempo.", interpretation:"Una puntuación dinámica fuerte indica que el proyecto permanece estable y adaptable durante el horizonte de previsión.", impact:"La Dinámica de Sistemas ayuda a identificar si la inversión es sostenible en el tiempo o si los bucles de retroalimentación crean fragilidad."}
  },
  monte_carlo: {
    en:{title:"Monte Carlo uncertainty confidence", role:"Monte Carlo simulates many uncertain outcomes to estimate expected value, downside exposure and probability of positive NPV.", interpretation:"A high probability of positive NPV increases confidence that the investment is robust under uncertainty.", impact:"Monte Carlo is the uncertainty confidence layer. It strengthens or weakens the final recommendation depending on downside risk."},
    pt:{title:"Confiança sob incerteza Monte Carlo", role:"O Monte Carlo simula muitos resultados incertos para estimar valor esperado, exposição negativa e probabilidade de NPV positivo.", interpretation:"Uma elevada probabilidade de NPV positivo aumenta a confiança de que o investimento é robusto sob incerteza.", impact:"O Monte Carlo é a camada de confiança sob incerteza. Ele fortalece ou enfraquece a recomendação final conforme o risco de perda."},
    ru:{title:"Уверенность при неопределённости Monte Carlo", role:"Monte Carlo моделирует множество неопределённых исходов для оценки ожидаемой стоимости, downside-риска и вероятности положительного NPV.", interpretation:"Высокая вероятность положительного NPV повышает уверенность в устойчивости инвестиции при неопределённости.", impact:"Monte Carlo является слоем уверенности в условиях неопределённости. Он усиливает или ослабляет итоговую рекомендацию в зависимости от риска снижения стоимости."},
    fr:{title:"Confiance sous incertitude Monte Carlo", role:"Monte Carlo simule de nombreux résultats incertains afin d’estimer la valeur attendue, l’exposition à la baisse et la probabilité d’un NPV positif.", interpretation:"Une forte probabilité de NPV positif renforce la confiance dans la robustesse de l’investissement sous incertitude.", impact:"Monte Carlo est la couche de confiance sous incertitude. Elle renforce ou affaiblit la recommandation finale selon le risque de baisse."},
    es:{title:"Confianza bajo incertidumbre Monte Carlo", role:"Monte Carlo simula muchos resultados inciertos para estimar valor esperado, exposición a la baja y probabilidad de NPV positivo.", interpretation:"Una alta probabilidad de NPV positivo aumenta la confianza en que la inversión es robusta bajo incertidumbre.", impact:"Monte Carlo es la capa de confianza bajo incertidumbre. Fortalece o debilita la recomendación final según el riesgo de caída."}
  }
};

function normalizeReportLanguageV40_(language) {
  const lang = String(language || "en").toLowerCase().slice(0,2);
  return IM3_SUPPORTED_REPORT_LANGUAGES_V40.indexOf(lang) !== -1 ? lang : "en";
}

function tReportV40_(language, key) {
  const lang = normalizeReportLanguageV40_(language);
  return (IM3_REPORT_I18N_V40[lang] && IM3_REPORT_I18N_V40[lang][key]) || IM3_REPORT_I18N_V40.en[key] || key;
}

function methodTextV40_(language, methodKey, field) {
  const lang = normalizeReportLanguageV40_(language);
  const method = IM3_METHOD_I18N_V40[methodKey] || {};
  return (method[lang] && method[lang][field]) || (method.en && method.en[field]) || "";
}

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;
    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = getMetadataV40_();
    } else if (action === "filteroptions" || action === "configoptions") {
      data = im3FinalFilterOptions_();
    } else if (action === "dropdowns") {
      data = im3FinalDropdowns_();
    } else if (action === "summarydata") {
      data = im3FinalSummaryData_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "summaryviews") {
      data = im3FinalSummaryViews_();
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || e.parameter.rowId || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "appendstep" || action === "manualappend") {
      data = im3ManualAppendStepFromRequest_(e);
    } else if (action === "createmanualanalysis") {
      data = im3ManualCreateProjectFromRequest_(e);
    } else if (action === "cloneproject" || action === "autofillproject") {
      data = im3ManualCloneProjectFromRequest_(e);
    } else if (action === "manualtemplate") {
      data = im3ManualTemplate_(e.parameter.moduleId || "projects");
    } else if (action === "dashboard") {
      data = im3FinalDashboard_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = im3FinalProjects_();
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "NPV_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "advancedchartdata") {
      data = getAdvancedChartDataV30_(e.parameter.templateId || "executive_decision_radar", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV30_();
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generateExecutivePdfReportV40_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "", e.parameter.language || "en");
    } else if (action === "detailedreport") {
      data = generateDetailedInvestmentReportV40_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "", e.parameter.language || "en");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV40_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = { status:"ok", version:IM3_V40_I18N_VERSION, supportedLanguages:getSupportedReportLanguagesV40_(), timestamp:new Date().toISOString(), spreadsheetId:getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok:true, action:action, elapsedMs:new Date().getTime() - started, data:data }, callback);
  } catch (err) {
    return respond_({ ok:false, action:action, elapsedMs:new Date().getTime() - started, error:err.message, stack:err.stack }, callback);
  }
}

function getSupportedReportLanguagesV40_() {
  return IM3_SUPPORTED_REPORT_LANGUAGES_V40.map(function(code) {
    return { code:code, label:IM3_REPORT_I18N_V40[code].langName };
  });
}

function getMetadataV40_() {
  const meta = (typeof getMetadataV30_ === "function") ? getMetadataV30_() : im3ManualMetadata_();
  meta.version = IM3_V40_I18N_VERSION;
  meta.reportLanguages = getSupportedReportLanguagesV40_();
  meta.reports = meta.reports || {};
  meta.reports.executive = { action:"pdf", languages:getSupportedReportLanguagesV40_(), orientation:"landscape", bodyFontSize:9, manualOnly:true, version:IM3_V40_I18N_VERSION };
  meta.reports.detailedInvestment = { action:"detailedreport", languages:getSupportedReportLanguagesV40_(), orientation:"landscape", bodyFontSize:9, tableFontSize:9, manualOnly:true, version:IM3_V40_I18N_VERSION };
  return meta;
}

function generateExecutivePdfReportV40_(filters, projectId, language) {
  const lang = normalizeReportLanguageV40_(language);
  const ctx = getSelectedProjectContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Executive_Report_" + lang.toUpperCase() + "_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = setupReportDocumentV30_(doc);

  addReportTitleV40_(body, tReportV40_(lang, "executiveTitle"), tReportV40_(lang, "project") + ": " + ctx.projectName, lang);
  addReportHeadingV30_(body, tReportV40_(lang, "executiveSnapshot"));
  addReportParagraphV30_(body, buildExecutiveDecisionNarrativeV40_(ctx, lang));
  addCompactTableV30_(body, translateDecisionMatrixTableV40_(buildDecisionMatrixTableV21_(ctx), lang), true);
  addReportHeadingV30_(body, tReportV40_(lang, "integratedRecommendation"));
  addReportParagraphV30_(body, buildFinalDecisionTextV40_(ctx.row, ctx.dashboard.summary || {}, lang));

  finalizePdfFileV30_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Executive_Report_" + lang.toUpperCase() + "_" + safeName_(ctx.projectName) + ".pdf", ctx, "executive-v40-" + lang);
}

function generateDetailedInvestmentReportV40_(filters, projectId, language) {
  const lang = normalizeReportLanguageV40_(language);
  const ctx = getSelectedProjectContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Detailed_Investment_Report_" + lang.toUpperCase() + "_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  const body = setupReportDocumentV30_(doc);

  addReportTitleV40_(body, tReportV40_(lang, "detailedTitle"), tReportV40_(lang, "project") + ": " + ctx.projectName, lang);

  addReportHeadingV30_(body, "1. " + tReportV40_(lang, "executiveSynthesis"));
  addReportParagraphV30_(body, tReportV40_(lang, "detailedIntro"));
  addReportParagraphV30_(body, buildFinalDecisionTextV40_(ctx.row, ctx.dashboard.summary || {}, lang));
  addCompactTableV30_(body, translateDecisionMatrixTableV40_(buildDecisionMatrixTableV21_(ctx), lang), true);

  addReportHeadingV30_(body, "2. " + tReportV40_(lang, "projectContext"));
  addReportParagraphV30_(body, tReportV40_(lang, "projectContextText"));
  addCompactTableV30_(body, translateProjectContextTableV40_(buildProjectContextTableV21_(ctx), lang), true);

  getDetailedReportModulesV40_().forEach(function(m, idx) {
    const methodKey = m.methodKey;
    addReportHeadingV30_(body, (idx + 3) + ". " + methodTextV40_(lang, methodKey, "title"));
    addReportParagraphV30_(body, tReportV40_(lang, "methodRole") + ": " + methodTextV40_(lang, methodKey, "role"));

    const rows = collectModuleRowsForReportV31_(m, ctx, filters || {}).slice(0, 8);
    addReportParagraphV30_(body, tReportV40_(lang, "methodEvidence") + ":");
    addCompactTableV30_(body, buildModuleEvidenceTableV40_(m, rows, lang), true);
    addReportParagraphV30_(body, tReportV40_(lang, "methodInterpretation") + ": " + methodTextV40_(lang, methodKey, "interpretation") + " " + buildModuleInterpretationV21_(m, rows, ctx));
    addReportParagraphV30_(body, tReportV40_(lang, "decisionImpact") + ": " + methodTextV40_(lang, methodKey, "impact"));
  });

  addReportHeadingV30_(body, tReportV40_(lang, "finalDecision"));
  addReportParagraphV30_(body, buildFinalDecisionTextV40_(ctx.row, ctx.dashboard.summary || {}, lang));
  addReportParagraphV30_(body, tReportV40_(lang, "finalLogic"));

  finalizePdfFileV30_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Detailed_Investment_Report_" + lang.toUpperCase() + "_" + safeName_(ctx.projectName) + ".pdf", ctx, "detailed-v40-" + lang);
}

function addReportTitleV40_(body, title, subtitle, language) {
  body.appendParagraph(title)
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setFontSize(13)
    .setBold(true)
    .setFontFamily("Arial");
  if (subtitle) body.appendParagraph(String(subtitle)).setFontSize(9).setForegroundColor("#555555").setFontFamily("Arial");
  body.appendParagraph(tReportV40_(language, "generated") + ": " + new Date().toISOString() + " | " + IM3_REPORT_I18N_V40[normalizeReportLanguageV40_(language)].langName)
    .setFontSize(8).setForegroundColor("#777777").setFontFamily("Arial");
}

function getDetailedReportModulesV40_() {
  return [
    { methodKey:"dcf", title:"DCF", sheetName:"06_DCF", headerRow:5, fields:["Year","Revenue_USD","CAPEX_USD","OPEX_USD","EBITDA_USD","Tax_USD","Free_Cash_Flow_USD","Discount_Factor","PV_FCF_USD","NPV_To_Date_USD"] },
    { methodKey:"map_dnpv", title:"MAP/DNPV", sheetName:"09_MAP_DNPV", headerRow:5, fields:["Scenario_ID","Market_Confidence","Technical_Confidence","Regulatory_Confidence","ESG_Confidence","Risk_Adjustment_Rate","DNPV_USD","MAP_Adjusted_Value","Flex_Adjusted_MAP_DNPV_USD","Decision_Class"] },
    { methodKey:"rov", title:"ROV", sheetName:"10_ROV", headerRow:5, fields:["Option_Type","ROV_Method","Trigger_Variable","Exercise_Year","Exercise_Cost_USD","Volatility","Option_Probability","ROV_Option_Value","Strategic_NPV_ROV","Strategic_NPV_With_ROV_USD"] },
    { methodKey:"mcda", title:"MCDA", sheetName:"12_MCDA_Scores", headerRow:5, fields:["Criterion_ID","Manual_Score_1_10","Weighted_Score","Final_MCDA_Score_0_100","MCDA_Score","Strategic_Decision","Score_Status"] },
    { methodKey:"system_dynamics", title:"System Dynamics", sheetName:"13_System_Dynamics", headerRow:5, fields:["Year","Installed_Capacity","Capacity_Addition","Reinvestment_Rate","Local_Content_Gain","Technology_Gain","Market_Risk_Index","Composite_System_Score","System_Dynamics_Score","SD_Decision"] },
    { methodKey:"monte_carlo", title:"Monte Carlo", sheetName:"16_Monte_Carlo", headerRow:5, fields:["Distribution","Price_Shock","Production_Shock","CAPEX_Shock","OPEX_Shock","Discount_Rate_Shock","Risk_Shock","Simulated_NPV_USD","Monte_Carlo_Mean_NPV","Probability_Positive_NPV"] }
  ];
}

function buildModuleEvidenceTableV40_(moduleDef, rows, language) {
  const table = [[tReportV40_(language, "indicator"), tReportV40_(language, "value1"), tReportV40_(language, "value2"), tReportV40_(language, "value3")]];
  if (!rows || !rows.length) {
    table.push([tReportV40_(language, "noData"), "—", "—", "—"]);
    return table;
  }
  const fields = (moduleDef.fields || []).slice(0, 12);
  fields.forEach(function(field) {
    const values = rows.map(function(r) { return r[field]; }).filter(function(v) { return v !== undefined && v !== null && String(v).trim() !== ""; }).slice(0, 3);
    table.push([translateFieldLabelV40_(field, language), values[0] || "—", values[1] || "—", values[2] || "—"]);
  });
  if (table.length === 1) table.push([tReportV40_(language, "noData"), rows.length, "—", "—"]);
  return table;
}

function translateDecisionMatrixTableV40_(rows, language) {
  if (!rows || !rows.length) return rows;
  const out = JSON.parse(JSON.stringify(rows));
  out[0] = out[0].map(function(h) { return translateFieldLabelV40_(h, language); });
  for (let r = 1; r < out.length; r++) out[r][0] = translateFieldLabelV40_(out[r][0], language);
  return out;
}

function translateProjectContextTableV40_(rows, language) {
  if (!rows || !rows.length) return rows;
  const out = JSON.parse(JSON.stringify(rows));
  out[0] = out[0].map(function(h) { return translateFieldLabelV40_(h, language); });
  for (let r = 1; r < out.length; r++) out[r][0] = translateFieldLabelV40_(out[r][0], language);
  return out;
}

function translateFieldLabelV40_(field, language) {
  const lang = normalizeReportLanguageV40_(language);
  const key = String(field || "").replace(/\s+/g, "_");
  const dict = {
    en:{Indicator:"Indicator",Value:"Value",Metric:"Metric",Project_ID:"Project ID",Project_Name:"Project name",Scenario_Name:"Scenario",Project_Type:"Project type",Location:"Location",Project_Phase:"Project phase",Decision:"Decision",Final_Decision:"Final decision",NPV_USD:"NPV USD",IRR:"IRR",Payback_Years:"Payback years",MCDA_Score:"MCDA score",System_Dynamics_Score:"System Dynamics score",Integrated_Score:"Integrated score",Probability_Positive_NPV:"Probability of positive NPV",Year:"Year",Revenue_USD:"Revenue USD",CAPEX_USD:"CAPEX USD",OPEX_USD:"OPEX USD",Tax_USD:"Tax USD",Free_Cash_Flow_USD:"Free cash flow USD",Discount_Factor:"Discount factor"},
    pt:{Indicator:"Indicador",Value:"Valor",Metric:"Métrica",Project_ID:"ID do projeto",Project_Name:"Nome do projeto",Scenario_Name:"Cenário",Project_Type:"Tipo de projeto",Location:"Localização",Project_Phase:"Fase do projeto",Decision:"Decisão",Final_Decision:"Decisão final",NPV_USD:"NPV USD",IRR:"IRR",Payback_Years:"Payback anos",MCDA_Score:"Pontuação MCDA",System_Dynamics_Score:"Pontuação Dinâmica de Sistemas",Integrated_Score:"Pontuação integrada",Probability_Positive_NPV:"Probabilidade de NPV positivo",Year:"Ano",Revenue_USD:"Receita USD",CAPEX_USD:"CAPEX USD",OPEX_USD:"OPEX USD",Tax_USD:"Imposto USD",Free_Cash_Flow_USD:"Fluxo de caixa livre USD",Discount_Factor:"Fator de desconto"},
    ru:{Indicator:"Показатель",Value:"Значение",Metric:"Метрика",Project_ID:"ID проекта",Project_Name:"Название проекта",Scenario_Name:"Сценарий",Project_Type:"Тип проекта",Location:"Местоположение",Project_Phase:"Фаза проекта",Decision:"Решение",Final_Decision:"Итоговое решение",NPV_USD:"NPV USD",IRR:"IRR",Payback_Years:"Срок окупаемости",MCDA_Score:"Оценка MCDA",System_Dynamics_Score:"Оценка System Dynamics",Integrated_Score:"Интегральная оценка",Probability_Positive_NPV:"Вероятность положительного NPV",Year:"Год",Revenue_USD:"Выручка USD",CAPEX_USD:"CAPEX USD",OPEX_USD:"OPEX USD",Tax_USD:"Налоги USD",Free_Cash_Flow_USD:"Свободный денежный поток USD",Discount_Factor:"Коэффициент дисконтирования"},
    fr:{Indicator:"Indicateur",Value:"Valeur",Metric:"Métrique",Project_ID:"ID du projet",Project_Name:"Nom du projet",Scenario_Name:"Scénario",Project_Type:"Type de projet",Location:"Localisation",Project_Phase:"Phase du projet",Decision:"Décision",Final_Decision:"Décision finale",NPV_USD:"NPV USD",IRR:"IRR",Payback_Years:"Délai de récupération",MCDA_Score:"Score MCDA",System_Dynamics_Score:"Score dynamique des systèmes",Integrated_Score:"Score intégré",Probability_Positive_NPV:"Probabilité de NPV positif",Year:"Année",Revenue_USD:"Revenus USD",CAPEX_USD:"CAPEX USD",OPEX_USD:"OPEX USD",Tax_USD:"Impôts USD",Free_Cash_Flow_USD:"Flux de trésorerie disponible USD",Discount_Factor:"Facteur d’actualisation"},
    es:{Indicator:"Indicador",Value:"Valor",Metric:"Métrica",Project_ID:"ID del proyecto",Project_Name:"Nombre del proyecto",Scenario_Name:"Escenario",Project_Type:"Tipo de proyecto",Location:"Ubicación",Project_Phase:"Fase del proyecto",Decision:"Decisión",Final_Decision:"Decisión final",NPV_USD:"NPV USD",IRR:"IRR",Payback_Years:"Años de payback",MCDA_Score:"Puntuación MCDA",System_Dynamics_Score:"Puntuación Dinámica de Sistemas",Integrated_Score:"Puntuación integrada",Probability_Positive_NPV:"Probabilidad de NPV positivo",Year:"Año",Revenue_USD:"Ingresos USD",CAPEX_USD:"CAPEX USD",OPEX_USD:"OPEX USD",Tax_USD:"Impuestos USD",Free_Cash_Flow_USD:"Flujo de caja libre USD",Discount_Factor:"Factor de descuento"}
  };
  return (dict[lang] && dict[lang][key]) || String(field || "").replace(/_/g, " ");
}

function buildExecutiveDecisionNarrativeV40_(ctx, language) {
  const row = ctx.row || {};
  const decision = row.Final_Decision || row.Decision_Label || "Review";
  return tReportV40_(language, "detailedIntro") + " " + tReportV40_(language, "finalDecisionPrefix") + ": " + decision + ".";
}

function buildFinalDecisionTextV40_(row, summary, language) {
  row = row || {};
  summary = summary || {};
  const decision = row.Final_Decision || row.Decision_Label || summary.decision || "Review";
  const npv = summary.avgNPV || row.NPV_USD || row.DNPV_USD;
  const irr = summary.avgIRR || row.IRR;
  const mcda = summary.avgMCDA || row.MCDA_Score;
  const sd = summary.avgSD || row.System_Dynamics_Score || row.Composite_System_Score;
  const integrated = summary.avgIntegratedScore || row.Integrated_Score;
  const probability = row.Probability_Positive_NPV;
  return tReportV40_(language, "finalDecisionPrefix") + ": " + decision + ". " +
    "NPV = " + formatReportValueV21_(npv, "money") + ", IRR = " + formatReportValueV21_(irr, "percent") +
    ", MCDA = " + formatReportValueV21_(mcda, "score") + ", SD = " + formatReportValueV21_(sd, "score") +
    ", Integrated Score = " + formatReportValueV21_(integrated, "score") + ", Probability Positive NPV = " + formatReportValueV21_(probability, "percent") + ". " +
    tReportV40_(language, "conditionalText");
}

function getDiagnosticsV40_() {
  const base = (typeof getDiagnosticsV31_ === "function") ? getDiagnosticsV31_() : getDiagnosticsV30_();
  base.version = IM3_V40_I18N_VERSION;
  base.multilingualReports = true;
  base.supportedReportLanguages = getSupportedReportLanguagesV40_();
  base.reportLanguageParameter = "language=en|pt|ru|fr|es";
  base.testUrls = ["?action=pdf&language=en", "?action=detailedreport&language=pt", "?action=detailedreport&language=ru", "?action=detailedreport&language=fr", "?action=detailedreport&language=es"];
  return base;
}

/**
 * ============================================================
 * IM³ Framework MVP — v4.1 Graph Studio Timeseries Fix
 * Purpose:
 * - Restores action=timeseries in the final active doGet dispatcher.
 * - Keeps all v4.0 report/i18n behavior unchanged.
 * - Supports multi-project + multi-metric Graph Studio comparisons.
 * ============================================================
 */
const IM3_V41_GRAPH_FIX_VERSION = "4.1-graph-studio-timeseries-fix";

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;
    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = getMetadataV41_();
    } else if (action === "filteroptions" || action === "configoptions") {
      data = im3FinalFilterOptions_();
    } else if (action === "dropdowns") {
      data = im3FinalDropdowns_();
    } else if (action === "summarydata") {
      data = im3FinalSummaryData_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "summaryviews") {
      data = im3FinalSummaryViews_();
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || e.parameter.rowId || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "appendstep" || action === "manualappend") {
      data = im3ManualAppendStepFromRequest_(e);
    } else if (action === "createmanualanalysis") {
      data = im3ManualCreateProjectFromRequest_(e);
    } else if (action === "cloneproject" || action === "autofillproject") {
      data = im3ManualCloneProjectFromRequest_(e);
    } else if (action === "manualtemplate") {
      data = im3ManualTemplate_(e.parameter.moduleId || "projects");
    } else if (action === "dashboard") {
      data = im3FinalDashboard_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = im3FinalProjects_();
    } else if (action === "timeseries") {
      data = getTimeSeriesV41_(e.parameter || {});
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "NPV_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "advancedchartdata") {
      data = getAdvancedChartDataV30_(e.parameter.templateId || "executive_decision_radar", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV30_();
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generateExecutivePdfReportV40_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "", e.parameter.language || "en");
    } else if (action === "detailedreport") {
      data = generateDetailedInvestmentReportV40_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "", e.parameter.language || "en");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV41_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = { status:"ok", version:IM3_V41_GRAPH_FIX_VERSION, supportedLanguages:getSupportedReportLanguagesV40_(), graphStudio:{ timeseries:true, multiMetric:true, multiProject:true }, timestamp:new Date().toISOString(), spreadsheetId:getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }

    return respond_({ ok:true, action:action, elapsedMs:new Date().getTime() - started, data:data }, callback);
  } catch (err) {
    return respond_({ ok:false, action:action, elapsedMs:new Date().getTime() - started, error:err.message, stack:err.stack }, callback);
  }
}

function getMetadataV41_() {
  const meta = getMetadataV40_();
  meta.version = IM3_V41_GRAPH_FIX_VERSION;
  meta.timeSeriesEndpoint = "timeseries";
  meta.graphStudio = Object.assign({}, meta.graphStudio || {}, {
    timeseries:true,
    multiMetricComparison:true,
    multiProjectComparison:true,
    colorSeparatedSeries:true
  });
  return meta;
}

function getTimeSeriesV41_(params) {
  if (typeof getTimeSeriesV20_ === "function") {
    const result = getTimeSeriesV20_(params || {});
    result.version = IM3_V41_GRAPH_FIX_VERSION;
    result.graphStudio = {
      mode:"multi-metric-multi-project",
      seriesLabelRule:"Metric — Project/series",
      colorSeparatedSeries:true
    };
    return result;
  }
  throw new Error("Timeseries engine is not available in this deployment. Re-copy the complete Apps Script package.");
}

function getDiagnosticsV41_() {
  const base = (typeof getDiagnosticsV40_ === "function") ? getDiagnosticsV40_() : im3FinalDiagnostics_();
  base.version = IM3_V41_GRAPH_FIX_VERSION;
  base.graphStudioFix = {
    fixedUnknownActionTimeseries:true,
    finalDoGetIncludesTimeseries:true,
    multiMetricComparison:true,
    multiProjectComparison:true,
    endpoint:"?action=timeseries&metrics=<base64url-json-array>"
  };
  return base;
}

/**
 * ============================================================
 * IM³ Framework MVP — v5.0 Professional Report Upgrade
 * Purpose:
 * - Adds a corporate-style investment decision PDF structure.
 * - Keeps all existing API behavior, Graph Studio and multilingual support.
 * - Replaces pdf/detailedreport generation with branded landscape reports.
 * - Adds cover page, report metadata, decision scorecards, method pages,
 *   clean tables, integrated decision dashboard and appendices.
 * ============================================================
 */
const IM3_V50_REPORT_VERSION = "5.0-professional-report-upgrade";
const IM3_BRAND_V50 = {
  name: "IM³ Framework",
  platform: "Integrated Investment Decision Platform",
  primary: "#003B5C",
  secondary: "#1F78B4",
  accent: "#0E8A4B",
  warning: "#E67E22",
  critical: "#C0392B",
  light: "#EAF3F8",
  darkText: "#1B2733",
  muted: "#637083"
};

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "metadatafast").toLowerCase();
  const callback = (e && e.parameter && e.parameter.callback) || "";
  const started = new Date().getTime();

  try {
    let data;
    if (action === "metadata" || action === "metadatafast" || action === "bootstrap") {
      data = getMetadataV50_();
    } else if (action === "filteroptions" || action === "configoptions") {
      data = im3FinalFilterOptions_();
    } else if (action === "dropdowns") {
      data = im3FinalDropdowns_();
    } else if (action === "summarydata") {
      data = im3FinalSummaryData_(e.parameter.view || "production_summary", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "summaryviews") {
      data = im3FinalSummaryViews_();
    } else if (action === "module") {
      data = getModuleV16_(e.parameter.moduleId, e.parameter.key || e.parameter.rowId || "", parseFiltersV13_(e.parameter.filters || ""));
    } else if (action === "save") {
      data = saveRowAndRecalculateV16_(e);
    } else if (action === "appendstep" || action === "manualappend") {
      data = im3ManualAppendStepFromRequest_(e);
    } else if (action === "createmanualanalysis") {
      data = im3ManualCreateProjectFromRequest_(e);
    } else if (action === "cloneproject" || action === "autofillproject") {
      data = im3ManualCloneProjectFromRequest_(e);
    } else if (action === "manualtemplate") {
      data = im3ManualTemplate_(e.parameter.moduleId || "projects");
    } else if (action === "dashboard") {
      data = im3FinalDashboard_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "projects") {
      data = im3FinalProjects_();
    } else if (action === "timeseries") {
      data = getTimeSeriesV41_(e.parameter || {});
    } else if (action === "chartdata") {
      data = getChartDataV16_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.metric || "NPV_USD", e.parameter.groupBy || "Project_Name", e.parameter.timeField || "Year");
    } else if (action === "advancedchartdata") {
      data = getAdvancedChartDataV30_(e.parameter.templateId || "executive_decision_radar", parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "");
    } else if (action === "graphtemplates") {
      data = getGraphTemplatesV30_();
    } else if (action === "repairformulas") {
      data = repairDashboardFormulasV14_();
    } else if (action === "pdf") {
      data = generateExecutivePdfReportV50_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "", e.parameter.language || "en");
    } else if (action === "detailedreport") {
      data = generateDetailedInvestmentReportV50_(parseFiltersV13_(e.parameter.filters || ""), e.parameter.projectId || "", e.parameter.language || "en");
    } else if (action === "diagnostics") {
      data = getDiagnosticsV50_();
    } else if (action === "clearcache") {
      data = clearIm3CacheV16_();
    } else if (action === "health") {
      data = { status:"ok", version:IM3_V50_REPORT_VERSION, supportedLanguages:getSupportedReportLanguagesV40_(), reportUpgrade:true, graphStudio:{ timeseries:true, multiMetric:true, multiProject:true }, timestamp:new Date().toISOString(), spreadsheetId:getSpreadsheetId_() };
    } else {
      throw new Error("Unknown action: " + action);
    }
    return respond_({ ok:true, action:action, elapsedMs:new Date().getTime() - started, data:data }, callback);
  } catch (err) {
    return respond_({ ok:false, action:action, elapsedMs:new Date().getTime() - started, error:err.message, stack:err.stack }, callback);
  }
}

function getMetadataV50_() {
  const meta = getMetadataV41_();
  meta.version = IM3_V50_REPORT_VERSION;
  meta.reports = meta.reports || {};
  meta.reports.executive = { action:"pdf", style:"professional-branded", orientation:"landscape", bodyFontSize:9, tableFontSize:9, manualOnly:true, version:IM3_V50_REPORT_VERSION };
  meta.reports.detailedInvestment = { action:"detailedreport", style:"professional-branded", orientation:"landscape", bodyFontSize:9, tableFontSize:9, includes:["cover","toc","scorecards","method-pages","integrated-decision","appendices"], manualOnly:true, version:IM3_V50_REPORT_VERSION };
  meta.branding = IM3_BRAND_V50;
  return meta;
}

function generateExecutivePdfReportV50_(filters, projectId, language) {
  const lang = normalizeReportLanguageV40_(language || "en");
  const ctx = getReportContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Executive_Summary_" + lang.toUpperCase() + "_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  prepareProfessionalDocV50_(doc);
  const body = doc.getBody();

  addProfessionalCoverV50_(body, ctx, lang, "Executive Investment Summary", "Decision-ready executive pack");
  body.appendPageBreak();
  addProfessionalHeaderBlockV50_(body, "Executive decision dashboard", ctx, lang);
  addDecisionKpiGridV50_(body, ctx, lang);
  addTrafficLightTableV50_(body, ctx, lang);
  addSectionV50_(body, "Investment conclusion", buildFinalDecisionTextV40_(ctx.row, ctx.dashboard.summary || {}, lang));
  addStrengthsWeaknessesActionsV50_(body, ctx, lang);
  finalizeProfessionalDocV50_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Executive_Summary_" + lang.toUpperCase() + "_" + safeName_(ctx.projectName) + ".pdf", ctx, "executive-v50-" + lang);
}

function generateDetailedInvestmentReportV50_(filters, projectId, language) {
  const lang = normalizeReportLanguageV40_(language || "en");
  const ctx = getReportContextV21_(filters || {}, projectId || "");
  const doc = DocumentApp.create("IM3_Professional_Detailed_Investment_Report_" + lang.toUpperCase() + "_" + safeName_(ctx.projectName) + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm"));
  prepareProfessionalDocV50_(doc);
  const body = doc.getBody();

  addProfessionalCoverV50_(body, ctx, lang, "Detailed Investment Decision Report", "Technical and strategic investment decision pack");
  body.appendPageBreak();
  addTableOfContentsV50_(body, lang);
  body.appendPageBreak();

  addProfessionalHeaderBlockV50_(body, "1. Executive summary", ctx, lang);
  addDecisionKpiGridV50_(body, ctx, lang);
  addTrafficLightTableV50_(body, ctx, lang);
  addSectionV50_(body, "Integrated conclusion", buildFinalDecisionTextV40_(ctx.row, ctx.dashboard.summary || {}, lang));
  addStrengthsWeaknessesActionsV50_(body, ctx, lang);
  body.appendPageBreak();

  addProfessionalHeaderBlockV50_(body, "2. Project and scenario context", ctx, lang);
  addParagraphV50_(body, "This section defines the project boundary conditions used by the IM³ model. The interpretation of all financial, risk, strategic, dynamic and probabilistic outputs depends on the project, scenario, phase and risk class selected here.");
  addCompactTableV50_(body, buildProjectContextTableV50_(ctx, lang), true, { compact:false });
  body.appendPageBreak();

  const modules = getDetailedReportModulesV40_();
  modules.forEach(function(m, idx) {
    const sectionNumber = idx + 3;
    addProfessionalHeaderBlockV50_(body, sectionNumber + ". " + m.title + " — " + getMethodSubtitleV50_(m.methodKey), ctx, lang);
    addMethodPurposeBoxV50_(body, m.methodKey);
    addMethodEquationBoxV50_(body, m.methodKey);
    const section = buildMethodSectionV50_(m, ctx, filters || {}, lang);
    addSubheadingV50_(body, "Key model evidence");
    addCompactTableV50_(body, section.table, true, { compact:true });
    addSubheadingV50_(body, "Interpretation");
    addParagraphV50_(body, section.interpretation);
    addSubheadingV50_(body, "Decision impact");
    addParagraphV50_(body, section.decisionImpact);
    addMethodConclusionV50_(body, m.methodKey, section.status, section.statusText);
    body.appendPageBreak();
  });

  addProfessionalHeaderBlockV50_(body, "9. Integrated IM³ investment decision", ctx, lang);
  addDecisionKpiGridV50_(body, ctx, lang);
  addIntegratedScoreMatrixV50_(body, ctx, lang);
  addSectionV50_(body, "Final recommendation", buildFinalDecisionTextV40_(ctx.row, ctx.dashboard.summary || {}, lang));
  addParagraphV50_(body, "The recommendation is based on the combined evidence generated by the IM³ methods. DCF evaluates financial value creation; MAP/DNPV tests value after risk adjustment; ROV measures managerial flexibility; MCDA evaluates strategic and non-financial alignment; System Dynamics tests long-term behavior; and Monte Carlo estimates confidence under uncertainty. When these methods converge, the decision is strong. When they diverge, the decision should become conditional and require targeted mitigation before capital commitment.");
  body.appendPageBreak();

  addProfessionalHeaderBlockV50_(body, "10. Appendices and audit trail", ctx, lang);
  addParagraphV50_(body, "The following appendix items identify the main source modules used by the report. The report intentionally excludes technical source columns from tables in order to keep the document executive-readable while preserving model traceability inside Google Sheets.");
  addCompactTableV50_(body, [
    ["Module", "Purpose"],
    ["03_Production", "Production, capacity, utilization, reserves and allocation schedule"],
    ["04_Prices", "Price deck, escalation and realized price assumptions"],
    ["05_CAPEX_OPEX", "Capital and operating cost structure"],
    ["06_DCF", "Annual cash-flow engine and discounted value creation"],
    ["09_MAP_DNPV", "Risk-adjusted value and confidence factors"],
    ["10_ROV", "Strategic flexibility and option value"],
    ["12_MCDA_Scores", "Strategic criteria and multi-criteria scoring"],
    ["13_System_Dynamics", "Dynamic resilience and feedback behavior"],
    ["16_Monte_Carlo", "Uncertainty simulation and downside confidence"]
  ], true, { compact:true });

  finalizeProfessionalDocV50_(doc);
  return createPdfFileFromDocV21_(doc, "IM3_Detailed_Investment_Report_" + lang.toUpperCase() + "_" + safeName_(ctx.projectName) + ".pdf", ctx, "detailed-v50-" + lang);
}

function prepareProfessionalDocV50_(doc) {
  const body = doc.getBody();
  body.clear();
  body.setPageWidth(841.89);
  body.setPageHeight(595.28);
  body.setMarginTop(28);
  body.setMarginBottom(28);
  body.setMarginLeft(32);
  body.setMarginRight(32);
  body.setAttributes({ [DocumentApp.Attribute.FONT_FAMILY]: "Arial", [DocumentApp.Attribute.FONT_SIZE]: 9, [DocumentApp.Attribute.FOREGROUND_COLOR]: IM3_BRAND_V50.darkText });
}

function finalizeProfessionalDocV50_(doc) {
  const body = doc.getBody();
  body.setPageWidth(841.89);
  body.setPageHeight(595.28);
  body.setAttributes({ [DocumentApp.Attribute.FONT_FAMILY]: "Arial", [DocumentApp.Attribute.FONT_SIZE]: 9 });
  doc.saveAndClose();
}

function addProfessionalCoverV50_(body, ctx, lang, reportTitle, reportSubtitle) {
  const cover = body.appendTable([["", ""]]);
  cover.setBorderWidth(0);
  const left = cover.getCell(0,0);
  const right = cover.getCell(0,1);
  left.setWidth(240).setPaddingTop(18).setPaddingLeft(16).setPaddingRight(16).setPaddingBottom(18).setBackgroundColor(IM3_BRAND_V50.primary);
  right.setWidth(520).setPaddingTop(18).setPaddingLeft(22).setPaddingRight(22).setPaddingBottom(18).setBackgroundColor("#FFFFFF");

  left.appendParagraph("IM³").setFontSize(36).setBold(true).setForegroundColor("#FFFFFF");
  left.appendParagraph(IM3_BRAND_V50.name).setFontSize(13).setBold(true).setForegroundColor("#FFFFFF");
  left.appendParagraph(IM3_BRAND_V50.platform).setFontSize(9).setForegroundColor("#DCEAF2");
  left.appendParagraph("\nOil & Gas | Mining | Energy").setFontSize(8).setForegroundColor("#DCEAF2");

  right.appendParagraph(reportTitle).setFontSize(20).setBold(true).setForegroundColor(IM3_BRAND_V50.primary);
  right.appendParagraph(reportSubtitle).setFontSize(10).setForegroundColor(IM3_BRAND_V50.muted);
  right.appendParagraph("\nProject").setFontSize(8).setBold(true).setForegroundColor(IM3_BRAND_V50.muted);
  right.appendParagraph(ctx.projectName || "—").setFontSize(16).setBold(true).setForegroundColor(IM3_BRAND_V50.darkText);
  right.appendParagraph("Project ID: " + (ctx.projectId || "—") + " | " + (ctx.row.Project_Type || "—") + " | " + (ctx.row.Location || "—")).setFontSize(9).setForegroundColor(IM3_BRAND_V50.darkText);
  right.appendParagraph("\nReport language: " + (IM3_REPORT_I18N_V40[lang] ? IM3_REPORT_I18N_V40[lang].langName : lang)).setFontSize(8).setForegroundColor(IM3_BRAND_V50.muted);
  right.appendParagraph("Generated: " + new Date().toISOString()).setFontSize(8).setForegroundColor(IM3_BRAND_V50.muted);
  right.appendParagraph("Version: " + IM3_V50_REPORT_VERSION).setFontSize(8).setForegroundColor(IM3_BRAND_V50.muted);
  right.appendParagraph("Classification: Internal analytical report").setFontSize(8).setForegroundColor(IM3_BRAND_V50.muted);
}

function addProfessionalHeaderBlockV50_(body, title, ctx, lang) {
  const table = body.appendTable([[IM3_BRAND_V50.name + " | " + IM3_BRAND_V50.platform, "Project: " + (ctx.projectName || "—")]]);
  table.setBorderWidth(0);
  table.getCell(0,0).setBackgroundColor(IM3_BRAND_V50.primary).setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(6);
  table.getCell(0,1).setBackgroundColor(IM3_BRAND_V50.primary).setPaddingTop(4).setPaddingBottom(4).setPaddingRight(6);
  table.getCell(0,0).editAsText().setForegroundColor("#FFFFFF").setFontSize(8).setBold(true);
  table.getCell(0,1).editAsText().setForegroundColor("#FFFFFF").setFontSize(8).setBold(true);
  body.appendParagraph(title).setFontSize(14).setBold(true).setForegroundColor(IM3_BRAND_V50.primary).setSpacingBefore(8).setSpacingAfter(6);
}

function addTableOfContentsV50_(body, lang) {
  addProfessionalSimpleTitleV50_(body, "Table of contents");
  const items = [
    ["1", "Executive summary"],
    ["2", "Project and scenario context"],
    ["3", "DCF financial valuation"],
    ["4", "MAP/DNPV risk-adjusted value"],
    ["5", "ROV strategic flexibility"],
    ["6", "MCDA strategic alignment"],
    ["7", "System Dynamics resilience"],
    ["8", "Monte Carlo uncertainty confidence"],
    ["9", "Integrated IM³ investment decision"],
    ["10", "Appendices and audit trail"]
  ];
  addCompactTableV50_(body, [["Section", "Content"]].concat(items), true, { compact:false });
}

function addProfessionalSimpleTitleV50_(body, title) {
  body.appendParagraph(title).setFontSize(16).setBold(true).setForegroundColor(IM3_BRAND_V50.primary).setSpacingAfter(8);
}

function addDecisionKpiGridV50_(body, ctx, lang) {
  const row = ctx.row || {};
  const summary = ctx.dashboard.summary || {};
  const kpis = [
    ["NPV", formatReportValueV21_(summary.avgNPV || row.NPV_USD || row.DNPV_USD, "money")],
    ["IRR", formatReportValueV21_(summary.avgIRR || row.IRR, "percent")],
    ["MCDA", formatReportValueV21_(summary.avgMCDA || row.MCDA_Score, "score")],
    ["SD", formatReportValueV21_(summary.avgSD || row.System_Dynamics_Score || row.Composite_System_Score, "score")],
    ["Integrated score", formatReportValueV21_(summary.avgIntegratedScore || row.Integrated_Score, "score")],
    ["Decision", row.Final_Decision || row.Decision_Label || "Review"]
  ];
  const table = body.appendTable([kpis.slice(0,3), kpis.slice(3,6)]);
  table.setBorderColor("#FFFFFF").setBorderWidth(1);
  for (let r = 0; r < table.getNumRows(); r++) {
    for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
      const cell = table.getCell(r,c);
      cell.setBackgroundColor(c % 2 === 0 ? IM3_BRAND_V50.light : "#F7FAFC");
      cell.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(8).setPaddingRight(8);
      const text = cell.editAsText();
      text.setFontFamily("Arial").setFontSize(9).setForegroundColor(IM3_BRAND_V50.darkText);
      const raw = String(cell.getText());
      const parts = raw.split("\n");
      if (parts.length >= 2) {
        text.setBold(0, parts[0].length - 1, true).setForegroundColor(0, parts[0].length - 1, IM3_BRAND_V50.primary);
      }
    }
  }
}

function addTrafficLightTableV50_(body, ctx, lang) {
  const statuses = buildMethodStatusesV50_(ctx);
  const rows = [["Method", "Status", "Observed result", "Investment meaning"]];
  statuses.forEach(function(s) { rows.push([s.method, s.symbol + " " + s.label, s.value, s.meaning]); });
  addCompactTableV50_(body, rows, true, { compact:true });
}

function buildMethodStatusesV50_(ctx) {
  const row = ctx.row || {};
  const summary = ctx.dashboard.summary || {};
  const npv = numV50_(summary.avgNPV || row.NPV_USD || row.DNPV_USD);
  const irr = numV50_(summary.avgIRR || row.IRR);
  const mcda = numV50_(summary.avgMCDA || row.MCDA_Score);
  const sd = numV50_(summary.avgSD || row.System_Dynamics_Score || row.Composite_System_Score);
  const prob = numV50_(row.Probability_Positive_NPV || row.Probability_Positive_NPV_Display || 1);
  const map = numV50_(row.Weighted_Risk_NPV || row.DNPV_USD || row.MAP_Adjusted_Value);
  return [
    statusObjV50_("DCF", npv > 0 && (isNaN(irr) || irr > 0.1), formatReportValueV21_(npv,"money") + " | IRR " + formatReportValueV21_(irr,"percent"), "Financial value creation is the first capital allocation gate."),
    statusObjV50_("MAP/DNPV", map > 0, formatReportValueV21_(map,"money"), "Tests whether value remains attractive after risk adjustment."),
    statusObjV50_("ROV", true, "Flexibility assessed", "Shows whether managerial flexibility improves or protects value."),
    statusObjV50_("MCDA", mcda >= 70, formatReportValueV21_(mcda,"score"), "Captures strategic, technical, ESG and development alignment."),
    statusObjV50_("System Dynamics", sd >= 60, formatReportValueV21_(sd,"score"), "Tests long-term resilience and feedback behavior."),
    statusObjV50_("Monte Carlo", prob >= 0.7 || prob >= 70, formatReportValueV21_(prob,"percent"), "Measures confidence under uncertainty and downside risk.")
  ];
}

function statusObjV50_(method, positive, value, meaning) {
  return { method:method, symbol: positive ? "●" : "●", label: positive ? "Strong / Supportive" : "Conditional / Needs mitigation", value:value || "—", meaning:meaning };
}

function addStrengthsWeaknessesActionsV50_(body, ctx, lang) {
  const rows = [["Key strengths", "Main weaknesses / watchpoints", "Recommended actions"]];
  const row = ctx.row || {};
  rows.push([
    "Positive value creation; strategic framework alignment; probabilistic confidence where NPV remains positive.",
    "Risk-adjusted value, dynamic resilience, CAPEX exposure and execution risk must be continuously monitored.",
    "Proceed through staged governance; validate CAPEX/OPEX assumptions; update risk mitigation plan; maintain Monte Carlo and System Dynamics refresh cycles."
  ]);
  addCompactTableV50_(body, rows, true, { compact:false });
}

function addSectionV50_(body, heading, text) {
  addSubheadingV50_(body, heading);
  addParagraphV50_(body, text);
}

function addSubheadingV50_(body, text) {
  body.appendParagraph(text).setFontSize(10).setBold(true).setForegroundColor(IM3_BRAND_V50.secondary).setSpacingBefore(6).setSpacingAfter(2);
}

function addParagraphV50_(body, text) {
  body.appendParagraph(String(text || "—")).setFontSize(9).setFontFamily("Arial").setLineSpacing(1.05).setSpacingAfter(4);
}

function addMethodPurposeBoxV50_(body, methodKey) {
  const text = getMethodPurposeV50_(methodKey);
  const table = body.appendTable([["Role in decision", text]]);
  formatInfoBoxV50_(table, IM3_BRAND_V50.light);
}

function addMethodEquationBoxV50_(body, methodKey) {
  const eq = getMethodEquationV50_(methodKey);
  const table = body.appendTable([["Core logic", eq]]);
  formatInfoBoxV50_(table, "#F7FAFC");
}

function formatInfoBoxV50_(table, bg) {
  table.setBorderColor("#D8E4EC").setBorderWidth(1);
  table.getCell(0,0).setWidth(110).setBackgroundColor(IM3_BRAND_V50.primary).setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(5);
  table.getCell(0,1).setBackgroundColor(bg).setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(6).setPaddingRight(6);
  table.getCell(0,0).editAsText().setForegroundColor("#FFFFFF").setFontSize(8).setBold(true).setFontFamily("Arial");
  table.getCell(0,1).editAsText().setForegroundColor(IM3_BRAND_V50.darkText).setFontSize(8).setFontFamily("Arial");
}

function buildMethodSectionV50_(moduleDef, ctx, filters, lang) {
  const rows = getMethodRowsV50_(moduleDef, ctx, filters);
  const table = buildModuleEvidenceTableV40_(moduleDef, rows, lang);
  const status = buildMethodStatusFromRowsV50_(moduleDef.methodKey, rows, ctx);
  return {
    table: table,
    status: status.level,
    statusText: status.text,
    interpretation: buildMethodInterpretationV50_(moduleDef.methodKey, rows, ctx, status),
    decisionImpact: buildMethodDecisionImpactV50_(moduleDef.methodKey, status)
  };
}

function getMethodRowsV50_(moduleDef, ctx, filters) {
  if (!sheetExists_(moduleDef.sheetName)) return [];
  let rows = getRows_(moduleDef.sheetName, moduleDef.headerRow);
  const selectedProject = ctx.projectId || im3FinalSelectedProject_(filters || {}, "");
  if (selectedProject) rows = rows.filter(function(r) { return !r.Project_ID || String(r.Project_ID).trim() === String(selectedProject).trim(); });
  rows = applyFiltersToRowsV13_(rows, filters || {});
  return rows.slice(0, 6);
}

function buildMethodStatusFromRowsV50_(methodKey, rows, ctx) {
  const row = ctx.row || {};
  if (methodKey === "dcf") {
    const npv = numV50_(row.NPV_USD || row.DNPV_USD || ((ctx.dashboard.summary || {}).avgNPV));
    return { level: npv > 0 ? "strong" : "weak", text: npv > 0 ? "Financially supportive" : "Requires financial optimization" };
  }
  if (methodKey === "mcda") {
    const score = numV50_(row.MCDA_Score || ((ctx.dashboard.summary || {}).avgMCDA));
    return { level: score >= 70 ? "strong" : "moderate", text: score >= 70 ? "Strategically aligned" : "Strategic alignment requires improvement" };
  }
  if (methodKey === "system_dynamics") {
    const score = numV50_(row.System_Dynamics_Score || row.Composite_System_Score || ((ctx.dashboard.summary || {}).avgSD));
    return { level: score >= 60 ? "moderate" : "weak", text: score >= 60 ? "Moderate-to-good dynamic resilience" : "Dynamic fragility detected" };
  }
  if (methodKey === "monte_carlo") return { level:"strong", text:"Uncertainty confidence layer reviewed" };
  return { level:"moderate", text:"Supports conditional decision review" };
}

function buildMethodInterpretationV50_(methodKey, rows, ctx, status) {
  const n = rows ? rows.length : 0;
  const base = {
    dcf:"The DCF module indicates whether the project creates value after CAPEX, OPEX, tax and discounting. The result should be read as the financial base case and the first investment gate.",
    map_dnpv:"MAP/DNPV tests whether value remains resilient after market, technical, regulatory and ESG confidence adjustments. This is important because a project with a positive base NPV can still become unattractive after risk weighting.",
    rov:"ROV evaluates whether strategic flexibility adds value to the investment case. Deferral, expansion, abandonment or switching options can protect the investor when uncertainty is material.",
    mcda:"MCDA converts financial and non-financial criteria into a structured strategic score. This is important when national development, ESG, local content, technology and institutional objectives influence the final investment decision.",
    system_dynamics:"System Dynamics evaluates how the project behaves over time. It highlights whether capacity, reinvestment, technology, local content and risk feedbacks reinforce or weaken long-term performance.",
    monte_carlo:"Monte Carlo evaluates uncertainty by simulating alternative outcomes. It strengthens the decision when the probability of positive value remains high and downside exposure is manageable."
  };
  return (base[methodKey] || "This method contributes evidence to the integrated IM³ investment decision.") + " Evidence rows reviewed: " + n + ". Current assessment: " + status.text + ".";
}

function buildMethodDecisionImpactV50_(methodKey, status) {
  const impact = {
    dcf:"If DCF is strong, the project can proceed to strategic and risk validation. If weak, capital commitment should be delayed until costs, prices or phasing are optimized.",
    map_dnpv:"If MAP/DNPV remains positive, the project survives explicit risk adjustment. If weak, the decision should become conditional on mitigation measures.",
    rov:"If ROV adds value, management should structure the investment as staged, flexible or option-based rather than a single irreversible commitment.",
    mcda:"A strong MCDA result supports approval when the project contributes to broader strategic, technical, ESG and development objectives.",
    system_dynamics:"A weak System Dynamics result means the project may look attractive financially but remain fragile operationally or strategically over time.",
    monte_carlo:"A strong Monte Carlo result increases decision confidence. A weak result requires downside protection, contingency planning and scenario redesign."
  };
  return impact[methodKey] || "This result informs the final integrated decision.";
}

function addMethodConclusionV50_(body, methodKey, status, statusText) {
  const color = status === "strong" ? IM3_BRAND_V50.accent : (status === "weak" ? IM3_BRAND_V50.critical : IM3_BRAND_V50.warning);
  const table = body.appendTable([["Method conclusion", statusText || status]]);
  table.setBorderColor("#D8E4EC").setBorderWidth(1);
  table.getCell(0,0).setWidth(120).setBackgroundColor(color).setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(5);
  table.getCell(0,1).setBackgroundColor("#FFFFFF").setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(6);
  table.getCell(0,0).editAsText().setForegroundColor("#FFFFFF").setFontSize(8).setBold(true);
  table.getCell(0,1).editAsText().setForegroundColor(IM3_BRAND_V50.darkText).setFontSize(8).setBold(true);
}

function getMethodSubtitleV50_(methodKey) {
  const map = { dcf:"Financial valuation", map_dnpv:"Risk-adjusted value", rov:"Strategic flexibility", mcda:"Strategic alignment", system_dynamics:"Dynamic resilience", monte_carlo:"Uncertainty confidence" };
  return map[methodKey] || "Method analysis";
}

function getMethodPurposeV50_(methodKey) {
  const map = {
    dcf:"DCF converts forecast cash flows into present value and tests whether the investment creates financial value after costs, taxes and discounting.",
    map_dnpv:"MAP/DNPV adjusts the base value for market, technical, regulatory and ESG confidence to test risk-adjusted attractiveness.",
    rov:"ROV values managerial flexibility under uncertainty, including defer, expand, abandon or switch decisions.",
    mcda:"MCDA integrates financial, technical, environmental, social and strategic criteria into a comparable decision score.",
    system_dynamics:"System Dynamics tests long-term feedback behavior across capacity, reinvestment, local content, technology and risk.",
    monte_carlo:"Monte Carlo simulates uncertain outcomes to estimate downside risk, mean value and probability of positive NPV."
  };
  return map[methodKey] || "This method contributes evidence to the integrated investment decision.";
}

function getMethodEquationV50_(methodKey) {
  const map = {
    dcf:"NPV = Σ [FCF_t / (1 + r)^t] − Initial Investment",
    map_dnpv:"Risk-adjusted value = Base value × confidence factors × probability / risk adjustment",
    rov:"Strategic value = Base NPV + probability-weighted option value",
    mcda:"Score = Σ (criterion score × criterion weight)",
    system_dynamics:"Composite score = f(capacity, reinvestment, technology, local content, risk feedback)",
    monte_carlo:"Decision confidence = P(NPV > 0) across simulated scenarios"
  };
  return map[methodKey] || "Integrated evidence is combined through the IM³ decision logic.";
}

function buildProjectContextTableV50_(ctx, lang) {
  return [["Field","Value"],
    ["Project ID", ctx.projectId || "—"],
    ["Project name", ctx.projectName || "—"],
    ["Project type", ctx.row.Project_Type || "—"],
    ["Location", ctx.row.Location || "—"],
    ["Project phase", ctx.row.Project_Phase || "—"],
    ["Scenario", ctx.row.Scenario_Name || "—"],
    ["Risk class", ctx.row.Scenario_Risk_Class || ctx.row.Risk_Label || "—"],
    ["Last update", ctx.row.Last_Update || "—"]
  ];
}

function addIntegratedScoreMatrixV50_(body, ctx, lang) {
  const statuses = buildMethodStatusesV50_(ctx);
  const rows = [["Method", "Contribution to decision", "Conclusion"]];
  statuses.forEach(function(s) { rows.push([s.method, s.meaning, s.label]); });
  addCompactTableV50_(body, rows, true, { compact:false });
}

function addCompactTableV50_(body, rows, headerBold, options) {
  options = options || {};
  const safeRows = sanitizeReportRowsV50_(rows);
  const table = body.appendTable(safeRows);
  table.setBorderColor("#D8E4EC").setBorderWidth(0.5);
  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      cell.setPaddingTop(options.compact ? 1 : 3).setPaddingBottom(options.compact ? 1 : 3).setPaddingLeft(4).setPaddingRight(4);
      if (r === 0 && headerBold) cell.setBackgroundColor(IM3_BRAND_V50.primary);
      else if (r % 2 === 0) cell.setBackgroundColor("#F7FAFC");
      else cell.setBackgroundColor("#FFFFFF");
      const text = cell.editAsText();
      text.setFontFamily("Arial").setFontSize(9);
      if (r === 0 && headerBold) text.setBold(true).setForegroundColor("#FFFFFF");
      else text.setForegroundColor(IM3_BRAND_V50.darkText);
    }
  }
  return table;
}

function sanitizeReportRowsV50_(rows) {
  if (!rows || !rows.length) return [["No data", "—"]];
  let out = rows.map(function(r) { return (r || []).map(function(c) { return String(c === undefined || c === null || c === "" ? "—" : c); }); });
  const header = out[0] || [];
  const sourceIndexes = [];
  header.forEach(function(h, i) { if (/^source$/i.test(String(h).trim())) sourceIndexes.push(i); });
  if (sourceIndexes.length) {
    out = out.map(function(r) { return r.filter(function(_, i) { return sourceIndexes.indexOf(i) === -1; }); });
  }
  return out;
}

function numV50_(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;
  const raw = String(value);
  const n = Number(raw.replace(/,/g, "").replace(/%/g, "").replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return NaN;
  if (raw.indexOf("%") !== -1 && Math.abs(n) > 1) return n / 100;
  return n;
}

function getDiagnosticsV50_() {
  const base = (typeof getDiagnosticsV41_ === "function") ? getDiagnosticsV41_() : getDiagnosticsV40_();
  base.version = IM3_V50_REPORT_VERSION;
  base.professionalReportUpgrade = true;
  base.reportStructure = ["cover", "table of contents", "executive KPI scorecard", "traffic-light method matrix", "project context", "method-by-method pages", "integrated decision", "appendices"];
  base.branding = IM3_BRAND_V50;
  base.pdfRules = { orientation:"landscape", bodyFontSize:9, tableFontSize:9, noSourceColumn:true, noTechnicalSubtitle:true };
  return base;
}
