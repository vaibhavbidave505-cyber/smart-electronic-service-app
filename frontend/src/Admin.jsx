import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "./Complaints.jsx";

export function useAdmin(apiBase, token, user, onExpired) {
  const [complaints, setComplaints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(user.role === "ADMIN");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const expiredRef = useRef(onExpired);
  useEffect(() => { expiredRef.current = onExpired; }, [onExpired]);
  const request = useCallback(async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`${apiBase}/technicians${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw new Error(options.method === "PUT" ? "Could not confirm the assignment. Refresh complaints before trying again." : "Unable to reach the server. Check your connection and retry.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      if (response.status === 401) expiredRef.current("Your session expired. Please sign in again.");
      throw new Error(data.message || (response.status === 403 ? "You do not have permission to access this Admin workspace." : "Unable to complete the Admin request."));
    }
    return data;
  }, [apiBase, token]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (user.role !== "ADMIN") return;
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([request("/complaints", { signal: controller.signal }), request("", { signal: controller.signal })]).then(([complaintData, technicianData]) => {
      if (!Array.isArray(complaintData.complaints) || !Array.isArray(technicianData.technicians)) throw new Error("The server returned an invalid Admin list.");
      if (!controller.signal.aborted) { setComplaints(complaintData.complaints); setTechnicians(technicianData.technicians); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request, user.id, user.role, revision]);
  async function assign(complaintId, technicianId) {
    const data = await request(`/complaints/${encodeURIComponent(complaintId)}/assign`, { method: "PUT", body: JSON.stringify({ technicianId }) });
    if (!data.complaint?.id) throw new Error("Assignment could not be confirmed. Refresh complaints before trying again.");
    setComplaints((previous) => previous.map((item) => item.id === data.complaint.id ? { ...item, ...data.complaint } : item));
    refresh();
    return data.complaint;
  }
  return { complaints, technicians, loading, error, refresh, assign };
}

function canAssign(complaint) { return ["REGISTERED", "ASSIGNED"].includes(complaint.status); }
function dateLabel(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
function technicianName(technician) { return technician?.user?.name || "Unnamed technician"; }
function activeJobs(complaints, technicianId) { return complaints.filter((complaint) => complaint.technicianId === technicianId && ["ASSIGNED", "IN_PROGRESS"].includes(complaint.status)).length; }
function AssignmentForm({ complaint, state, onDone, onBack }) {
  const [technicianId, setTechnicianId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const available = state.technicians.filter((technician) => technician.availability === true);
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const id = Number(technicianId);
    if (!Number.isInteger(id) || id <= 0 || !available.some((technician) => technician.id === id)) { setError("Select an available technician."); return; }
    inFlight.current = true; setSaving(true); setError("");
    try { const updated = await state.assign(complaint.id, id); onDone(updated); }
    catch (err) { setError(err.message); }
    finally { inFlight.current = false; setSaving(false); }
  }
  return <section className="ss-panel ss-admin-detail"><div className="ss-product-buttons"><button type="button" className="ss-button ss-button-secondary" disabled={saving} onClick={onBack}>← Back to complaints</button></div><div className="ss-complaint-title"><div><span className="ss-complaint-number">{complaint.complaintNumber}</span><h2>{complaint.title}</h2><p>{complaint.product?.brand} {complaint.product?.name}</p></div><StatusBadge status={complaint.status}/></div><dl className="ss-complaint-facts"><div><dt>Customer</dt><dd>{complaint.customer?.name || "Not available"}</dd></div><div><dt>Customer email</dt><dd>{complaint.customer?.email || "Not available"}</dd></div><div><dt>Priority</dt><dd>{complaint.priority}</dd></div><div><dt>Registered on</dt><dd>{dateLabel(complaint.createdAt)}</dd></div><div><dt>Current technician</dt><dd>{complaint.technician ? technicianName(complaint.technician) : "Not assigned"}</dd></div></dl><div className="ss-problem-description"><h3>Problem description</h3><p>{complaint.description}</p></div>
    {!canAssign(complaint) ? <p className="ss-admin-assignment-note">Assignments are available for Registered or Assigned requests. This request is {complaint.status.toLowerCase().replaceAll("_", " ")}.</p> : !available.length ? <div className="ss-product-alert error" role="status">No technicians are currently available. Check the technician directory and refresh.</div> : <form className="ss-admin-assign-form" onSubmit={submit} aria-busy={saving}><div className="ss-product-field"><label htmlFor="assign-technician">Available technician *</label><select id="assign-technician" required value={technicianId} disabled={saving} onChange={(event) => setTechnicianId(event.target.value)}><option value="">Choose a technician</option>{available.map((technician) => <option value={technician.id} key={technician.id}>{technicianName(technician)}{technician.specialization ? ` — ${technician.specialization}` : ""} ({activeJobs(state.complaints, technician.id)} active jobs)</option>)}</select></div><p className="ss-product-hint">Assigning changes the complaint status to Assigned.{complaint.technicianId ? " Choosing another technician replaces the current assignment." : ""}</p>{error && <div className="ss-product-alert error" role="alert">{error}</div>}<button className="ss-button" type="submit" disabled={saving}>{saving && <span className="ss-loading-ring" aria-hidden="true"/>}{saving ? "Assigning…" : complaint.technicianId ? "Reassign Technician" : "Assign Technician"}</button></form>}
  </section>;
}
function ComplaintCards({ complaints, onOpen }) {
  return <section className="ss-complaint-grid" aria-label="Admin complaints">{complaints.map((complaint) => <article className="ss-panel ss-complaint-card" key={complaint.id}><div className="ss-product-card-top"><span className="ss-complaint-number">{complaint.complaintNumber}</span><StatusBadge status={complaint.status}/></div><h3>{complaint.title}</h3><p className="ss-complaint-device">{complaint.product?.brand} {complaint.product?.name}</p><p className="ss-admin-customer">Customer: {complaint.customer?.name || "Not available"}</p><p className="ss-complaint-excerpt">{complaint.description}</p><div className="ss-complaint-meta"><span>Priority: {complaint.priority}</span><span>{dateLabel(complaint.createdAt)}</span></div><p className="ss-admin-current-tech">Technician: {complaint.technician ? technicianName(complaint.technician) : "Not assigned"}</p><button className="ss-button ss-button-secondary" type="button" onClick={() => onOpen(complaint.id)}>{canAssign(complaint) ? complaint.technicianId ? "View / reassign →" : "View / assign →" : "View details →"}</button></article>)}</section>;
}
function TechnicianDirectory({ state }) {
  if (!state.technicians.length) return <section className="ss-panel ss-empty ss-products-empty"><h3>No technician profiles yet</h3><p>Technician accounts need an associated technician profile before they can receive assignments.</p></section>;
  return <section className="ss-product-grid" aria-label="Technician directory">{state.technicians.map((technician) => <article className="ss-panel ss-technician-card" key={technician.id}><div className="ss-product-card-top"><span className="ss-avatar">{technicianName(technician).slice(0, 1).toUpperCase()}</span><span className={`ss-status ${technician.availability ? "ss-status-completed" : "ss-status-cancelled"}`}>{technician.availability ? "Available" : "Unavailable"}</span></div><h3>{technicianName(technician)}</h3><p>{technician.specialization || "Specialization not provided"}</p><dl><div><dt>Email</dt><dd>{technician.user?.email || "Not provided"}</dd></div><div><dt>Phone</dt><dd>{technician.user?.phone || "Not provided"}</dd></div>{technician.employeeId && <div><dt>Employee ID</dt><dd>{technician.employeeId}</dd></div>}<div><dt>Active assigned jobs</dt><dd>{activeJobs(state.complaints, technician.id)}</dd></div></dl></article>)}</section>;
}

export default function AdminWorkspace({ mode, state, onNavigate }) {
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const selected = state.complaints.find((complaint) => complaint.id === selectedId);
  const queue = state.complaints.filter((complaint) => complaint.status === "REGISTERED" && !complaint.technicianId);
  if (selected) return <AssignmentForm key={selected.id} complaint={selected} state={state} onBack={() => setSelectedId(null)} onDone={(complaint) => { setSelectedId(null); setNotice(`Technician assigned successfully to ${complaint.complaintNumber}.`); }}/>;
  const query = search.trim().toLowerCase();
  const filtered = (mode === "Assignments" ? state.complaints.filter(canAssign) : state.complaints).filter((complaint) => (status === "ALL" || complaint.status === status) && (priority === "ALL" || complaint.priority === priority) && (!query || [complaint.complaintNumber, complaint.title, complaint.customer?.name, complaint.product?.name, complaint.product?.brand].some((value) => String(value || "").toLowerCase().includes(query))));
  const title = mode === "Overview" ? "Service overview" : mode;
  return <>
    <div className="ss-product-heading"><div><span className="ss-eyebrow">ADMIN WORKSPACE</span><h2>{title}</h2><p>{mode === "Technicians" ? "View technician availability, specialization and workload." : mode === "Assignments" ? "Assign or reassign registered and assigned service requests." : "Review customer requests and coordinate the service team."}</p></div><button type="button" className="ss-button ss-button-secondary" disabled={state.loading} onClick={state.refresh}>Refresh Admin data</button></div>
    {notice && <div className="ss-product-alert success" role="status">{notice}</div>}
    {state.error && <div className="ss-product-alert error" role="alert">{state.error}</div>}
    {state.loading ? <section className="ss-panel ss-product-feedback" role="status">Loading Admin data…</section> : state.error ? <section className="ss-panel"><button type="button" className="ss-button" onClick={state.refresh}>Retry Admin data</button></section> : mode === "Overview" ? <>
      <section className="ss-stats" aria-label="Admin summary">{[["All Complaints", state.complaints.length], ["Technicians", state.technicians.length], ["Unassigned", queue.length], ["Resolved", state.complaints.filter((complaint) => complaint.status === "COMPLETED").length]].map(([label,count],i) => <article className="ss-stat" key={label}><span className={`ss-icon-tile tone-${i}`}>{i === 0 ? "≡" : i === 1 ? "♙" : i === 2 ? "↗" : "✓"}</span><div><h3>{label}</h3><strong aria-label={`${label} count`}>{count}</strong><small>{label === "Unassigned" ? "Registered requests" : "Service records"}</small></div></article>)}</section>
      <section className="ss-admin-shortcuts" aria-label="Admin quick access">{["All Complaints", "Technicians", "Assignments"].map((page) => <button key={page} type="button" className="ss-button" onClick={() => onNavigate(page)}>{page} →</button>)}</section><div className="ss-section-heading"><div><h2>Unassigned requests</h2><p>Registered requests awaiting a technician.</p></div></div>{queue.length ? <ComplaintCards complaints={queue.slice(0,4)} onOpen={setSelectedId}/> : <section className="ss-panel ss-empty ss-products-empty"><h3>No unassigned requests</h3><p>There are no registered requests waiting for assignment.</p></section>}
    </> : mode === "Technicians" ? <TechnicianDirectory state={state}/> : <>
      <div className="ss-admin-filters"><div><label htmlFor="admin-search">Search requests</label><input id="admin-search" type="search" placeholder="Complaint, customer or product" value={search} onChange={(event) => setSearch(event.target.value)}/></div><div><label htmlFor="admin-status">Status</label><select id="admin-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{(mode === "Assignments" ? ["REGISTERED","ASSIGNED"] : ["REGISTERED","ASSIGNED","IN_PROGRESS","COMPLETED","CANCELLED"]).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div><div><label htmlFor="admin-priority">Priority</label><select id="admin-priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="ALL">All priorities</option>{["LOW","MEDIUM","HIGH","URGENT"].map((value) => <option key={value} value={value}>{value}</option>)}</select></div></div>
      <p className="ss-admin-result-count">{filtered.length} request{filtered.length === 1 ? "" : "s"}</p>{filtered.length ? <ComplaintCards complaints={filtered} onOpen={setSelectedId}/> : <section className="ss-panel ss-empty ss-products-empty"><h3>No matching complaints</h3><p>{state.complaints.length ? "Try another filter or search." : "Customer service requests will appear here after registration."}</p></section>}
    </>}
  </>;
}
