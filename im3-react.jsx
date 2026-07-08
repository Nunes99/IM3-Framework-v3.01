const { useEffect, useMemo, useRef, useState } = React;

const IM3_LANGUAGES = [
  { value: "en", label: "🇬🇧 English" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "ru", label: "🇷🇺 Русский" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "es", label: "🇪🇸 Español" }
];

const IM3_NAV = [
  { id: "overview", label: "Overview", icon: "◼" },
  { id: "input", label: "Data Input", icon: "✎" },
  { id: "analysis", label: "Analysis", icon: "◎" },
  { id: "graphs", label: "Graph Studio", icon: "⌁" },
  { id: "reports", label: "Reports", icon: "▣" },
  { id: "admin", label: "Administration", icon: "⚙" }
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

function App() {
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

function AppShell({ activePage, setActivePage, theme, setTheme, metadata, selectedProject, onRefresh, children }) {
  return (
    <div className="im3rx-shell">
      <aside className="im3rx-sidebar">
        <div className="im3rx-brand">
          <div className="im3rx-logo">IM³</div>
          <div>
            <strong>IM³ Framework</strong>
            <span>Investment Decision Platform</span>
          </div>
        </div>
        <nav className="im3rx-nav">
          {IM3_NAV.map(item => (
            <button key={item.id} className={activePage === item.id ? "active" : ""} onClick={() => setActivePage(item.id)}>
              <i>{item.icon}</i><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="im3rx-sidebar-card">
          <span>Active project</span>
          <strong>{selectedProject.Project_Name || selectedProject.label || selectedProject.Project_ID || "No project selected"}</strong>
          <small>{metadata?.version || "Version unavailable"}</small>
        </div>
        <button className="im3rx-theme" onClick={() => setTheme(theme === "day" ? "night" : "day")}>{theme === "day" ? "Night mode" : "Day mode"}</button>
        <button className="im3rx-sidebar-refresh" onClick={onRefresh}>Refresh results</button>
      </aside>
      <main className="im3rx-main">{children}</main>
    </div>
  );
}

function Header({ activePage, projects, selectedProjectId, setSelectedProjectId, scenarios, selectedScenarioId, setSelectedScenarioId, dashboard, onRefresh }) {
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

function OverviewPage({ dashboard, summary, summaryViews, summaryView, setSummaryView, diagnostics, onDiagnostics }) {
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

function KpiCard({ label, value, hint, tone = "neutral" }) {
  return (
    <article className={`im3rx-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === "" ? "—" : value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function DataQualityPanel({ diagnostics, dashboard, onDiagnostics }) {
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

function SummaryViewer({ summary, summaryViews, summaryView, setSummaryView }) {
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
      notify("info", "Saving to Google Sheets…");
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
          {headers.map(key => <FieldRenderer key={key} fieldKey={key} value={form[key] ?? ""} editable={isEditable(key)} moduleMeta={moduleMeta} dropdowns={dropdowns} filterOptions={filterOptions} onChange={value => setForm(prev => ({ ...prev, [key]: value }))} />)}
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

function FieldRenderer({ fieldKey, value, editable, moduleMeta, dropdowns, filterOptions, onChange }) {
  const source = moduleMeta.dropdowns?.[fieldKey];
  const dropdownOptions = source ? (dropdowns[source] || filterOptions[fieldKey] || []) : [];
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

function AnalysisPage({ dashboard, summary, summaryViews, summaryView, setSummaryView }) {
  return <section className="im3rx-two-col"><SummaryViewer summary={summary} summaryViews={summaryViews} summaryView={summaryView} setSummaryView={setSummaryView} /><section className="im3rx-card"><div className="im3rx-card-head"><div><p>Dashboard Rows</p><h2>Filtered output</h2></div></div><TablePreview rows={dashboard?.rows || []} /></section></section>;
}

function GraphStudioPage({ metadata, projects, selectedProjectId, filters, notify }) {
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
      setStatus("Loading time series…");
      const chartFilters = { ...filters };
      if (selectedProjects.length) chartFilters.projectIds = selectedProjects;
      const data = await window.IM3Api.loadTimeseries({ metrics:selectedMetrics, filters:chartFilters, groupBy:"Project_Name" });
      renderChart(data);
      setStatus(data.series?.length ? `Rendered ${data.series.length} metric(s). Y-axis unit: ${data.yUnit || "value"}` : "No series returned.");
    } catch (error) {
      setStatus(normalizeError(error));
      notify("error", "Chart error: " + normalizeError(error));
    }
  }

  function renderChart(data) {
    if (!window.Chart || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const years = data.years || [];
    const colors = ["#003B5C", "#1F78B4", "#0E8A4B", "#E67E22", "#C0392B", "#6C5CE7", "#00A8A8", "#9B59B6", "#34495E", "#F1C40F"];
    const datasets = [];
    asArray(data.series).forEach((series, metricIdx) => {
      const seriesNames = [...new Set(asArray(series.data).map(p => p.series || series.label))];
      seriesNames.forEach((name, idx) => {
        const color = colors[(metricIdx * 3 + idx) % colors.length];
        datasets.push({
          label: `${series.label}${seriesNames.length > 1 ? " — " + name : ""}`,
          data: years.map(year => {
            const found = asArray(series.data).find(p => String(p.year) === String(year) && String(p.series || series.label) === String(name));
            return found ? found.value : null;
          }),
          borderColor: color,
          backgroundColor: color,
          tension: 0.25,
          fill: false,
          borderWidth: 2.5
        });
      });
    });
    chartRef.current = new Chart(canvasRef.current, { type:chartType, data:{ labels:years, datasets }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:"bottom" } }, scales:{ x:{ title:{ display:true, text:"Year" } }, y:{ title:{ display:true, text:data.yUnit || "value" } } } } });
  }

  return (
    <section className="im3rx-card">
      <div className="im3rx-card-head"><div><p>Graph Studio</p><h2>Compatible multi-series comparison</h2><small>Select several metrics from the same group and compare one or many projects.</small></div><button onClick={buildChart}>Render graph</button></div>
      <div className="im3rx-graph-grid">
        <label><span>Indicator group</span><select value={group} onChange={e => setGroup(e.target.value)}>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
        <label><span>Chart type</span><select value={chartType} onChange={e => setChartType(e.target.value)}><option value="line">Line</option><option value="bar">Bar</option></select></label>
      </div>
      <div className="im3rx-picker"><strong>Compatible metrics</strong>{metricsInGroup.map(m => { const id = m.metricId || m.value; return <button key={id} className={selectedMetrics.includes(id) ? "active" : ""} onClick={() => toggleMetric(id)}>{m.label || prettyLabel(id)}<small>{m.fallbackUnit || m.unit || ""}</small></button>; })}</div>
      <div className="im3rx-picker"><strong>Projects</strong>{projects.map(p => { const id = p.Project_ID || p.value; return <button key={id} className={selectedProjects.includes(id) ? "active" : ""} onClick={() => toggleProject(id)}>{p.Project_Name || p.label || id}</button>; })}</div>
      {status && <div className="im3rx-validation"><strong>Status</strong><span>{status}</span></div>}
      <div className="im3rx-chart-box"><canvas ref={canvasRef}></canvas></div>
    </section>
  );
}

function ReportsPage({ selectedProjectId, filters, notify }) {
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

function LoadingState({ text, compact }) {
  return <div className={compact ? "im3rx-loading compact" : "im3rx-loading"}><div></div><strong>{text}</strong></div>;
}

function SetupError({ message }) {
  return <div className="im3rx-setup-error"><h2>IM³ setup error</h2><p>{message}</p><small>Check Apps Script deployment URL, access permissions and script loading order.</small></div>;
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

ReactDOM.createRoot(document.getElementById("im3-react-root")).render(<App />);
