const { useEffect, useMemo, useRef, useState } = React;

const IM3_LANGUAGES = [
  { value: "en", label: "🇬🇧 English" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "ru", label: "🇷🇺 Русский" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "es", label: "🇪🇸 Español" }
];

const IM3_NAV = [
  { id: "overview", label: "Overview", icon: "https://img.icons8.com/fluency-systems-regular/48/dashboard-layout.png" },
  { id: "input", label: "Data Input", icon: "https://img.icons8.com/fluency-systems-regular/48/edit-property.png" },
  { id: "analysis", label: "Analysis", icon: "https://img.icons8.com/fluency-systems-regular/48/combo-chart.png" },
  { id: "graphs", label: "Graph Studio", icon: "https://img.icons8.com/fluency-systems-regular/48/graph.png" },
  { id: "reports", label: "Reports", icon: "https://img.icons8.com/fluency-systems-regular/48/pdf.png" },
  { id: "admin", label: "Administration", icon: "https://img.icons8.com/fluency-systems-regular/48/settings.png" }
];

const IM3_ACTION_ICONS = {
  moon: "https://img.icons8.com/fluency-systems-regular/48/moon-symbol.png",
  sun: "https://img.icons8.com/fluency-systems-regular/48/sun.png",
  refresh: "https://img.icons8.com/fluency-systems-regular/48/refresh.png",
  render: "https://img.icons8.com/fluency-systems-regular/48/play.png"
};

const IM3_CHART_TYPES = [
  { value:"line", label:"Line" },
  { value:"smoothLine", label:"Smooth line" },
  { value:"area", label:"Area" },
  { value:"bar", label:"Bar" },
  { value:"stackedBar", label:"Stacked bar" },
  { value:"scatter", label:"Scatter" },
  { value:"radar", label:"Radar" }
];

const IM3_DEFAULT_SUMMARY_VIEWS = [
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

function normalizeError(error) {
  if (window.IM3Api?.normalizeError) return window.IM3Api.normalizeError(error);
  if (!error) return "Unknown error";
  return error.message || String(error);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getOptionValue(option) {
  if (option && typeof option === "object") return String(option.value ?? option.id ?? option.key ?? option.label ?? "");
  return String(option ?? "");
}

function getOptionLabel(option) {
  if (option && typeof option === "object") return String(option.label ?? option.name ?? option.title ?? option.value ?? "");
  return String(option ?? "");
}

function prettyLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\b(Npv|Irr|Dnpv|Mcda|Rov|Capex|Opex|Usd|Dcf|Sd|Fx|Esg|Api)\b/g, s => s.toUpperCase());
}

function numberFrom(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/,/g, "").replace(/%/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? NaN : n;
}

function statusTone(value) {
  const text = String(value || "").toLowerCase();
  if (/invest|proceed|strong|complete|ok|success|approve|accelerate/.test(text)) return "success";
  if (/review|defer|mitigation|condition|moderate|warning|stage/.test(text)) return "warning";
  if (/reject|stop|fail|error|redesign|weak|critical/.test(text)) return "danger";
  return "neutral";
}

function AppLegacy() {
  const [activePage, setActivePage] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState("");
  const [toast, setToast] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [dropdowns, setDropdowns] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryView, setSummaryView] = useState("production_summary");
  const [diagnostics, setDiagnostics] = useState(null);
  const [theme, setTheme] = useState("day");

  const modules = useMemo(() => asArray(metadata?.modules).filter(m => !m.readOnly && !["config"].includes(String(m.id))), [metadata]);
  const summaryViews = useMemo(() => asArray(metadata?.summaryViews).length ? metadata.summaryViews : IM3_DEFAULT_SUMMARY_VIEWS, [metadata]);
  const filters = useMemo(() => {
    const f = {};
    if (selectedProjectId) f.projectIds = [selectedProjectId];
    if (selectedScenarioId) f.scenarioIds = [selectedScenarioId];
    return f;
  }, [selectedProjectId, selectedScenarioId]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        setLoading(true);
        const api = window.IM3Api;
        if (!api) throw new Error("IM³ API service is not available. Check script loading order.");
        const [meta, loadedDropdowns, loadedFilters, loadedProjects] = await Promise.all([
          api.loadMetadata(),
          api.loadDropdowns().catch(() => ({})),
          api.loadFilterOptions().catch(() => ({})),
          api.loadProjects().catch(() => [])
        ]);
        if (!mounted) return;
        setMetadata(meta || {});
        setDropdowns(loadedDropdowns || meta?.dropdowns || {});
        setFilterOptions(loadedFilters || meta?.filters || {});
        const projectList = asArray(loadedProjects).length ? loadedProjects : asArray(loadedFilters?.projectIds).map(p => ({ Project_ID:getOptionValue(p), Project_Name:getOptionLabel(p) }));
        setProjects(projectList);
        const firstProject = projectList[0]?.Project_ID || projectList[0]?.value || "";
        if (firstProject) setSelectedProjectId(String(firstProject));
        setSetupError("");
      } catch (error) {
        setSetupError(normalizeError(error));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!metadata) return;
    refreshOutputs();
  }, [metadata, selectedProjectId, selectedScenarioId, summaryView]);

  async function refreshOutputs() {
    try {
      const [dash, sum] = await Promise.all([
        window.IM3Api.loadDashboard(filters, selectedProjectId).catch(err => ({ error: normalizeError(err), rows:[], summary:{} })),
        window.IM3Api.loadSummaryData(summaryView, filters, selectedProjectId).catch(err => ({ error: normalizeError(err), cards:[] }))
      ]);
      setDashboard(dash);
      setSummary(sum);
    } catch (error) {
      setToast({ type:"error", text: normalizeError(error) });
    }
  }

  async function refreshAll() {
    setToast({ type:"info", text:"Refreshing model outputs…" });
    await refreshOutputs();
    setToast({ type:"success", text:"Results updated." });
  }

  async function runDiagnostics() {
    try {
      setToast({ type:"info", text:"Running diagnostics…" });
      const result = await window.IM3Api.runDiagnostics();
      setDiagnostics(result);
      setToast({ type:"success", text:"Diagnostics completed." });
    } catch (error) {
      setToast({ type:"error", text: normalizeError(error) });
    }
  }

  function notify(type, text) {
    setToast({ type, text });
    window.clearTimeout(window.__im3ReactToastTimer);
    window.__im3ReactToastTimer = window.setTimeout(() => setToast(null), 5000);
  }

  if (loading) return <LoadingState text="Loading IM³ model data…" />;
  if (setupError) return <SetupError message={setupError} />;

  const selectedProject = projects.find(p => String(p.Project_ID || p.value) === String(selectedProjectId)) || {};

  return (
    <div className="im3rx-app" data-theme={theme}>
      <AppShell
        activePage={activePage}
        setActivePage={setActivePage}
        theme={theme}
        setTheme={setTheme}
        metadata={metadata}
        selectedProject={selectedProject}
        onRefresh={refreshAll}
      >
        <Header
          activePage={activePage}
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          scenarios={filterOptions.scenarioIds || []}
          selectedScenarioId={selectedScenarioId}
          setSelectedScenarioId={setSelectedScenarioId}
          dashboard={dashboard}
          onRefresh={refreshAll}
        />

        {activePage === "overview" && <OverviewPage dashboard={dashboard} summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView} diagnostics={diagnostics} onDiagnostics={runDiagnostics} />}
        {activePage === "input" && <DataInputPage modules={modules} dropdowns={dropdowns} filterOptions={filterOptions} selectedProjectId={selectedProjectId} onSaved={refreshAll} notify={notify} />}
        {activePage === "analysis" && <AnalysisPage dashboard={dashboard} summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView} filters={filters} selectedProjectId={selectedProjectId} />}
        {activePage === "graphs" && <GraphStudioPage metadata={metadata} projects={projects} selectedProjectId={selectedProjectId} filters={filters} notify={notify} />}
        {activePage === "reports" && <ReportsPage selectedProjectId={selectedProjectId} filters={filters} notify={notify} />}
        {activePage === "admin" && <AdministrationPage metadata={metadata} diagnostics={diagnostics} onDiagnostics={runDiagnostics} notify={notify} />}
      </AppShell>
      {toast && <Toast type={toast.type} text={toast.text} onClose={() => setToast(null)} />}
    </div>
  );
}

function AppShellLegacy({ activePage, setActivePage, theme, setTheme, metadata, selectedProject, onRefresh, children }) {
  return (
    <div className="im3rx-shell">
      <aside className="im3rx-sidebar">
        <div className="im3rx-brand">
          <div className="im3rx-logo">IM3</div>
          <div>
            <strong>IM3 Framework</strong>
            <span>Investment Decision Platform</span>
          </div>
        </div>
        <div className="im3rx-top-actions">
          <button className="im3rx-theme" onClick={() => setTheme(theme === "day" ? "night" : "day")}>
            <img src={theme === "day" ? IM3_ACTION_ICONS.moon : IM3_ACTION_ICONS.sun} alt="" />
            <span>{theme === "day" ? "Night mode" : "Day mode"}</span>
          </button>
          <button className="im3rx-sidebar-refresh" onClick={onRefresh}>
            <img src={IM3_ACTION_ICONS.refresh} alt="" />
            <span>Refresh</span>
          </button>
        </div>
        <nav className="im3rx-nav">
          {IM3_NAV.map(item => (
            <button key={item.id} className={activePage === item.id ? "active" : ""} onClick={() => setActivePage(item.id)}>
              <i><img src={item.icon} alt="" /></i><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="im3rx-sidebar-card">
          <span>Active project</span>
          <strong>{selectedProject.Project_Name || selectedProject.label || selectedProject.Project_ID || "No project selected"}</strong>
          <small>{metadata?.version || "Version unavailable"}</small>
        </div>
      </aside>
      <main className="im3rx-main">{children}</main>
    </div>
  );
}

function HeaderLegacy({ activePage, projects, selectedProjectId, setSelectedProjectId, scenarios, selectedScenarioId, setSelectedScenarioId, dashboard, onRefresh }) {
  const title = IM3_NAV.find(n => n.id === activePage)?.label || "Overview";
  const lastUpdate = dashboard?.first?.Last_Update || dashboard?.rows?.[0]?.Last_Update || "Live model";
  return (
    <section className="im3rx-header">
      <div>
        <p>Google Sheets + Apps Script Engine</p>
        <h1>{title}</h1>
        <span>Last update: {lastUpdate}</span>
      </div>
      <div className="im3rx-header-controls">
        <label><span>Project</span><select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p, idx) => <option key={idx} value={p.Project_ID || p.value}>{p.Project_Name || p.label || p.Project_ID || p.value}</option>)}
        </select></label>
        <label><span>Scenario</span><select value={selectedScenarioId} onChange={e => setSelectedScenarioId(e.target.value)}>
          <option value="">All scenarios</option>
          {asArray(scenarios).map((s, idx) => <option key={idx} value={getOptionValue(s)}>{getOptionLabel(s)}</option>)}
        </select></label>
        <button onClick={onRefresh}>Reload</button>
      </div>
    </section>
  );
}

function OverviewPageLegacy({ dashboard, summary, summaryViews, summaryView, setSummaryView, diagnostics, onDiagnostics }) {
  const dashSummary = dashboard?.summary || {};
  const first = dashboard?.first || dashboard?.rows?.[0] || {};
  const decision = first.Final_Decision || first.Decision_Label || first.Recommendation || "Review";
  return (
    <>
      <section className="im3rx-grid im3rx-kpis">
        <KpiCard label="Rows" value={dashSummary.count ?? dashboard?.rows?.length ?? 0} hint="Selected output rows" />
        <KpiCard label="Average NPV" value={window.IM3Api.formatCurrency(dashSummary.avgNPV ?? first.NPV_USD ?? first.NPV_Display)} hint="Filtered average" />
        <KpiCard label="Average IRR" value={window.IM3Api.formatPercent(dashSummary.avgIRR ?? first.IRR ?? first.IRR_Display)} hint="Return indicator" />
        <KpiCard label="MCDA" value={window.IM3Api.formatNumber(dashSummary.avgMCDA ?? first.MCDA_Score ?? first.MCDA_Display)} hint="Strategic score" />
        <KpiCard label="System Dynamics" value={window.IM3Api.formatNumber(dashSummary.avgSD ?? first.System_Dynamics_Score ?? first.SD_Display)} hint="Dynamic resilience" />
        <KpiCard label="Integrated Score" value={window.IM3Api.formatNumber(dashSummary.avgIntegratedScore ?? first.Integrated_Score)} hint="Final composite score" />
        <KpiCard label="Best Project" value={dashSummary.bestProject?.Project_Name || first.Project_Name || "—"} hint="By integrated score" />
        <KpiCard label="Decision" value={decision} hint={first.Risk_Label || first.Scenario_Risk_Class || "Decision state"} tone={statusTone(decision)} />
      </section>
      <section className="im3rx-two-col">
        <DataQualityPanel diagnostics={diagnostics} dashboard={dashboard} onDiagnostics={onDiagnostics} />
        <SummaryViewer summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView} />
      </section>
    </>
  );
}

function KpiCardLegacy({ label, value, hint, tone = "neutral" }) {
  return (
    <article className={`im3rx-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === "" ? "—" : value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function DataQualityPanelLegacy({ diagnostics, dashboard, onDiagnostics }) {
  const missingSheets = asArray(diagnostics?.missingSheets);
  const rows = dashboard?.rows || [];
  const hasProject = rows.length > 0;
  const warnings = [];
  if (!hasProject) warnings.push("No dashboard rows returned for the current selection.");
  if (missingSheets.length) warnings.push(`${missingSheets.length} workbook sheet(s) reported missing.`);
  if (!diagnostics) warnings.push("Run diagnostics to validate formulas and module availability.");
  const score = Math.max(0, 100 - warnings.length * 18 - missingSheets.length * 4);
  return (
    <section className="im3rx-card">
      <div className="im3rx-card-head"><div><p>Data Quality</p><h2>{score}%</h2></div><button onClick={onDiagnostics}>Run diagnostics</button></div>
      <ul className="im3rx-checks">
        <li className={hasProject ? "ok" : "warn"}>Project validated</li>
        <li className={missingSheets.length ? "warn" : "ok"}>Workbook modules available</li>
        <li className="ok">Dropdown values loaded from Google Sheets</li>
        <li className={diagnostics ? "ok" : "warn"}>Diagnostics available</li>
      </ul>
      {warnings.length ? <div className="im3rx-warning-list">{warnings.map((w, i) => <span key={i}>{w}</span>)}</div> : <p className="im3rx-muted">No critical data quality warnings found.</p>}
    </section>
  );
}

function SummaryViewerLegacy({ summary, summaryViews, summaryView, setSummaryView }) {
  const cards = asArray(summary?.cards);
  return (
    <section className="im3rx-card">
      <div className="im3rx-card-head"><div><p>Result Viewer</p><h2>{summary?.title || "Selected output"}</h2></div>
        <select value={summaryView} onChange={e => setSummaryView(e.target.value)}>{summaryViews.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}</select>
      </div>
      {summary?.error && <ErrorBanner message={summary.error} />}
      {!cards.length && !summary?.error && <EmptyState title="No summary cards" text="Select another result module or verify the Google Sheets output blocks." />}
      <div className="im3rx-mini-grid">
        {cards.map((c, idx) => <KpiCard key={idx} label={c.label} value={formatSummaryValue(c)} hint={c.source || summary?.sourceRange || "Google Sheets"} />)}
      </div>
    </section>
  );
}

function formatSummaryValue(card) {
  const fmt = String(card.format || "").toLowerCase();
  if (/money|usd/.test(fmt) || /usd|npv|capex|opex|revenue|cost|cash|price/i.test(card.label)) return window.IM3Api.formatCurrency(card.value);
  if (/percent|rate|probability|utilization|uptime|index/.test(fmt) || /%|rate|probability|utilization|uptime/i.test(card.label)) return window.IM3Api.formatPercent(card.value);
  return window.IM3Api.formatNumber(card.value);
}

function DataInputPage({ modules, dropdowns, filterOptions, selectedProjectId, onSaved, notify }) {
  const [moduleId, setModuleId] = useState(modules[0]?.id || "projects");
  const [moduleData, setModuleData] = useState(null);
  const [recordKey, setRecordKey] = useState("__new__");
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState({ errors:[], warnings:[] });

  const moduleMeta = moduleData?.module || modules.find(m => m.id === moduleId) || {};
  const headers = asArray(moduleData?.headers).filter(h => h && !String(h).startsWith("__"));
  const rows = asArray(moduleData?.rows);

  useEffect(() => {
    if (modules.length && !modules.some(m => m.id === moduleId)) setModuleId(modules[0].id);
  }, [modules]);

  useEffect(() => { loadModule(); }, [moduleId, selectedProjectId]);

  async function loadModule(key = "") {
    try {
      setLoading(true);
      const filters = selectedProjectId ? { projectIds:[selectedProjectId] } : {};
      const data = await window.IM3Api.loadModule(moduleId, filters, key && key !== "__new__" ? key : "");
      setModuleData(data);
      const selected = key === "__new__" ? {} : (data.selected || data.rows?.[0] || {});
      if (selectedProjectId && (data.module?.editableFields || []).includes("Project_ID")) selected.Project_ID = selected.Project_ID || selectedProjectId;
      setForm(selected);
      setRecordKey(key || (data.module?.readOnly ? "" : "__new__"));
      setValidation({ errors:[], warnings:[] });
    } catch (error) {
      notify("error", normalizeError(error));
    } finally {
      setLoading(false);
    }
  }

  function editableFields() {
    return new Set(asArray(moduleMeta.editableFields));
  }

  function isEditable(key) {
    if (moduleMeta.readOnly) return false;
    if (key === moduleMeta.keyColumn || key === "__rowNumber") return false;
    return editableFields().has(key) && !window.IM3Api.isOutputLikeKey(key);
  }

  function collectPayload() {
    const payload = {};
    editableFields().forEach(key => {
      if (Object.prototype.hasOwnProperty.call(form, key)) payload[key] = form[key];
    });
    return payload;
  }

  function validate() {
    const errors = [];
    const warnings = [];
    const payload = collectPayload();
    if (!moduleMeta.id) errors.push("No active module selected.");
    if (moduleMeta.readOnly) errors.push("This module is read-only.");
    if (moduleMeta.id === "projects" && !String(payload.Project_Name || "").trim()) errors.push("Project name is required.");
    if (["assumptions","production","prices","capex_opex","mcda_scores"].includes(moduleMeta.id) && !String(payload.Project_ID || "").trim()) errors.push("Project_ID is required.");
    if (["production","prices","capex_opex","risk_scenarios","map_dnpv","rov","mcda_scores","system_dynamics","sd_parameters","sensitivity","monte_carlo"].includes(moduleMeta.id) && !String(payload.Assumption_Set_ID || "").trim()) errors.push("Assumption_Set_ID is required.");
    if (asArray(moduleMeta.editableFields).includes("Year") && !String(payload.Year || "").trim()) errors.push("Year is required.");
    Object.entries(payload).forEach(([key, value]) => {
      if (!value) return;
      if (/^(Year|Base_Year|Start_Year|End_Year|Exercise_Year)$/i.test(key) && !/^\d{4}$/.test(String(value))) errors.push(`${prettyLabel(key)} must be a four-digit year.`);
      if (/(Rate|Factor|Probability|Utilization|Uptime|Multiplier|Score|Amount|Quantity|Cost|Price|USD|CAPEX|OPEX|NPV|IRR|DNPV|Revenue|Tax|Production|Volume|Capacity|Reserve|Weight|Min|Max|Shock|Volatility|Rank|Index|Years?|%)/i.test(key)) {
        const n = numberFrom(value);
        if (Number.isNaN(n)) errors.push(`${prettyLabel(key)} must be numeric.`);
      }
    });
    const result = { errors, warnings };
    setValidation(result);
    return result;
  }

  async function save() {
    const result = validate();
    if (result.errors.length) {
      notify("error", "Save blocked: " + result.errors.join(" | "));
      return;
    }
    try {
      setSaving(true);
      setValidation({ errors:[], warnings:["Saving to Google Sheets..."] });
      const key = recordKey && recordKey !== "__new__" ? recordKey : "";
      const saved = await window.IM3Api.manualSave(moduleMeta.id, collectPayload(), key);
      notify("success", "Results updated.");
      await loadModule(saved.keyValue || key);
      await onSaved();
    } catch (error) {
      notify("error", normalizeError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="im3rx-card">
      <div className="im3rx-card-head">
        <div><p>Data Input</p><h2>{moduleMeta.title || prettyLabel(moduleId)}</h2><small>{moduleMeta.description || "Manual input and protected calculated fields."}</small></div>
        <div className="im3rx-actions"><select value={moduleId} onChange={e => setModuleId(e.target.value)}>{modules.map(m => <option key={m.id} value={m.id}>{m.title || prettyLabel(m.id)}</option>)}</select>
        <select value={recordKey} onChange={e => loadModule(e.target.value)}><option value="__new__">Create new record</option>{rows.map((r, idx) => <option key={idx} value={r[moduleMeta.keyColumn] || idx}>{r.Project_Name || r.Scenario_Name || r.Parameter_Name || r[moduleMeta.keyColumn] || `Row ${idx+1}`}</option>)}</select></div>
      </div>
      {loading ? <LoadingState text="Loading module…" compact /> : <>
        <div className="im3rx-form-grid">
          {headers.map(key => <FieldRenderer key={key} fieldKey={key} value={form[key] ?? ""} editable={isEditable(key)} moduleMeta={moduleMeta} moduleDropdowns={moduleData?.dropdowns || {}} dropdowns={dropdowns} filterOptions={filterOptions} onChange={value => setForm(prev => ({ ...prev, [key]: value }))} />)}
        </div>
        <div className="im3rx-validation">
          <strong>Validation status</strong>
          {validation.errors.length ? <span className="danger">{validation.errors.join(" | ")}</span> : <span>Manual inputs are validated before saving.</span>}
        </div>
        <div className="im3rx-actions bottom">
          <button onClick={validate} disabled={saving}>Validate model</button>
          <button className="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save manual input"}</button>
          <button onClick={() => loadModule(recordKey)}>Reload results</button>
        </div>
        <TablePreview rows={rows} />
      </>}
    </section>
  );
}

function FieldRenderer({ fieldKey, value, editable, moduleMeta, moduleDropdowns, dropdowns, filterOptions, onChange }) {
  const source = moduleMeta.dropdowns?.[fieldKey];
  const dropdownOptions = im3xDropdownOptions(fieldKey, source, moduleDropdowns, dropdowns, filterOptions);
  const required = (moduleMeta.id === "projects" && fieldKey === "Project_Name") || (["Project_ID", "Assumption_Set_ID", "Year"].includes(fieldKey) && asArray(moduleMeta.editableFields).includes(fieldKey));
  const className = `im3rx-field ${editable ? "editable" : "locked"} ${source ? "dropdown" : ""} ${required ? "required" : ""}`;
  return (
    <label className={className}>
      <span>{prettyLabel(fieldKey)} {required && <em>*</em>} {!editable && <small>Locked</small>}</span>
      {editable && dropdownOptions.length ? (
        <select value={value || ""} onChange={e => onChange(e.target.value)}><option value="">Select…</option>{dropdownOptions.map((opt, idx) => <option key={idx} value={getOptionValue(opt)}>{getOptionLabel(opt)}</option>)}</select>
      ) : editable ? (
        <input value={value || ""} type={/(Year|Rate|Factor|Probability|Amount|USD|Cost|Price|Quantity|Score|Index|Tax|NPV|IRR|CAPEX|OPEX)/i.test(fieldKey) ? "number" : "text"} onChange={e => onChange(e.target.value)} />
      ) : (
        <input value={value || ""} readOnly />
      )}
    </label>
  );
}

function TablePreview({ rows }) {
  const visible = asArray(rows).slice(0, 8);
  if (!visible.length) return <EmptyState title="No rows returned" text="This module has no rows for the current filter." />;
  const headers = Object.keys(visible[0]).filter(k => !k.startsWith("__")).slice(0, 8);
  return <div className="im3rx-table-wrap"><table><thead><tr>{headers.map(h => <th key={h}>{prettyLabel(h)}</th>)}</tr></thead><tbody>{visible.map((row, idx) => <tr key={idx}>{headers.map(h => <td key={h}>{String(row[h] ?? "—")}</td>)}</tr>)}</tbody></table></div>;
}

function AnalysisPageLegacy({ dashboard, summary, summaryViews, summaryView, setSummaryView }) {
  return <section className="im3rx-two-col"><SummaryViewer summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView} /><section className="im3rx-card"><div className="im3rx-card-head"><div><p>Dashboard Rows</p><h2>Filtered output</h2></div></div><TablePreview rows={dashboard?.rows || []} /></section></section>;
}

function GraphStudioPageLegacy({ metadata, projects, selectedProjectId, filters, notify }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const catalog = asArray(metadata?.chartMetricCatalog || metadata?.chartMetrics);
  const groups = useMemo(() => [...new Set(catalog.map(m => m.group || "General"))], [catalog]);
  const [group, setGroup] = useState(groups[0] || "Financial USD");
  const metricsInGroup = catalog.filter(m => (m.group || "General") === group);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState(selectedProjectId ? [selectedProjectId] : []);
  const [chartType, setChartType] = useState("line");
  const [status, setStatus] = useState("");
  const [chartProgress, setChartProgress] = useState(null);

  useEffect(() => { if (groups.length && !groups.includes(group)) setGroup(groups[0]); }, [groups.join("|")]);
  useEffect(() => { setSelectedMetrics(metricsInGroup[0] ? [metricsInGroup[0].metricId || metricsInGroup[0].value] : []); }, [group]);
  useEffect(() => { if (selectedProjectId) setSelectedProjects([selectedProjectId]); }, [selectedProjectId]);

  function toggleMetric(id) {
    setSelectedMetrics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleProject(id) {
    setSelectedProjects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function buildChart() {
    try {
      if (!selectedMetrics.length) throw new Error("Select at least one metric.");
      setChartProgress({ pct:8, text:"Preparing chart request" });
      setStatus("Loading time series...");
      const chartFilters = { ...filters };
      if (selectedProjects.length) chartFilters.projectIds = selectedProjects;
      setChartProgress({ pct:34, text:"Loading Google Sheets series" });
      const data = await window.IM3Api.loadTimeseries({ metrics:selectedMetrics, filters:chartFilters, groupBy:"Project_Name" });
      setChartProgress({ pct:68, text:"Normalizing chart datasets" });
      renderChart(data);
      setChartProgress({ pct:100, text:"Graph rendered" });
      setStatus(data.series?.length ? `Rendered ${data.series.length} metric(s). Y-axis unit: ${data.yUnit || "value"}` : "No series returned.");
    } catch (error) {
      setChartProgress({ pct:100, text:"Chart rendering failed", error:true });
      setStatus(normalizeError(error));
      notify("error", "Chart error: " + normalizeError(error));
    }
  }

  function renderChart(data) {
    if (!window.Chart || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const years = data.years || [];
    const rootStyles = window.getComputedStyle(document.querySelector(".im3rx-app") || document.documentElement);
    const textColor = rootStyles.getPropertyValue("--im3rx-text").trim() || "#132238";
    const borderColor = rootStyles.getPropertyValue("--im3rx-border").trim() || "#D7E0EA";
    const surface2 = rootStyles.getPropertyValue("--im3rx-surface-2").trim() || "#EEF3F7";
    const colors = ["#003B5C", "#1F78B4", "#0E8A4B", "#D86B21", "#C0392B", "#6C5CE7", "#00A8A8", "#9B59B6", "#4A6572", "#B88A00"];
    const datasets = [];
    asArray(data.series).forEach((series, metricIdx) => {
      const seriesNames = [...new Set(asArray(series.data).map(p => p.series || series.label))];
      seriesNames.forEach((name, idx) => {
        const color = colors[(metricIdx * 3 + idx) % colors.length];
        const points = years.map(year => {
          const found = asArray(series.data).find(p => String(p.year) === String(year) && String(p.series || series.label) === String(name));
          return found ? Number(found.value) : null;
        });
        datasets.push({
          label: `${series.label}${seriesNames.length > 1 ? " - " + name : ""}`,
          data: chartType === "scatter" ? years.map((year, i) => ({ x:Number(year), y:points[i] })) : points,
          borderColor: color,
          backgroundColor: chartType === "area" ? color + "33" : color,
          tension: chartType === "smoothLine" || chartType === "area" ? 0.36 : 0.12,
          fill: chartType === "area",
          borderWidth: chartType === "bar" || chartType === "stackedBar" ? 1.2 : 2,
          pointRadius: chartType === "bar" || chartType === "stackedBar" ? 0 : 3,
          pointHoverRadius: 5,
          borderRadius: chartType === "bar" || chartType === "stackedBar" ? 3 : 0
        });
      });
    });
    const finalType = chartType === "bar" || chartType === "stackedBar" ? "bar" : chartType === "scatter" ? "scatter" : chartType === "radar" ? "radar" : "line";
    const isStacked = chartType === "stackedBar";
    const cartesianScales = chartType === "radar" ? {} : {
      x:{ title:{ display:true, text:"Year", color:textColor }, ticks:{ color:textColor }, grid:{ color:borderColor }, stacked:isStacked },
      y:{ title:{ display:true, text:data.yUnit || "value", color:textColor }, ticks:{ color:textColor }, grid:{ color:borderColor }, stacked:isStacked, beginAtZero:chartType === "bar" || chartType === "stackedBar" }
    };
    chartRef.current = new Chart(canvasRef.current, {
      type:finalType,
      data:{ labels:years, datasets },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        interaction:{ mode:"nearest", intersect:false },
        plugins:{
          legend:{ position:"bottom", labels:{ color:textColor, usePointStyle:true, boxWidth:10, padding:14 } },
          tooltip:{ backgroundColor:textColor, titleColor:surface2, bodyColor:surface2 }
        },
        scales:cartesianScales
      }
    });
  }

  return (
    <section className="im3rx-card">
      <div className="im3rx-card-head"><div><p>Graph Studio</p><h2>Compatible multi-series comparison</h2><small>Select several metrics from the same group and compare one or many projects.</small></div><button className="primary" onClick={buildChart}><img src={IM3_ACTION_ICONS.render} alt="" /> Render graph</button></div>
      <div className="im3rx-graph-grid">
        <label><span>Indicator group</span><select value={group} onChange={e => setGroup(e.target.value)}>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
        <label><span>Chart type</span><select value={chartType} onChange={e => setChartType(e.target.value)}>{IM3_CHART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      </div>
      <div className="im3rx-picker"><strong>Compatible metrics</strong>{metricsInGroup.map(m => { const id = m.metricId || m.value; return <button key={id} className={selectedMetrics.includes(id) ? "active" : ""} onClick={() => toggleMetric(id)}>{m.label || prettyLabel(id)}<small>{m.fallbackUnit || m.unit || ""}</small></button>; })}</div>
      <div className="im3rx-picker"><strong>Projects</strong>{projects.map(p => { const id = p.Project_ID || p.value; return <button key={id} className={selectedProjects.includes(id) ? "active" : ""} onClick={() => toggleProject(id)}>{p.Project_Name || p.label || id}</button>; })}</div>
      {chartProgress && <div className={`im3rx-progress im3rx-chart-progress ${chartProgress.error ? "error" : ""}`}><div><strong>{chartProgress.text}</strong><span>{chartProgress.pct}%</span></div><i style={{ width:chartProgress.pct + "%" }}></i><small>Graph Studio rendering progress</small></div>}
      {status && <div className="im3rx-validation"><strong>Status</strong><span>{status}</span></div>}
      <div className="im3rx-chart-box"><canvas ref={canvasRef}></canvas></div>
    </section>
  );
}

function ReportsPageLegacy({ selectedProjectId, filters, notify }) {
  const [language, setLanguage] = useState("en");
  const [progress, setProgress] = useState(null);
  const [links, setLinks] = useState([]);

  async function generate(kind) {
    let timer;
    try {
      setLinks([]);
      const start = Date.now();
      setProgress({ pct:10, text:"Preparing report request…", elapsed:0, estimate:kind === "pack" ? 120 : 60 });
      timer = window.setInterval(() => {
        setProgress(prev => prev ? { ...prev, pct:Math.min(prev.pct + 7, 88), elapsed:Math.round((Date.now()-start)/1000) } : prev);
      }, 1000);
      const result = kind === "pack" ? await window.IM3Api.generateInvestmentPack(selectedProjectId, language, filters) : await window.IM3Api.generatePdf(kind, selectedProjectId, language, filters);
      window.clearInterval(timer);
      setProgress({ pct:100, text:"Report generated successfully.", elapsed:Math.round((Date.now()-start)/1000), estimate:0 });
      const extracted = extractReportLinks(result);
      setLinks(extracted);
      notify("success", "Report generated successfully.");
    } catch (error) {
      window.clearInterval(timer);
      setProgress({ pct:100, text:"Report generation failed: " + normalizeError(error), elapsed:0, estimate:0, error:true });
      notify("error", normalizeError(error));
    }
  }

  function clear() {
    setLinks([]);
    setProgress(null);
  }

  return (
    <section className="im3rx-card">
      <div className="im3rx-card-head"><div><p>Reports</p><h2>Investment Decision Pack</h2><small>Manual generation only. Select language and report type.</small></div><select value={language} onChange={e => setLanguage(e.target.value)}>{IM3_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
      <div className="im3rx-actions bottom"><button onClick={() => generate("executive")}>Executive Summary</button><button onClick={() => generate("technical")}>Technical Investment Report</button><button className="primary" onClick={() => generate("pack")}>Investment Decision Pack</button><button onClick={clear}>Clear reports</button></div>
      {progress && <div className={`im3rx-progress ${progress.error ? "error" : ""}`}><div><strong>{progress.text}</strong><span>{progress.pct}%</span></div><i style={{ width:progress.pct + "%" }}></i><small>Elapsed: {progress.elapsed || 0}s {progress.estimate ? `| Estimated: ${progress.estimate}s` : ""}</small></div>}
      <div className="im3rx-links">{links.map((link, idx) => <a key={idx} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div>
    </section>
  );
}

function extractReportLinks(result) {
  const links = [];
  if (!result) return links;
  if (result.pdfUrl) links.push({ label:result.title || result.reportType || "Open PDF", url:result.pdfUrl });
  if (result.executive?.pdfUrl) links.push({ label:"Executive Summary", url:result.executive.pdfUrl });
  if (result.technical?.pdfUrl) links.push({ label:"Technical Investment Report", url:result.technical.pdfUrl });
  if (result.appendices?.pdfUrl) links.push({ label:"Appendices", url:result.appendices.pdfUrl });
  asArray(result.files).forEach(f => { if (f.pdfUrl || f.url) links.push({ label:f.title || f.name || "Report file", url:f.pdfUrl || f.url }); });
  return links.length ? links : [{ label:"Report generated — open Drive file", url:result.url || result.fileUrl || "#" }].filter(l => l.url !== "#");
}

function AdministrationPage({ metadata, diagnostics, onDiagnostics, notify }) {
  async function clearCache() {
    try { await window.IM3Api.clearCache(); notify("success", "Cache cleared."); }
    catch (error) { notify("error", normalizeError(error)); }
  }
  return <section className="im3rx-card"><div className="im3rx-card-head"><div><p>Administration</p><h2>System status</h2><small>API version: {metadata?.version || "—"}</small></div><div className="im3rx-actions"><button onClick={onDiagnostics}>Diagnostics</button><button onClick={clearCache}>Clear cache</button></div></div>{diagnostics ? <pre className="im3rx-json">{JSON.stringify(diagnostics, null, 2)}</pre> : <EmptyState title="Diagnostics not loaded" text="Run diagnostics to inspect sheets, modules and endpoints." />}</section>;
}

function LoadingState({ text, compact, progress }) {
  const pct = Math.max(0, Math.min(100, Number(progress?.pct || 0)));
  return <div className={compact ? "im3rx-loading compact" : "im3rx-loading"}><div></div><strong>{progress?.text || text}</strong>{progress?.detail && <p>{progress.detail}</p>}{progress && <div className={`im3rx-load-meter ${progress?.error ? "error" : ""}`}><span style={{width:pct + "%"}}></span></div>}{progress && <small>{pct}%{progress?.elapsed !== undefined ? ` | elapsed ${progress.elapsed}s` : ""}{progress?.remaining ? ` | about ${progress.remaining}s left` : ""}</small>}{progress?.warning && <em>{progress.warning}</em>}</div>;
}

function SetupError({ message, progress }) {
  return <div className="im3rx-setup-error"><h2>IM³ setup error</h2><p>{message}</p>{progress && <div className="im3rx-progress error"><div><strong>{progress.text || "Loading failed"}</strong><span>{progress.pct || 100}%</span></div><i style={{width:(progress.pct || 100) + "%"}}></i>{progress.detail && <small>{progress.detail}</small>}</div>}<small>Check Apps Script deployment URL, access permissions and script loading order.</small></div>;
}

function EmptyState({ title, text }) {
  return <div className="im3rx-empty"><strong>{title}</strong><span>{text}</span></div>;
}

function ErrorBanner({ message }) {
  return <div className="im3rx-error">{message}</div>;
}

function Toast({ type, text, onClose }) {
  return <div className={`im3rx-toast ${type || "info"}`}><span>{text}</span><button onClick={onClose}>×</button></div>;
}

function im3xCleanLabel(value){return String(value??"").replace(/^\s*[A-Z]{2,12}-?\d{1,8}\s+[-:]+\s+/i,"").replace(/^\s*\d{1,3}\s*[_.,:;-]+\s*/g,"").replace(/\s*\([^)]*!\s*[A-Z]+\d+:[A-Z]+\d+\)\s*/gi,"").replace(/\s+/g," ").trim();}
function im3xDateTime(date){if(!date)return"Not loaded yet";return new Intl.DateTimeFormat(undefined,{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(date);}
function im3xIcon(label){const t=String(label||"").toLowerCase();if(/row|record/.test(t))return IM3_ACTION_ICONS.rows||"https://img.icons8.com/fluency-systems-regular/48/table.png";if(/npv|cash|revenue|cost|price|money/.test(t))return"https://img.icons8.com/fluency-systems-regular/48/money-bag.png";if(/irr|percent|probability|rate/.test(t))return"https://img.icons8.com/fluency-systems-regular/48/percentage.png";if(/mcda|strategic/.test(t))return"https://img.icons8.com/fluency-systems-regular/48/rating.png";if(/system|dynamic/.test(t))return"https://img.icons8.com/fluency-systems-regular/48/process.png";if(/score|rank/.test(t))return"https://img.icons8.com/fluency-systems-regular/48/leaderboard.png";if(/project/.test(t))return"https://img.icons8.com/fluency-systems-regular/48/project.png";if(/decision/.test(t))return"https://img.icons8.com/fluency-systems-regular/48/decision.png";return"https://img.icons8.com/fluency-systems-regular/48/report-card.png";}
function im3xOptionValue(o,key){return o&&typeof o==="object"?String(o[key]??o.value??o.id??o.key??o.label??""):String(o??"");}
function im3xOptionLabel(o,key){return im3xCleanLabel(o&&typeof o==="object"?String(o[key]??o.label??o.name??o.title??o.value??""):String(o??""));}
function im3xActivity(type,text,setLog){setLog(prev=>[{type:type||"info",text:String(text||""),time:new Date()},...prev].slice(0,40));}
function im3xWithTimeout(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=window.setTimeout(()=>reject(new Error(label||"Request timeout")),ms)})]).finally(()=>window.clearTimeout(timer));}
function im3xStripUnit(text){return im3xCleanLabel(String(text||"").replace(/\s*\[[^\]]+\]\s*$/,"").replace(/\s*\((USD|US\$|%|bbl|boe|mmbtu|mwh|mw|tons?|kt|mt|value|index|score|years?)\)\s*$/i,"").replace(/\s+(USD|US\$|%|bbl|boe|mmbtu|mwh|mw|tons?|kt|mt|value|index|score|years?)$/i,""));}
function im3xFirstList(){for(let i=0;i<arguments.length;i++){const v=arguments[i];if(Array.isArray(v)&&v.length)return v;}return[];}
function im3xDropdownOptions(fieldKey,source,moduleDropdowns,globalDropdowns,filterOptions){const local=moduleDropdowns||{},global=globalDropdowns||{},filters=filterOptions||{};if(Array.isArray(source))return source;if(source&&Array.isArray(local[source]))return local[source];if(source&&Array.isArray(global[source]))return global[source];if(Array.isArray(local[fieldKey]))return local[fieldKey];if(Array.isArray(global[fieldKey]))return global[fieldKey];const clean=String(fieldKey||"").replace(/_ID$/,"Ids").replace(/_Name$/,"Names");return im3xFirstList(filters[fieldKey],filters[clean],filters[fieldKey.charAt(0).toLowerCase()+fieldKey.slice(1)],local[source],global[source]);}
IM3_ACTION_ICONS.bell="https://img.icons8.com/fluency-systems-regular/48/appointment-reminders.png";
IM3_ACTION_ICONS.cancel="https://img.icons8.com/fluency-systems-regular/48/cancel.png";
IM3_ACTION_ICONS.download="https://img.icons8.com/fluency-systems-regular/48/download.png";
IM3_ACTION_ICONS.image="https://img.icons8.com/fluency-systems-regular/48/image.png";
IM3_ACTION_ICONS.report="https://img.icons8.com/fluency-systems-regular/48/report-card.png";

function App(){
 const[activePage,setActivePage]=useState("overview"),[loading,setLoading]=useState(true),[setupError,setSetupError]=useState(""),[toast,setToast]=useState(null),[metadata,setMetadata]=useState(null),[dropdowns,setDropdowns]=useState({}),[filterOptions,setFilterOptions]=useState({}),[projects,setProjects]=useState([]),[selectedProjectIds,setSelectedProjectIds]=useState([]),[selectedScenarioTypes,setSelectedScenarioTypes]=useState([]),[dashboard,setDashboard]=useState(null),[summary,setSummary]=useState(null),[summaryView,setSummaryView]=useState("production_summary"),[diagnostics,setDiagnostics]=useState(null),[theme,setTheme]=useState("day"),[now,setNow]=useState(new Date()),[lastLoadedAt,setLastLoadedAt]=useState(null),[progress,setProgress]=useState(null),[activityLog,setActivityLog]=useState([]),[activityOpen,setActivityOpen]=useState(false),[selectedReportCharts,setSelectedReportCharts]=useState([]);
 const modules=useMemo(()=>asArray(metadata?.modules).filter(m=>!m.readOnly&&!["config"].includes(String(m.id))),[metadata]);
 const summaryViews=useMemo(()=>asArray(metadata?.summaryViews).length?metadata.summaryViews:IM3_DEFAULT_SUMMARY_VIEWS,[metadata]);
 const scenarioOptions=useMemo(()=>asArray(dropdowns["00_Lookup_ScenarioTypes"]||dropdowns["00_LookupScnearioTypes"]||dropdowns["00_LookupScenarioTypes"]||filterOptions.scenarioTypes||filterOptions.scenarioNames||[]),[dropdowns,filterOptions]);
 const selectedProjectId=selectedProjectIds.length===1?selectedProjectIds[0]:"";
 const filters=useMemo(()=>{const f={};if(selectedProjectIds.length)f.projectIds=selectedProjectIds;if(selectedScenarioTypes.length){f.scenarioNames=selectedScenarioTypes;f.scenarioTypes=selectedScenarioTypes;}return f;},[selectedProjectIds.join("|"),selectedScenarioTypes.join("|")]);
 useEffect(()=>{const t=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(t);},[]);
 useEffect(()=>{let mounted=true,timer=null,failed=false;const started=Date.now();function mark(pct,text,extra={}){if(!mounted)return;const elapsed=Math.max(0,Math.round((Date.now()-started)/1000)),remaining=pct>4&&pct<100?Math.max(1,Math.round(elapsed*(100-pct)/pct)):0;setProgress({pct,text,elapsed,remaining,...extra});}async function optional(label,fn,fallback){try{return await im3xWithTimeout(fn(),14000,label+" timeout")}catch(e){const warning=`${label} warning: ${normalizeError(e)}`;im3xActivity("warning",warning,setActivityLog);return fallback}}async function boot(){try{mark(4,"Preparing interface",{detail:"Starting React shell and checking API bridge."});const api=window.IM3Api;if(!api)throw new Error("IM3 API service is not available.");timer=window.setInterval(()=>setProgress(prev=>{if(!prev||prev.error||prev.pct>=100)return prev;const elapsed=Math.max(0,Math.round((Date.now()-started)/1000)),remaining=prev.pct>4?Math.max(1,Math.round(elapsed*(100-prev.pct)/prev.pct)):0;return{...prev,elapsed,remaining}}),1000);mark(14,"Connecting to Apps Script",{detail:"Waiting for the deployed web app response."});mark(28,"Loading metadata",{detail:"Reading modules, result views and chart catalog."});const meta=await im3xWithTimeout(api.loadMetadata(),70000,"Metadata request timeout");mark(54,"Loading supporting lists",{detail:"Dropdowns, filters and projects are loading in parallel."});const[dd,fo,lp]=await Promise.all([optional("Dropdown lists",()=>api.loadDropdowns(),{}),optional("Filter options",()=>api.loadFilterOptions(),{}),optional("Projects",()=>api.loadProjects(),[])]);if(!mounted)return;mark(90,"Preparing dashboard",{detail:"Normalizing projects, scenarios and UI filters."});setMetadata(meta||{});setDropdowns(dd||meta?.dropdowns||{});setFilterOptions(fo||meta?.filters||{});const list=asArray(lp).length?lp:asArray(fo?.projectIds).map(p=>({Project_ID:getOptionValue(p),Project_Name:im3xOptionLabel(p)}));setProjects(list);setSelectedProjectIds([]);setSetupError("");mark(100,"Interface ready",{detail:"Base data loaded. Opening the selected dashboard view.",remaining:0});im3xActivity("success","Interface loaded",setActivityLog)}catch(e){failed=true;const message=normalizeError(e);setSetupError(message);mark(100,"Loading failed",{detail:message,error:true,remaining:0});im3xActivity("error",message,setActivityLog)}finally{if(timer)window.clearInterval(timer);if(mounted){setLoading(false);if(!failed)window.setTimeout(()=>setProgress(prev=>prev?.error?prev:null),900)}}}boot();return()=>{mounted=false;if(timer)window.clearInterval(timer)};},[]);
 useEffect(()=>{if(metadata)refreshOutputs("Loading selected view");},[metadata,filters,summaryView]);
 function notify(type,text){setToast({type,text});im3xActivity(type,text,setActivityLog);window.clearTimeout(window.__im3ReactToastTimer);window.__im3ReactToastTimer=window.setTimeout(()=>setToast(null),4200);}
 async function refreshOutputs(reason="Refreshing model outputs"){let timer=null;const started=Date.now();function mark(pct,text,extra={}){const elapsed=Math.max(0,Math.round((Date.now()-started)/1000)),remaining=pct>4&&pct<100?Math.max(1,Math.round(elapsed*(100-pct)/pct)):0;setProgress({pct,text,elapsed,remaining,...extra})}try{mark(12,reason,{detail:"Preparing filters and requesting model outputs."});im3xActivity("info",reason,setActivityLog);timer=window.setInterval(()=>setProgress(prev=>{if(!prev||prev.error||prev.pct>=100)return prev;const elapsed=Math.max(0,Math.round((Date.now()-started)/1000)),remaining=prev.pct>4?Math.max(1,Math.round(elapsed*(100-prev.pct)/prev.pct)):0;return{...prev,elapsed,remaining}}),1000);mark(32,"Loading dashboard and result viewer",{detail:"Both endpoints are loading in parallel."});const dashPromise=im3xWithTimeout(window.IM3Api.loadDashboard(filters,selectedProjectId),22000,"Dashboard timeout").catch(err=>({error:normalizeError(err),rows:[],summary:{}}));const sumPromise=im3xWithTimeout(window.IM3Api.loadSummaryData(summaryView,filters,selectedProjectId),22000,"Result viewer timeout").catch(err=>({error:normalizeError(err),cards:[]}));const[dash,sum]=await Promise.all([dashPromise,sumPromise]);const issues=[];if(dash?.error)issues.push("Dashboard: "+dash.error);if(sum?.error)issues.push("Result viewer: "+sum.error);setDashboard(dash);setSummary(sum);setLastLoadedAt(new Date());mark(100,issues.length?"Data loaded with warnings":"Data loaded",{detail:issues.join(" | ")||"Dashboard and result viewer are ready.",warning:issues.join(" | "),remaining:0});window.setTimeout(()=>setProgress(prev=>prev?.error?prev:null),issues.length?4200:900);im3xActivity(issues.length?"warning":"success",issues.length?`Data loaded with ${issues.length} warning(s)`:"Dashboard and result viewer updated",setActivityLog)}catch(e){mark(100,"Loading failed",{detail:normalizeError(e),error:true,remaining:0});notify("error",normalizeError(e))}finally{if(timer)window.clearInterval(timer)}}
 async function refreshAll(){await refreshOutputs("Manual refresh requested");notify("success","Results updated.");}
 async function runDiagnostics(){try{setProgress({pct:20,text:"Running diagnostics"});const result=await window.IM3Api.runDiagnostics();setDiagnostics(result);setProgress({pct:100,text:"Diagnostics completed"});window.setTimeout(()=>setProgress(null),650);notify("success","Diagnostics completed.");}catch(e){setProgress({pct:100,text:"Diagnostics failed",error:true});notify("error",normalizeError(e));}}
 if(loading||setupError)return <><GlobalProgress progress={progress}/>{setupError?<SetupError message={setupError} progress={progress}/>:<LoadingState text="Loading IM3 model data" progress={progress}/>}</>;
 const selectedProject=selectedProjectIds.length===1?(projects.find(p=>String(p.Project_ID||p.value)===String(selectedProjectIds[0]))||{}):{Project_Name:selectedProjectIds.length?`${selectedProjectIds.length} projects selected`:"All projects"};
 return <div className="im3rx-app" data-theme={theme}><GlobalProgress progress={progress}/><AppShell activePage={activePage} setActivePage={setActivePage} theme={theme} setTheme={setTheme} metadata={metadata} selectedProject={selectedProject} onRefresh={refreshAll} now={now} activityLog={activityLog} activityOpen={activityOpen} setActivityOpen={setActivityOpen}><Header activePage={activePage} projects={projects} selectedProjectIds={selectedProjectIds} setSelectedProjectIds={setSelectedProjectIds} scenarioOptions={scenarioOptions} selectedScenarioTypes={selectedScenarioTypes} setSelectedScenarioTypes={setSelectedScenarioTypes} lastLoadedAt={lastLoadedAt} onRefresh={refreshAll}/>{activePage==="overview"&&<OverviewPage dashboard={dashboard} summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView} diagnostics={diagnostics} onDiagnostics={runDiagnostics}/>} {activePage==="input"&&<DataInputPage modules={modules} dropdowns={dropdowns} filterOptions={filterOptions} selectedProjectId={selectedProjectId} onSaved={refreshAll} notify={notify}/>} {activePage==="analysis"&&<AnalysisPage dashboard={dashboard} summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView}/>} {activePage==="graphs"&&<GraphStudioPage metadata={metadata} projects={projects} selectedProjectIds={selectedProjectIds} filters={filters} notify={notify} selectedReportCharts={selectedReportCharts} setSelectedReportCharts={setSelectedReportCharts}/>} {activePage==="reports"&&<ReportsPage selectedProjectId={selectedProjectId} filters={filters} notify={notify} selectedReportCharts={selectedReportCharts}/>} {activePage==="admin"&&<AdministrationPage metadata={metadata} diagnostics={diagnostics} onDiagnostics={runDiagnostics} notify={notify}/>}</AppShell><ActivityDrawer open={activityOpen} log={activityLog} onClose={()=>setActivityOpen(false)}/>{toast&&<Toast type={toast.type} text={toast.text} onClose={()=>setToast(null)}/>}</div>;
}
function AppShell({activePage,setActivePage,theme,setTheme,metadata,selectedProject,onRefresh,now,activityLog,activityOpen,setActivityOpen,children}){
  const timeParts=im3xDateTime(now).split(",");
  return <div className="im3rx-shell"><aside className="im3rx-sidebar"><div className="im3rx-brand-row"><div className="im3rx-brand"><div className="im3rx-logo">IM3</div><div><strong>IM3 Framework</strong><span>Investment Decision Platform</span></div></div><button className="im3rx-icon-btn im3rx-bell-btn" title="Notifications" onClick={()=>setActivityOpen(!activityOpen)}><img src={IM3_ACTION_ICONS.bell} alt=""/>{activityLog.length?<em>{activityLog.length}</em>:null}</button><div className="im3rx-clock im3rx-clock-actions"><button className="im3rx-icon-btn im3rx-theme" title={theme==="day"?"Night mode":"Day mode"} onClick={()=>setTheme(theme==="day"?"night":"day")}><img src={theme==="day"?IM3_ACTION_ICONS.moon:IM3_ACTION_ICONS.sun} alt=""/></button><div className="im3rx-clock-text"><strong>{timeParts.pop()||im3xDateTime(now)}</strong><span>{timeParts.join(",")||"Real time"}</span></div><button className="im3rx-icon-btn" title="Refresh results" onClick={onRefresh}><img src={IM3_ACTION_ICONS.refresh} alt=""/></button></div></div><nav className="im3rx-nav">{IM3_NAV.map(item=><button key={item.id} className={activePage===item.id?"active":""} onClick={()=>setActivePage(item.id)}><i><img src={item.icon} alt=""/></i><span>{item.label}</span></button>)}</nav><div className="im3rx-sidebar-card"><span>Active selection</span><strong>{selectedProject.Project_Name||selectedProject.label||selectedProject.Project_ID||"All projects"}</strong><small>{metadata?.version||"Version unavailable"}</small></div></aside><main className="im3rx-main">{children}</main></div>
}
function Header({activePage,projects,selectedProjectIds,setSelectedProjectIds,scenarioOptions,selectedScenarioTypes,setSelectedScenarioTypes,lastLoadedAt,onRefresh}){const title=IM3_NAV.find(n=>n.id===activePage)?.label||"Overview";return <section className="im3rx-header"><div><p>Google Sheets + Apps Script Engine</p><h1>{title}</h1><span>Last data load: {im3xDateTime(lastLoadedAt)}</span></div><div className="im3rx-header-controls"><MultiSelectDropdown label="Projects" options={projects} selected={selectedProjectIds} onChange={setSelectedProjectIds} valueKey="Project_ID" displayKey="Project_Name" allLabel="All projects"/><MultiSelectDropdown label="Scenario type" options={scenarioOptions} selected={selectedScenarioTypes} onChange={setSelectedScenarioTypes} allLabel="All scenarios"/><button className="im3rx-icon-text" onClick={onRefresh}><img src={IM3_ACTION_ICONS.refresh} alt=""/>Reload</button></div></section>}
function MultiSelectDropdown({label,options,selected,onChange,valueKey,displayKey,allLabel}){const[open,setOpen]=useState(false);const normalized=asArray(options).map((option,idx)=>{const value=option&&typeof option==="object"?String(option[valueKey]??option.value??option.id??option.key??option.label??idx):String(option??idx);const text=option&&typeof option==="object"?im3xCleanLabel(option[displayKey]??option.label??option.name??option.title??option.value??value):im3xCleanLabel(option);return{value,label:text||value}}).filter(o=>o.value!=="");const selectedLabels=selected.length?normalized.filter(o=>selected.includes(o.value)).map(o=>o.label).slice(0,2).join(", "):allLabel;function toggle(value){onChange(selected.includes(value)?selected.filter(v=>v!==value):[...selected,value])}return <div className={`im3rx-ms ${open?"open":""}`}><span>{label}</span><button type="button" onClick={()=>setOpen(!open)}><strong>{selectedLabels||allLabel}</strong><small>{selected.length?`${selected.length} selected`:"All"}</small></button>{open&&<div className="im3rx-ms-menu"><label className="im3rx-ms-option"><input type="checkbox" checked={!selected.length} onChange={()=>onChange([])}/><span>{allLabel}</span></label>{normalized.map(o=><label key={o.value} className="im3rx-ms-option"><input type="checkbox" checked={selected.includes(o.value)} onChange={()=>toggle(o.value)}/><span>{o.label}</span></label>)}</div>}</div>}
function OverviewPage({dashboard,summary,summaryViews,summaryView,setSummaryView,diagnostics,onDiagnostics}){const dashSummary=dashboard?.summary||{},first=dashboard?.first||dashboard?.rows?.[0]||{},decision=first.Final_Decision||first.Decision_Label||first.Recommendation||"Review";return <><section className="im3rx-grid im3rx-kpis"><KpiCard label="Rows" value={dashSummary.count??dashboard?.rows?.length??0} hint="Selected output rows"/><KpiCard label="Average NPV" value={window.IM3Api.formatCurrency(dashSummary.avgNPV??first.NPV_USD??first.NPV_Display)} hint="Filtered average"/><KpiCard label="Average IRR" value={window.IM3Api.formatPercent(dashSummary.avgIRR??first.IRR??first.IRR_Display)} hint="Return indicator"/><KpiCard label="MCDA" value={window.IM3Api.formatNumber(dashSummary.avgMCDA??first.MCDA_Score??first.MCDA_Display)} hint="Strategic score"/><KpiCard label="System Dynamics" value={window.IM3Api.formatNumber(dashSummary.avgSD??first.System_Dynamics_Score??first.SD_Display)} hint="Dynamic resilience"/><KpiCard label="Integrated Score" value={window.IM3Api.formatNumber(dashSummary.avgIntegratedScore??first.Integrated_Score)} hint="Final composite score"/><KpiCard label="Best Project" value={dashSummary.bestProject?.Project_Name||first.Project_Name||"-"} hint="By integrated score"/><KpiCard label="Decision" value={decision} hint={first.Risk_Label||first.Scenario_Risk_Class||"Decision state"} tone={statusTone(decision)}/></section><section className="im3rx-two-col"><DataQualityPanel diagnostics={diagnostics} dashboard={dashboard} onDiagnostics={onDiagnostics}/><SummaryViewer summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView}/></section></>}
function KpiCard({label,value,hint,tone="neutral"}){return <article className={`im3rx-kpi ${tone}`}><div className="im3rx-kpi-icon"><img src={im3xIcon(label)} alt=""/></div><span>{im3xCleanLabel(label)}</span><strong>{value===undefined||value===null||value===""?"-":value}</strong><small>{im3xCleanLabel(hint||"Model output")||"Model output"}</small><b></b></article>}
function DataQualityPanel({diagnostics,dashboard,onDiagnostics}){const missingSheets=asArray(diagnostics?.missingSheets),rows=dashboard?.rows||[],warnings=[];if(!rows.length)warnings.push("No dashboard rows returned for the current selection.");if(missingSheets.length)warnings.push(`${missingSheets.length} workbook sheet(s) reported missing.`);if(!diagnostics)warnings.push("Run diagnostics to validate formulas and module availability.");const score=Math.max(0,100-warnings.length*18-missingSheets.length*4);const items=[{ok:rows.length>0,text:"Project data available"},{ok:!missingSheets.length,text:"Workbook modules available"},{ok:true,text:"Dropdown values loaded"},{ok:!!diagnostics,text:"Diagnostics available"}];return <section className="im3rx-card"><div className="im3rx-card-head"><div><p>Data Quality</p><h2>{score}%</h2></div><button onClick={onDiagnostics}>Run diagnostics</button></div><ul className="im3rx-checks enhanced">{items.map((item,idx)=><li key={idx} className={item.ok?"ok":"warn"}><span>{item.text}</span><img src={item.ok?"https://img.icons8.com/fluency-systems-regular/48/checkmark.png":"https://img.icons8.com/fluency-systems-regular/48/error.png"} alt=""/></li>)}</ul>{warnings.length?<div className="im3rx-warning-list">{warnings.map((w,i)=><span key={i}>{w}</span>)}</div>:<p className="im3rx-muted">No critical data quality warnings found.</p>}</section>}
function SummaryViewer({summary,summaryViews,summaryView,setSummaryView}){const cards=asArray(summary?.cards);return <section className="im3rx-card"><div className="im3rx-card-head"><div><p>Result Viewer</p><h2>{im3xCleanLabel(summary?.title||"Selected output")}</h2></div><select value={summaryView} onChange={e=>setSummaryView(e.target.value)}>{summaryViews.map(v=><option key={v.id} value={v.id}>{im3xCleanLabel(v.title)}</option>)}</select></div>{summary?.error&&<ErrorBanner message={summary.error}/>} {!cards.length&&!summary?.error&&<EmptyState title="No summary cards" text="Select another result module or verify the Google Sheets output blocks."/>}<div className="im3rx-mini-grid">{cards.map((c,idx)=><KpiCard key={idx} label={c.label} value={formatSummaryValue(c)} hint="Result viewer"/>)}</div></section>}
function AnalysisPage({dashboard,summary,summaryViews,summaryView,setSummaryView}){return <section className="im3rx-two-col"><SummaryViewer summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView}/><section className="im3rx-card"><div className="im3rx-card-head"><div><p>Dashboard Rows</p><h2>Filtered output</h2></div></div><TablePreview rows={dashboard?.rows||[]}/></section></section>}
function GraphStudioPage({metadata,projects,selectedProjectIds,filters,notify,selectedReportCharts,setSelectedReportCharts}){return <section className="im3rx-card"><div className="im3rx-card-head"><div><p>Graph Studio</p><h2>Dual Cartesian comparison</h2><small>Build two charts side by side, compare compatible units, export images, and select charts for reports.</small></div></div><div className="im3rx-dual-charts"><ChartWorkbench slot="A" metadata={metadata} projects={projects} selectedProjectIds={selectedProjectIds} filters={filters} notify={notify} selectedReportCharts={selectedReportCharts} setSelectedReportCharts={setSelectedReportCharts}/><ChartWorkbench slot="B" metadata={metadata} projects={projects} selectedProjectIds={selectedProjectIds} filters={filters} notify={notify} selectedReportCharts={selectedReportCharts} setSelectedReportCharts={setSelectedReportCharts}/></div></section>}
function ChartWorkbench({slot,metadata,projects,selectedProjectIds,filters,notify,selectedReportCharts,setSelectedReportCharts}){const canvasRef=useRef(null),chartRef=useRef(null),autoRenderedRef=useRef(false),catalog=asArray(metadata?.chartMetricCatalog||metadata?.chartMetrics),groups=useMemo(()=>[...new Set(catalog.map(m=>m.group||"General"))],[catalog]),defaultGroup=useMemo(()=>{const pattern=slot==="A"?/prod|volume|capacity|output/i:/price|tariff|revenue|usd|financial/i;return groups.find(g=>pattern.test(g))||groups[slot==="A"?0:1]||groups[0]||"General"},[groups.join("|"),slot]);const[group,setGroup]=useState(defaultGroup),metricsInGroup=catalog.filter(m=>(m.group||"General")===group),[selectedMetrics,setSelectedMetrics]=useState([]),[selectedProjects,setSelectedProjects]=useState(selectedProjectIds.length?selectedProjectIds:[]),[chartType,setChartType]=useState("line"),[status,setStatus]=useState(""),[chartProgress,setChartProgress]=useState(null),[chartImage,setChartImage]=useState("");const chartId=`chart-${slot}`,included=selectedReportCharts.some(c=>c.id===chartId);useEffect(()=>{if(defaultGroup&&group!==defaultGroup&&!autoRenderedRef.current)setGroup(defaultGroup);else if(groups.length&&!groups.includes(group))setGroup(defaultGroup||groups[0]);},[defaultGroup,groups.join("|")]);useEffect(()=>{setSelectedMetrics(metricsInGroup[0]?[metricsInGroup[0].metricId||metricsInGroup[0].value]:[]);},[group]);useEffect(()=>{setSelectedProjects(selectedProjectIds.length?selectedProjectIds:[]);},[selectedProjectIds.join("|")]);useEffect(()=>{if(autoRenderedRef.current||!selectedMetrics.length||!window.IM3Api?.loadTimeseries)return;autoRenderedRef.current=true;window.setTimeout(()=>buildChart(true),350);},[selectedMetrics.join("|"),group]);function toggleMetric(id){setSelectedMetrics(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}function toggleProject(id){setSelectedProjects(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}
async function buildChart(auto=false){try{if(!selectedMetrics.length)throw new Error("Select at least one metric.");setChartProgress({pct:8,text:auto?"Rendering default chart":"Preparing chart"});const chartFilters={...filters};if(selectedProjects.length)chartFilters.projectIds=selectedProjects;setChartProgress({pct:35,text:"Loading time series"});const data=await window.IM3Api.loadTimeseries({metrics:selectedMetrics,filters:chartFilters,groupBy:"Project_Name"});setChartProgress({pct:70,text:"Rendering chart"});renderChart(data);setChartProgress({pct:100,text:"Graph rendered"});setStatus(data.series?.length?`${data.series.length} series rendered. Unit: ${data.yUnit||"value"}`:"No series returned.");window.setTimeout(()=>setChartProgress(null),900)}catch(e){setChartProgress({pct:100,text:"Chart failed",error:true});setStatus(normalizeError(e));if(!auto)notify("error","Chart error: "+normalizeError(e))}}
function renderChart(data){if(!window.Chart||!canvasRef.current)return;if(chartRef.current)chartRef.current.destroy();const years=data.years||[],rootStyles=window.getComputedStyle(document.querySelector(".im3rx-app")||document.documentElement),textColor=rootStyles.getPropertyValue("--im3rx-text").trim()||"#132238",borderColor=rootStyles.getPropertyValue("--im3rx-border").trim()||"#D7E0EA",surface2=rootStyles.getPropertyValue("--im3rx-surface-2").trim()||"#EEF3F7",colors=["#003B5C","#1F78B4","#0E8A4B","#D86B21","#C0392B","#6C5CE7","#00A8A8","#9B59B6","#4A6572","#B88A00"],datasets=[];asArray(data.series).forEach((series,metricIdx)=>{const names=[...new Set(asArray(series.data).map(p=>p.series||series.label))];names.forEach((name,idx)=>{const color=colors[(metricIdx*3+idx)%colors.length],points=years.map(year=>{const found=asArray(series.data).find(p=>String(p.year)===String(year)&&String(p.series||series.label)===String(name));return found?Number(found.value):null});datasets.push({label:`${series.label}${names.length>1?" - "+im3xCleanLabel(name):""}`,data:chartType==="scatter"?years.map((year,i)=>({x:Number(year),y:points[i]})):points,borderColor:color,backgroundColor:chartType==="area"?color+"33":color,tension:chartType==="smoothLine"||chartType==="area"?.36:.12,fill:chartType==="area",borderWidth:chartType==="bar"||chartType==="stackedBar"?1.2:2,pointRadius:chartType==="bar"||chartType==="stackedBar"?0:3,pointHoverRadius:5,borderRadius:chartType==="bar"||chartType==="stackedBar"?3:0})})});const finalType=chartType==="bar"||chartType==="stackedBar"?"bar":chartType==="scatter"?"scatter":chartType==="radar"?"radar":"line",isStacked=chartType==="stackedBar",scales=chartType==="radar"?{}:{x:{title:{display:true,text:"Year",color:textColor},ticks:{color:textColor},grid:{color:borderColor},stacked:isStacked},y:{title:{display:true,text:data.yUnit||"value",color:textColor},ticks:{color:textColor},grid:{color:borderColor},stacked:isStacked,beginAtZero:chartType==="bar"||chartType==="stackedBar"}};chartRef.current=new Chart(canvasRef.current,{type:finalType,data:{labels:years,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"nearest",intersect:false},plugins:{legend:{position:"bottom",labels:{color:textColor,usePointStyle:true,boxWidth:10,padding:14}},tooltip:{backgroundColor:textColor,titleColor:surface2,bodyColor:surface2}},scales}});window.setTimeout(()=>{try{setChartImage(canvasRef.current.toDataURL("image/jpeg",.72))}catch(e){}},250)}
function download(format){if(!canvasRef.current)return;const type=format==="jpg"?"image/jpeg":"image/png",a=document.createElement("a");a.href=canvasRef.current.toDataURL(type,.92);a.download=`IM3_Graph_${slot}.${format}`;a.click()}function toggleReport(){const meta={id:chartId,slot,title:`Graph ${slot}: ${group}`,chartType,metrics:selectedMetrics,projects:selectedProjects,image:chartImage};setSelectedReportCharts(prev=>included?prev.filter(c=>c.id!==chartId):[...prev.filter(c=>c.id!==chartId),meta])}
return <div className="im3rx-chart-workbench"><div className="im3rx-chart-title"><strong>Graph {slot}</strong><button className="primary" onClick={()=>buildChart(false)}><img src={IM3_ACTION_ICONS.render} alt=""/>Render</button></div><div className="im3rx-graph-grid"><label><span>Indicator group</span><select value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g} value={g}>{im3xCleanLabel(g)}</option>)}</select></label><label><span>Chart type</span><select value={chartType} onChange={e=>setChartType(e.target.value)}>{IM3_CHART_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label></div><div className="im3rx-picker"><strong>Compatible metrics</strong>{metricsInGroup.map(m=>{const id=m.metricId||m.value;return <button key={id} className={selectedMetrics.includes(id)?"active":""} onClick={()=>toggleMetric(id)}>{im3xStripUnit(m.label||id)}</button>})}</div><div className="im3rx-picker compact"><strong>Projects</strong>{projects.map(p=>{const id=p.Project_ID||p.value;return <button key={id} className={selectedProjects.includes(id)?"active":""} onClick={()=>toggleProject(id)}>{im3xCleanLabel(p.Project_Name||p.label||id)}</button>})}</div>{chartProgress&&<div className={`im3rx-progress im3rx-chart-progress ${chartProgress.error?"error":""}`}><div><strong>{chartProgress.text}</strong><span>{chartProgress.pct}%</span></div><i style={{width:chartProgress.pct+"%"}}></i><small>Graph Studio rendering progress</small></div>}{status&&<div className="im3rx-validation"><strong>Status</strong><span>{status}</span></div>}<div className="im3rx-chart-box"><canvas ref={canvasRef}></canvas></div><div className="im3rx-actions bottom"><button onClick={()=>download("png")} disabled={!chartImage}><img src={IM3_ACTION_ICONS.download} alt=""/>PNG</button><button onClick={()=>download("jpg")} disabled={!chartImage}><img src={IM3_ACTION_ICONS.image} alt=""/>JPG</button><button className={included?"primary":""} onClick={toggleReport} disabled={!chartImage}><img src={IM3_ACTION_ICONS.report} alt=""/>{included?"Included":"Include in PDF"}</button></div></div>}
function ReportsPage({selectedProjectId,filters,notify,selectedReportCharts}){const[language,setLanguage]=useState("en"),[orientation,setOrientation]=useState("landscape"),[paperSize,setPaperSize]=useState("A4"),[includeCharts,setIncludeCharts]=useState(true),[progress,setProgress]=useState(null),[links,setLinks]=useState([]),[generating,setGenerating]=useState(false),cancelRef=useRef({canceled:false,token:0});async function generate(kind){let timer;const token=Date.now();cancelRef.current={canceled:false,token};try{setLinks([]);setGenerating(true);const start=Date.now();setProgress({pct:10,text:"Preparing report request",elapsed:0,estimate:kind==="pack"?120:60});timer=window.setInterval(()=>{setProgress(prev=>prev&&!cancelRef.current.canceled?{...prev,pct:Math.min(prev.pct+7,88),elapsed:Math.round((Date.now()-start)/1000)}:prev)},1000);const options={orientation,paperSize,includeCharts,charts:includeCharts?selectedReportCharts.map(c=>({title:c.title,chartType:c.chartType,metrics:c.metrics,projects:c.projects,image:c.image||"",imageFormat:(String(c.image||"").includes("image/jpeg")?"jpg":"png")})):[]};const result=kind==="pack"?await window.IM3Api.generateInvestmentPack(selectedProjectId,language,filters,options):await window.IM3Api.generatePdf(kind,selectedProjectId,language,filters,options);window.clearInterval(timer);if(cancelRef.current.canceled||cancelRef.current.token!==token)return;setProgress({pct:100,text:"Report generated successfully.",elapsed:Math.round((Date.now()-start)/1000),estimate:0});setLinks(extractReportLinks(result));notify("success","Report generated successfully.")}catch(e){window.clearInterval(timer);if(!cancelRef.current.canceled){setProgress({pct:100,text:"Report generation failed: "+normalizeError(e),elapsed:0,estimate:0,error:true});notify("error",normalizeError(e))}}finally{setGenerating(false)}}function cancel(){cancelRef.current.canceled=true;setGenerating(false);setProgress({pct:100,text:"Report generation canceled in the interface.",elapsed:0,error:true});notify("info","Report generation canceled in the interface.")}function clear(){setLinks([]);setProgress(null)}return <section className="im3rx-card"><div className="im3rx-card-head"><div><p>Reports</p><h2>Investment Decision Pack</h2><small>Preview settings, choose page layout, include selected charts, then generate manually.</small></div><select value={language} onChange={e=>setLanguage(e.target.value)}>{IM3_LANGUAGES.map(l=><option key={l.value} value={l.value}>{l.label}</option>)}</select></div><div className="im3rx-report-layout"><div className="im3rx-report-options"><label><span>Page orientation</span><select value={orientation} onChange={e=>setOrientation(e.target.value)}><option value="landscape">Horizontal / landscape</option><option value="portrait">Vertical / portrait</option></select></label><label><span>Paper size</span><select value={paperSize} onChange={e=>setPaperSize(e.target.value)}><option value="A4">A4</option><option value="Letter">Letter</option></select></label><label className="im3rx-toggle"><input type="checkbox" checked={includeCharts} onChange={e=>setIncludeCharts(e.target.checked)}/><span>Include selected charts ({selectedReportCharts.length})</span></label></div><div className={`im3rx-report-preview ${orientation}`}><div><img src="https://img.icons8.com/fluency-systems-regular/48/visible.png" alt=""/><strong>Preview before generation</strong></div><p>Language: {language.toUpperCase()} | Layout: {orientation} | Paper: {paperSize}</p><p>Charts selected: {includeCharts?selectedReportCharts.length:0}</p><div className="im3rx-report-thumbs">{includeCharts&&selectedReportCharts.slice(0,4).map(c=><figure key={c.id}>{c.image?<img src={c.image} alt=""/>:<span></span>}<figcaption>{c.title}</figcaption></figure>)}</div></div></div><div className="im3rx-actions bottom"><button onClick={()=>generate("executive")} disabled={generating}>Executive Summary</button><button onClick={()=>generate("technical")} disabled={generating}>Technical Investment Report</button><button className="primary" onClick={()=>generate("pack")} disabled={generating}>Investment Decision Pack</button>{generating&&<button className="danger" onClick={cancel}><img src={IM3_ACTION_ICONS.cancel} alt=""/>Cancel</button>}<button onClick={clear} disabled={generating}>Clear reports</button></div>{progress&&<div className={`im3rx-progress ${progress.error?"error":""}`}><div><strong>{progress.text}</strong><span>{progress.pct}%</span></div><i style={{width:progress.pct+"%"}}></i><small>Elapsed: {progress.elapsed||0}s {progress.estimate?`| Estimated: ${progress.estimate}s`:""}</small></div>}<div className="im3rx-links">{links.map((link,idx)=><a key={idx} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div></section>}
function GlobalProgress({progress}){if(!progress)return null;return <div className={`im3rx-global-progress ${progress.error?"error":""}`}><div><strong>{progress.text}</strong><span>{progress.pct}%</span></div><i style={{width:progress.pct+"%"}}></i><small>{progress.detail||progress.warning||""}{progress.elapsed!==undefined?` | elapsed ${progress.elapsed}s`:""}{progress.remaining?` | about ${progress.remaining}s left`:""}</small></div>}
function ActivityDrawer({open,log,onClose}){return <aside className={`im3rx-activity ${open?"open":""}`}><div><strong>Execution history</strong><button onClick={onClose}>x</button></div>{!log.length?<p>No activity yet.</p>:log.map((item,idx)=><article key={idx} className={item.type}><span>{im3xDateTime(item.time)}</span><strong>{item.text}</strong></article>)}</aside>}


ReactDOM.createRoot(document.getElementById("im3-react-root")).render(<App />);
