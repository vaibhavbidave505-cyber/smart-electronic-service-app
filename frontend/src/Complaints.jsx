import { useCallback, useEffect, useRef, useState } from "react";

const STATUS_LABELS = { REGISTERED: "Registered", ASSIGNED: "Assigned", IN_PROGRESS: "In Progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export function StatusBadge({ status }) {
  const known = Object.hasOwn(STATUS_LABELS, status);
  return <span className={`ss-status ss-status-${known ? status.toLowerCase() : "unknown"}`}>{known ? STATUS_LABELS[status] : status || "Unknown status"}</span>;
}
function dateLabel(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
async function complaintRequest(apiBase, token, path = "", options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}/complaints${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(options.method === "POST" ? "Could not confirm the complaint submission. Refresh My Complaints before submitting again." : "Unable to reach the server. Check your connection and retry.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const err = new Error(data.message || (response.status === 403 ? "You do not have permission to access these complaints." : "Unable to complete the complaint request."));
    err.status = response.status;
    throw err;
  }
  return data;
}
export function useComplaints(apiBase, token, user, onExpired) {
  const [complaints, setComplaints] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(user.role === "CUSTOMER");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const expiredRef = useRef(onExpired);
  useEffect(() => { expiredRef.current = onExpired; }, [onExpired]);
  const request = useCallback(async (path = "", options = {}) => {
    try { return await complaintRequest(apiBase, token, path, options); }
    catch (err) { if (err.status === 401) expiredRef.current("Your session expired. Please sign in again."); throw err; }
  }, [apiBase, token]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (user.role !== "CUSTOMER") return;
    const controller = new AbortController();
    setRefreshing(true); setError("");
    request("", { signal: controller.signal }).then((data) => {
      if (!Array.isArray(data.complaints)) throw new Error("The server returned an invalid complaint list.");
      if (!controller.signal.aborted) { setComplaints(data.complaints); setLoaded(true); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setRefreshing(false); });
    return () => controller.abort();
  }, [request, user.id, user.role, revision]);
  useEffect(() => {
    if (user.role !== "CUSTOMER") return;
    const refreshVisible = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(refreshVisible, 30000);
    window.addEventListener("focus", refreshVisible);
    return () => { clearInterval(timer); window.removeEventListener("focus", refreshVisible); };
  }, [user.role, refresh]);
  const updated = useCallback((complaint) => {
    setComplaints((previous) => previous.map((item) => item.id === complaint.id ? complaint : item));
  }, []);
  function created(complaint) {
    setComplaints((previous) => [complaint, ...previous.filter((item) => item.id !== complaint.id)]);
    setLoaded(true); refresh();
  }
  const counts = {
    "Open Complaints": complaints.filter((item) => ["REGISTERED", "ASSIGNED", "IN_PROGRESS"].includes(item.status)).length,
    "In Progress": complaints.filter((item) => item.status === "IN_PROGRESS").length,
    Resolved: complaints.filter((item) => item.status === "COMPLETED").length,
  };
  return { complaints, loaded, refreshing, error, request, refresh, created, updated, counts };
}

export function RecentComplaints({ state, onOpen, onViewAll }) {
  return <article className="ss-panel"><div className="ss-panel-heading"><h2>Recent complaints</h2><button className="ss-text-button" type="button" onClick={onViewAll}>View all →</button></div>
    {state.error ? <div className="ss-product-alert error" role="alert">{state.error}<button type="button" onClick={state.refresh}>Retry</button></div> : !state.loaded ? <p className="ss-product-feedback" role="status">Loading complaints…</p> : !state.complaints.length ? <div className="ss-empty"><span className="ss-empty-icon" aria-hidden="true">＋</span><h3>No complaints yet</h3><p>Register a complaint when a device needs service.</p></div> : <div className="ss-recent-list">{state.complaints.slice(0, 4).map((complaint) => <button key={complaint.id} className="ss-recent-item" type="button" onClick={() => onOpen(complaint.id)}><span><small>{complaint.complaintNumber}</small><strong>{complaint.title}</strong><span>{complaint.product?.name || "Product"}</span></span><StatusBadge status={complaint.status}/></button>)}</div>}
  </article>;
}

function ComplaintForm({ state, productsState, onCreated, onCancel, onAddProduct }) {
  const [form, setForm] = useState({ productId: "", title: "", description: "", priority: "MEDIUM" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  function change(event) { setForm((previous) => ({ ...previous, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const productId = Number(form.productId);
    const title = form.title.trim(), description = form.description.trim();
    if (!Number.isInteger(productId) || productId <= 0 || !productsState.products.some((product) => Number(product.id) === productId)) { setError("Select one of your registered products."); return; }
    if (!title || !description) { setError("Enter a complaint title and description."); return; }
    if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(form.priority)) { setError("Select a valid priority."); return; }
    inFlight.current = true; setSaving(true); setError("");
    try {
      const data = await state.request("", { method: "POST", body: JSON.stringify({ productId, title, description, priority: form.priority }) });
      if (!data.complaint?.id) throw new Error("Submission could not be confirmed. Refresh My Complaints before submitting again.");
      onCreated(data.complaint);
    } catch (err) { setError(err.message); }
    finally { inFlight.current = false; setSaving(false); }
  }
  if (productsState.loading) return <section className="ss-panel"><p className="ss-product-feedback" role="status">Loading your products…</p><button className="ss-button ss-button-secondary" type="button" onClick={onCancel}>Back to complaints</button></section>;
  if (productsState.error) return <section className="ss-panel"><div className="ss-product-alert error" role="alert">{productsState.error}</div><button className="ss-button" type="button" onClick={productsState.refresh}>Retry products</button><button className="ss-button ss-button-secondary" type="button" onClick={onCancel}>Back to complaints</button></section>;
  if (!productsState.products.length) return <section className="ss-panel ss-empty ss-products-empty"><h3>Add a product first</h3><p>A service complaint must be linked to one of your registered products.</p><button className="ss-button" type="button" onClick={onAddProduct}>Add Product</button><button className="ss-button ss-button-secondary" type="button" onClick={onCancel}>Back to complaints</button></section>;
  return <section className="ss-panel ss-product-form"><div className="ss-product-heading"><div><span className="ss-eyebrow">SERVICE REQUEST</span><h2>Register a complaint</h2><p>Tell us which device needs help and describe the problem.</p></div></div><form onSubmit={submit} aria-busy={saving}>
    <fieldset disabled={saving}><legend className="ss-sr-only">Complaint information</legend><div className="ss-product-fields">
      <div className="ss-product-field"><label htmlFor="complaint-product">Product *</label><select id="complaint-product" name="productId" required value={form.productId} onChange={change}><option value="">Select your product</option>{productsState.products.map((product) => <option key={product.id} value={product.id}>{product.brand} — {product.name}{product.serialNumber ? ` (${product.serialNumber})` : ""}</option>)}</select></div>
      <div className="ss-product-field"><label htmlFor="complaint-priority">Priority *</label><select id="complaint-priority" name="priority" value={form.priority} onChange={change}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority} value={priority}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</option>)}</select></div>
      <div className="ss-product-field ss-field-wide"><label htmlFor="complaint-title">Complaint title *</label><input id="complaint-title" name="title" required placeholder="e.g. Laptop is not turning on" value={form.title} onChange={change}/></div>
      <div className="ss-product-field ss-field-wide"><label htmlFor="complaint-description">Describe the problem *</label><textarea id="complaint-description" name="description" required rows={5} placeholder="Explain what happened, when it started and any error messages." value={form.description} onChange={change}/></div>
    </div><p className="ss-product-hint">* Required fields. Select the priority that best describes your service need.</p></fieldset>
    {error && <div className="ss-product-alert error" role="alert">{error}</div>}
    <div className="ss-product-buttons"><button className="ss-button" type="submit" disabled={saving}>{saving && <span className="ss-loading-ring" aria-hidden="true"/>}{saving ? "Submitting…" : "Submit Complaint"}</button><button className="ss-button ss-button-secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button></div>
  </form></section>;
}

function ComplaintDetail({ id, state, onBack }) {
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [checkedAt, setCheckedAt] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    state.request(`/${encodeURIComponent(id)}`, { signal: controller.signal }).then((data) => {
      if (!data.complaint) throw new Error("The server did not return complaint details.");
      if (!controller.signal.aborted) { setComplaint(data.complaint); state.updated(data.complaint); setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, state.request, state.updated, retry]);
  useEffect(() => {
    const visibleRefresh = () => { if (!document.hidden) setRetry((value) => value + 1); };
    const interval = setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", visibleRefresh);
    return () => { clearInterval(interval); window.removeEventListener("focus", visibleRefresh); };
  }, []);
  const stages = ["REGISTERED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"];
  return <section className="ss-panel ss-complaint-detail"><div className="ss-product-buttons"><button className="ss-button ss-button-secondary" type="button" onClick={onBack}>← Back to complaints</button><button className="ss-button" type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Refresh status</button></div>
    {error ? <div className="ss-product-alert error" role="alert">{error}</div> : !complaint ? <p className="ss-product-feedback" role="status">Loading complaint details…</p> : <>
      <div className="ss-complaint-title"><div><span className="ss-complaint-number">{complaint.complaintNumber}</span><h2>{complaint.title}</h2><p>{complaint.product?.brand} {complaint.product?.name}</p></div><StatusBadge status={complaint.status}/></div>
      <section className="ss-repair-progress" aria-label="Repair progress"><h3>Repair tracking</h3>{complaint.status === "CANCELLED" ? <p>This service request is cancelled.</p> : <ol>{stages.map((status, index) => <li key={status} className={complaint.status === status ? "current" : ""} aria-current={complaint.status === status ? "step" : undefined}><span>{String(index + 1).padStart(2, "0")}</span><strong>{STATUS_LABELS[status]}</strong>{complaint.status === status && <small>Current status</small>}</li>)}</ol>}{complaint.status !== "CANCELLED" && <p>{stages.includes(complaint.status) ? "Highlighted stage shows the current service status." : "The current status is shown above."}</p>}</section>
      <dl className="ss-complaint-facts"><div><dt>Priority</dt><dd>{complaint.priority || "Not available"}</dd></div><div><dt>Registered on</dt><dd>{dateLabel(complaint.createdAt)}</dd></div>{complaint.updatedAt && <div><dt>Last service update</dt><dd>{dateLabel(complaint.updatedAt)}</dd></div>}{complaint.completedAt && <div><dt>Completed on</dt><dd>{dateLabel(complaint.completedAt)}</dd></div>}</dl>
      <div className="ss-problem-description"><h3>Problem description</h3><p>{complaint.description}</p></div>
      <p className="ss-tracking-note" role="status">{loading ? "Checking the latest status…" : `Status checked at ${checkedAt}.`} Refreshes every 30 seconds while this tab is active.</p>
    </>}
  </section>;
}

export default function ComplaintManagement({ state, productsState, initiallyCreating = false, initialId = null, onAddProduct }) {
  const [creating, setCreating] = useState(initiallyCreating);
  const [selectedId, setSelectedId] = useState(initialId);
  const [filter, setFilter] = useState("ALL");
  const [notice, setNotice] = useState("");
  if (creating) return <ComplaintForm state={state} productsState={productsState} onAddProduct={onAddProduct} onCancel={() => setCreating(false)} onCreated={(complaint) => { state.created(complaint); setCreating(false); setSelectedId(complaint.id); setNotice(`Complaint registered successfully: ${complaint.complaintNumber}`); }}/>;
  if (selectedId !== null) return <>{notice && <div className="ss-product-alert success" role="status">{notice}</div>}<ComplaintDetail id={selectedId} state={state} onBack={() => { setSelectedId(null); state.refresh(); }}/></>;
  const filtered = filter === "ALL" ? state.complaints : state.complaints.filter((complaint) => complaint.status === filter);
  return <>
    <div className="ss-product-heading"><div><span className="ss-eyebrow">SERVICE REQUESTS</span><h2>My Complaints</h2><p>View your requests and track the latest repair status.</p></div><div className="ss-product-buttons"><button className="ss-button ss-button-secondary" type="button" disabled={state.refreshing} onClick={state.refresh}>Refresh complaints</button><button className="ss-button" type="button" onClick={() => { setCreating(true); setNotice(""); }}>+ New Complaint</button></div></div>
    <div className="ss-complaint-filter"><label htmlFor="complaint-filter">Status</label><select id="complaint-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All statuses</option>{Object.entries(STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>{state.loaded && !state.error && <span>{filtered.length} request{filtered.length === 1 ? "" : "s"}</span>}</div>
    {state.error ? <section className="ss-panel"><div className="ss-product-alert error" role="alert">{state.error}</div><button className="ss-button" type="button" onClick={state.refresh}>Retry complaints</button></section> : !state.loaded ? <section className="ss-panel ss-product-feedback" role="status">Loading complaints…</section> : !filtered.length ? <section className="ss-panel ss-empty ss-products-empty"><h3>{state.complaints.length ? "No requests with this status" : "No complaints yet"}</h3><p>{state.complaints.length ? "Choose another status to see your service requests." : "Create a service request for one of your registered products."}</p>{!state.complaints.length && <button className="ss-button" type="button" onClick={() => setCreating(true)}>Register your first complaint</button>}</section> : <section className="ss-complaint-grid" aria-label="Your complaints">{filtered.map((complaint) => <article className="ss-panel ss-complaint-card" key={complaint.id}><div className="ss-product-card-top"><span className="ss-complaint-number">{complaint.complaintNumber}</span><StatusBadge status={complaint.status}/></div><h3>{complaint.title}</h3><p className="ss-complaint-device">{complaint.product?.brand} {complaint.product?.name || "Product"}</p><p className="ss-complaint-excerpt">{complaint.description}</p><div className="ss-complaint-meta"><span>Priority: {complaint.priority}</span><span>{dateLabel(complaint.createdAt)}</span></div><button className="ss-button ss-button-secondary" type="button" onClick={() => setSelectedId(complaint.id)}>View & track →</button></article>)}</section>}
  </>;
}
