import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "./Complaints.jsx";

export function useTechnician(apiBase, token, user, onExpired) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(user.role === "TECHNICIAN");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const expired = useRef(onExpired);
  const active = useRef(null);
  const sequence = useRef(0);
  const loaded = useRef(false);
  const saving = useRef(false);
  useEffect(() => { expired.current = onExpired; }, [onExpired]);
  const request = useCallback(async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`${apiBase}/technicians${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
      });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw new Error(options.method === "PUT" ? "Could not confirm the status update. Refresh jobs before trying again." : "Unable to reach the server. Check your connection and retry.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      if (response.status === 401) expired.current("Your session expired. Please sign in again.");
      throw new Error(data.message || "Unable to load or update your jobs.");
    }
    return data;
  }, [apiBase, token]);
  const refresh = useCallback(async () => {
    if (user.role !== "TECHNICIAN" || saving.current) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const current = ++sequence.current;
    if (!loaded.current) setLoading(true);
    setRefreshing(true);
    try {
      const data = await request("/me/jobs", { signal: controller.signal });
      if (!Array.isArray(data.complaints)) throw new Error("The server returned an invalid job list.");
      if (controller.signal.aborted || current !== sequence.current) return;
      setJobs(data.complaints); setError(""); loaded.current = true;
    } catch (err) {
      if (!controller.signal.aborted && current === sequence.current) setError(err.message);
    } finally {
      if (!controller.signal.aborted && current === sequence.current) { setLoading(false); setRefreshing(false); }
    }
  }, [request, user.role]);
  useEffect(() => {
    if (user.role !== "TECHNICIAN") return;
    refresh();
    const update = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { active.current?.abort(); ++sequence.current; window.clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [refresh, user.id, user.role]);
  async function updateStatus(id, status) {
    if (saving.current) throw new Error("A status update is already in progress.");
    saving.current = true;
    active.current?.abort(); ++sequence.current;
    try {
      const data = await request(`/complaints/${encodeURIComponent(id)}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      if (data.complaint?.id !== id || data.complaint.status !== status) throw new Error("Status update could not be confirmed. Refresh jobs.");
      setJobs((previous) => previous.map((job) => job.id === id ? { ...job, ...data.complaint } : job));
      return data.complaint;
    } finally {
      saving.current = false;
      refresh();
    }
  }
  return { jobs, loading, refreshing, error, refresh, updateStatus };
}

function dateLabel(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-IN");
}
function JobCards({ jobs, onOpen }) {
  return <section className="ss-complaint-grid" aria-label="Your assigned jobs">{jobs.map((job) => <article className="ss-panel ss-complaint-card" key={job.id}>
    <div className="ss-product-card-top"><span className="ss-complaint-number">{job.complaintNumber}</span><StatusBadge status={job.status}/></div>
    <h3>{job.title}</h3><p className="ss-complaint-device">{job.product?.brand} {job.product?.name}</p>
    <p className="ss-admin-customer">Customer: {job.customer?.name || "Not available"}</p>
    <p className="ss-complaint-excerpt">{job.description}</p>
    <div className="ss-complaint-meta"><span>Priority: {job.priority}</span><span>{job.status === "COMPLETED" ? "Repair completed" : "Assigned to you"}</span></div>
    <button type="button" className="ss-button ss-button-secondary" onClick={() => onOpen(job.id)}>View job →</button>
  </article>)}</section>;
}
function JobDetail({ job, state, onBack }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => { setConfirm(false); }, [job.status]);
  const nextStatus = job.status === "ASSIGNED" ? "IN_PROGRESS" : job.status === "IN_PROGRESS" ? "COMPLETED" : null;
  async function update() {
    if (inFlight.current || !nextStatus || state.error || state.refreshing) return;
    inFlight.current = true; setSaving(true); setError(""); setNotice("");
    try { await state.updateStatus(job.id, nextStatus); setConfirm(false); setNotice(nextStatus === "COMPLETED" ? "Repair marked as completed." : "Repair started successfully."); }
    catch (err) { setError(err.message); }
    finally { inFlight.current = false; setSaving(false); }
  }
  const blocked = saving || state.refreshing || Boolean(state.error);
  return <section className="ss-panel ss-admin-detail">
    <div className="ss-product-buttons"><button type="button" className="ss-button ss-button-secondary" disabled={saving} onClick={onBack}>← Back to jobs</button></div>
    <div className="ss-complaint-title"><div><span className="ss-complaint-number">{job.complaintNumber}</span><h2>{job.title}</h2><p>{job.product?.brand} {job.product?.name}</p></div><StatusBadge status={job.status}/></div>
    <dl className="ss-complaint-facts">{[["Customer", job.customer?.name], ["Phone", job.customer?.phone], ["Email", job.customer?.email], ["Priority", job.priority], ["Model", job.product?.modelNumber], ["Serial number", job.product?.serialNumber], ["Registered on", dateLabel(job.createdAt)], ["Last updated", dateLabel(job.updatedAt)], ...(job.status === "COMPLETED" ? [["Completed on", dateLabel(job.completedAt)]] : [])].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl>
    <div className="ss-problem-description"><h3>Problem description</h3><p>{job.description}</p></div>
    {notice && <div className="ss-product-alert success" role="status">{notice}</div>}
    {error && <div className="ss-product-alert error" role="alert">{error}</div>}
    <div className="ss-tech-actions">
      {job.status === "ASSIGNED" ? <button type="button" className="ss-button" disabled={blocked} onClick={update}>{saving ? "Starting…" : "Start Repair"}</button> : job.status === "IN_PROGRESS" ? confirm ? <div className="ss-tech-confirm"><p>Confirm that the repair is finished. This will mark the complaint as Completed.</p><div className="ss-product-buttons"><button type="button" className="ss-button" disabled={blocked} onClick={update}>{saving ? "Saving…" : "Confirm Completion"}</button><button type="button" className="ss-button ss-button-secondary" disabled={saving} onClick={() => setConfirm(false)}>Keep In Progress</button></div></div> : <button type="button" className="ss-button" disabled={blocked} onClick={() => setConfirm(true)}>Mark Completed</button> : <p>This job is {String(job.status || "unknown").toLowerCase().replaceAll("_", " ")}. No repair action is available.</p>}
    </div>
  </section>;
}
export default function TechnicianWorkspace({ mode, state, user, onNavigate }) {
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const selected = state.jobs.find((job) => job.id === selectedId);
  const active = state.jobs.filter((job) => ["ASSIGNED", "IN_PROGRESS"].includes(job.status));
  const query = search.trim().toLowerCase();
  const base = mode === "Completed Repairs" ? state.jobs.filter((job) => job.status === "COMPLETED") : mode === "Repair Progress" ? active : state.jobs;
  const filtered = base.filter((job) => (status === "ALL" || job.status === status) && (!query || [job.title, job.complaintNumber, job.product?.name, job.product?.brand, job.customer?.name].some((value) => String(value || "").toLowerCase().includes(query))));
  return <>
    <div className="ss-product-heading"><div><span className="ss-eyebrow">TECHNICIAN WORKSPACE</span><h2>{mode === "Overview" ? `Welcome back, ${user.name}!` : mode}</h2><p>View your assigned requests and keep repair progress up to date.</p></div><button type="button" className="ss-button ss-button-secondary" disabled={state.loading || state.refreshing} onClick={state.refresh}>{state.refreshing ? "Refreshing…" : "Refresh jobs"}</button></div>
    {state.error && <div className="ss-product-alert error" role="alert">{state.error}<button type="button" className="ss-button ss-button-secondary" disabled={state.refreshing} onClick={state.refresh}>Retry jobs</button></div>}
    {state.loading ? <section className="ss-panel ss-product-feedback" role="status">Loading your jobs…</section> : selected ? <JobDetail key={selected.id} job={selected} state={state} onBack={() => setSelectedId(null)}/> : state.error ? null : <>
      {selectedId !== null && <div className="ss-product-alert" role="status">This job is no longer in your assigned list.</div>}
      {mode === "Overview" ? <>
        <section className="ss-stats" aria-label="Technician summary">{[["Assigned Jobs", state.jobs.filter((job) => job.status === "ASSIGNED").length], ["In Progress", state.jobs.filter((job) => job.status === "IN_PROGRESS").length], ["Completed", state.jobs.filter((job) => job.status === "COMPLETED").length]].map(([label, count], i) => <article className="ss-stat" key={label}><span className={`ss-icon-tile tone-${i}`}>{["↗", "⚙", "✓"][i]}</span><div><h3>{label}</h3><strong aria-label={`${label} count`}>{count}</strong><small>Your service requests</small></div></article>)}</section>
        <section className="ss-admin-shortcuts" aria-label="Technician quick access">{["My Jobs", "Repair Progress", "Completed Repairs"].map((page) => <button type="button" className="ss-button" key={page} onClick={() => onNavigate(page)}>{page} →</button>)}</section>
        <div className="ss-section-heading"><div><h2>Active repairs</h2><p>Assigned and in progress requests needing your attention.</p></div></div>
        {active.length ? <JobCards jobs={active.slice(0, 4)} onOpen={setSelectedId}/> : <section className="ss-panel ss-empty ss-products-empty"><h3>No active repairs</h3><p>Requests will appear here when an Admin assigns them to you.</p></section>}
      </> : <>
        <div className="ss-admin-filters"><div><label htmlFor="tech-search">Search your jobs</label><input id="tech-search" type="search" placeholder="Complaint, customer or product" value={search} onChange={(event) => setSearch(event.target.value)}/></div>{mode !== "Completed Repairs" && <div><label htmlFor="tech-status">Status</label><select id="tech-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{(mode === "Repair Progress" ? ["ASSIGNED", "IN_PROGRESS"] : ["REGISTERED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div>}</div>
        <p className="ss-admin-result-count">{filtered.length} job{filtered.length === 1 ? "" : "s"}</p>
        {filtered.length ? <JobCards jobs={filtered} onOpen={setSelectedId}/> : <section className="ss-panel ss-empty ss-products-empty"><h3>No matching jobs</h3><p>{base.length ? "Try another search or filter." : mode === "Completed Repairs" ? "Completed repairs will appear here." : "No jobs are available in this view."}</p></section>}
      </>}
    </>}
  </>;
}
