
import { useEffect, useState } from "react";
import "./App.css";
import authDevices from "./assets/auth-devices.png";
import ProductManagement, { useProducts } from "./Products.jsx";
import ComplaintManagement, { useComplaints, RecentComplaints } from "./Complaints.jsx";
import AdminWorkspace, { useAdmin } from "./Admin.jsx";
import TechnicianWorkspace, { useTechnician } from "./Technician.jsx";

const API_URL = `${(import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "")}/auth`;
const SESSION_KEY = "smartserve.accessToken";
const DASHBOARDS = {
  CUSTOMER: { title: "Customer Dashboard", description: "Manage your electronics, register service complaints, and track repairs.", cards: [["📦", "My Products", "View and manage your registered electronics."], ["📝", "Register Complaint", "Submit a service request for your products."], ["🔧", "Track Repair", "Check the latest service status."]] },
  ADMIN: { title: "Admin Dashboard", description: "Manage service complaints and coordinate your technician team.", cards: [["📋", "All Complaints", "Review and filter customer service requests."], ["👥", "Technicians", "View technician availability and specializations."], ["🔀", "Assignments", "Assign complaints to available technicians."]] },
  TECHNICIAN: { title: "Technician Dashboard", description: "View your assigned jobs and manage repair progress.", cards: [["🧰", "My Jobs", "View complaints assigned to you."], ["⚙️", "Repair Progress", "Start work on your assigned repairs."], ["✅", "Completed Repairs", "Review jobs you have completed."]] },
};
function readToken() {
  try { return sessionStorage.getItem(SESSION_KEY) || ""; }
  catch { return ""; }
}
function storeToken(token) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* Authentication still works in memory when storage is unavailable. */ }
}
async function fetchCurrentUser(token, signal) {
  const response = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Unable to verify your session.");
    error.status = response.status;
    throw error;
  }
  if (!data.user || !Object.hasOwn(DASHBOARDS, data.user.role)) {
    const error = new Error("Your account role is not supported. Please sign in again.");
    error.status = 403;
    throw error;
  }
  return data.user;
}


function Icon({ name, size = 20, ...props }) {
  const paths = {
    mail: "M3 5h18v14H3z m0 0 9 7 9-7",
    lock: "M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3",
    login: "M14 3h7v18h-7 M3 12h13 m-4-4 4 4-4 4",
    headset: "M4 13v-2a8 8 0 0 1 16 0v2 M4 12H2v7h4v-7H4 M20 12h2v7h-4v-7h2 M20 19v3h-7",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    box: "m12 3 9 5-9 5-9-5 9-5z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5",
    file: "M14 2H5v20h14V7l-5-5z M14 2v5h5 M8 12h8 M8 16h5",
    tool: "M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3z",
    check: "m5 12 4 4 10-10",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.9 M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
    arrow: "M5 12h14 m-5-5 5 5-5 5",
    logout: "M9 3H3v18h6 M9 12h12 m-4-4 4 4-4 4",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    close: "m6 6 12 12 M18 6 6 18",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z m-4 9 3 3 5-5",
    plus: "M12 5v14 M5 12h14",
    user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2 M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.grid} /></svg>;
}

function DeviceIllustration() {
  return (
    <svg className="ss-devices" viewBox="0 0 400 240" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ss-screen" x1="75" y1="25" x2="275" y2="185" gradientUnits="userSpaceOnUse"><stop stopColor="#9585ff"/><stop offset=".5" stopColor="#5645d5"/><stop offset="1" stopColor="#24165f"/></linearGradient>
        <linearGradient id="ss-metal" x1="40" y1="180" x2="300" y2="205" gradientUnits="userSpaceOnUse"><stop stopColor="#f1edff"/><stop offset="1" stopColor="#9696cc"/></linearGradient>
      </defs>
      <ellipse cx="214" cy="218" rx="168" ry="13" fill="#100b37" opacity=".2"/>
      <circle cx="214" cy="120" r="107" fill="white" opacity=".04"/>
      <rect x="57" y="32" width="239" height="151" rx="10" fill="#171d39" stroke="#a7a3d8" strokeWidth="3" transform="rotate(-5 57 32)"/>
      <path d="m66 40 221-19 11 127-221 19z" fill="url(#ss-screen)"/>
      <path d="m67 41 142 93 79-111 M81 162l95-103 118 73" stroke="#d8ceff" strokeWidth="18" opacity=".18"/>
      <path d="m57 183 239-21 27 28c4 5 0 9-7 10L51 219c-8 1-13-3-8-9z" fill="url(#ss-metal)"/>
      <path d="m153 197 77-6 7 9-88 7z" fill="#9f9dc8"/>
      <rect x="275" y="98" width="63" height="115" rx="12" fill="#191b38" stroke="#c1b6ee" strokeWidth="3" transform="rotate(9 275 98)"/>
      <rect x="281" y="104" width="51" height="102" rx="8" fill="url(#ss-screen)" transform="rotate(9 281 104)"/>
      <path d="M349 137v-18a28 28 0 0 1 56 0v18" stroke="#151b39" strokeWidth="13" transform="translate(-25 38)"/>
      <rect x="313" y="164" width="19" height="43" rx="8" fill="#222747" stroke="#8f8cb7" strokeWidth="2"/>
      <rect x="367" y="164" width="19" height="43" rx="8" fill="#222747" stroke="#8f8cb7" strokeWidth="2"/>
      <circle cx="56" cy="78" r="4" fill="#c9bfff"/>
      <path d="M345 46v16 M337 54h16" stroke="#d4cbff" strokeWidth="2"/>
    </svg>
  );
}

function ServiceDashboard({ user, token, onLogout }) {
  const [page, setPage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const productsState = useProducts(API_URL.replace(/\/auth$/, ""), token, user, onLogout);
  const complaintsState = useComplaints(API_URL.replace(/\/auth$/, ""), token, user, onLogout);
  const adminState = useAdmin(API_URL.replace(/\/auth$/, ""), token, user, onLogout);
  const technicianState = useTechnician(API_URL.replace(/\/auth$/, ""), token, user, onLogout);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const dashboard = DASHBOARDS[user.role];
  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();
  const iconNames = user.role === "ADMIN" ? ["file", "users", "tool"] : user.role === "TECHNICIAN" ? ["file", "tool", "check"] : ["box", "file", "tool"];
  const initials = (user.name || "User").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const navigation = [["Dashboard", "grid"], ...dashboard.cards.map((card, i) => [card[1], iconNames[i]]), ...(user.role === "CUSTOMER" ? [["My Complaints", "file"]] : []), ["My Profile", "user"]];
  const summary = user.role === "CUSTOMER" ? [["My Products", "box"], ["Open Complaints", "file"], ["In Progress", "tool"], ["Resolved", "check"]] : user.role === "ADMIN" ? [["All Complaints", "file"], ["Technicians", "users"], ["Unassigned", "tool"], ["Resolved", "check"]] : [["Assigned Jobs", "file"], ["In Progress", "tool"], ["Completed", "check"]];
  function navigate(next) { setSelectedComplaint(null); setPage(next); setMenuOpen(false); }
  function openComplaint(id) { setSelectedComplaint(id); setPage("Track Repair"); setMenuOpen(false); }
  function summaryInfo(label) {
    if (user.role !== "CUSTOMER") return { count: "—", note: "Coming soon", aria: "Count unavailable" };
    if (label === "My Products") {
      const available = !productsState.loading && !productsState.error;
      return { count: available ? productsState.products.length : "—", note: productsState.loading ? "Loading…" : productsState.error ? "Unable to load" : "Registered devices", aria: available ? "Product count" : "Count unavailable" };
    }
    const available = complaintsState.loaded && !complaintsState.error;
    return { count: available ? complaintsState.counts[label] : "—", note: complaintsState.error ? "Unable to load" : !complaintsState.loaded ? "Loading…" : complaintsState.refreshing ? "Updating…" : label === "Open Complaints" ? "Active service requests" : label === "In Progress" ? "Repairs in progress" : "Completed requests", aria: available ? `${label} count` : "Count unavailable" };
  }
  return (
    <div className="ss-app">
      {menuOpen && <button className="ss-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside id="ss-navigation" className={`ss-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="ss-brand"><span className="ss-brand-mark">ϟ</span><div><strong>SMART<span>SERVE</span></strong><small>Your devices. Our care.</small></div><button className="ss-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><Icon name="close" /></button></div>
        <div className="ss-nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(([label, icon]) => <button key={label} type="button" className={`ss-nav-item ${page === label || (page === "Add Product" && label === "My Products") ? "active" : ""}`} aria-current={page === label || (page === "Add Product" && label === "My Products") ? "page" : undefined} onClick={() => navigate(label)}><Icon name={icon}/><span>{label}</span>{page === label && <span className="ss-nav-dot"/>}</button>)}
        </nav>
        <div className="ss-sidebar-bottom"><div className="ss-support"><Icon name="shield"/><strong>Service made simple</strong><p>One place for your devices and service requests.</p></div><button className="ss-nav-item ss-logout" type="button" onClick={() => onLogout()}><Icon name="logout"/><span>Logout</span></button><small className="ss-copyright">© {new Date().getFullYear()} SmartServe</small></div>
      </aside>
      <div className="ss-workspace">
        <header className="ss-topbar"><div className="ss-topbar-title"><button className="ss-menu" type="button" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="ss-navigation" onClick={() => setMenuOpen(true)}><Icon name="menu"/></button><div><span className="ss-breadcrumb">SmartServe / {roleLabel}</span><h1>{page === "Dashboard" ? dashboard.title : page === "Add Product" ? "My Products" : page}</h1></div></div><button className="ss-account" type="button" onClick={() => navigate("My Profile")} aria-label="View my profile"><span className="ss-avatar">{initials}</span><span className="ss-account-name"><strong>{user.name}</strong><small>{roleLabel} account</small></span></button></header>
        <main className="ss-main">
          {user.role === "ADMIN" && ["Dashboard", "All Complaints", "Technicians", "Assignments"].includes(page) ? <AdminWorkspace key={page} mode={page === "Dashboard" ? "Overview" : page} state={adminState} onNavigate={navigate}/> : user.role === "TECHNICIAN" && ["Dashboard", "My Jobs", "Repair Progress", "Completed Repairs"].includes(page) ? <TechnicianWorkspace key={page} mode={page === "Dashboard" ? "Overview" : page} state={technicianState} user={user} onNavigate={navigate}/> : page === "Dashboard" ? <>
            <section className="ss-hero"><div className="ss-hero-copy"><span className="ss-eyebrow">YOUR SERVICE WORKSPACE</span><h2>Welcome back, {user.name}!</h2><p>{dashboard.description}</p><span className="ss-hero-tag"><Icon name="shield" size={15}/> Connected to your account</span></div><DeviceIllustration/></section>
            <section className="ss-stats" aria-label="Service summary">{summary.map(([label, icon], i) => { const info = summaryInfo(label); return <article className="ss-stat" key={label}><span className={`ss-icon-tile tone-${i}`}><Icon name={icon} size={24}/></span><div><h3>{label}</h3><strong aria-label={info.aria}>{info.count}</strong><small>{info.note}</small></div></article>; })}</section>
            <div className="ss-section-heading"><div><h2>Quick access</h2><p>Everything you need for a smoother service experience.</p></div><span className="ss-section-tag">{roleLabel} workspace</span></div>
            {user.role === "CUSTOMER" && <div className="ss-dashboard-product-action"><button type="button" className="ss-button" onClick={() => navigate("Add Product")}><Icon name="plus" size={17}/> Add Product</button>{productsState.error && <span role="status">Product summary unavailable. Open My Products to retry.</span>}</div>}
            <section className="ss-actions">{dashboard.cards.map(([, title, description], i) => <button type="button" className="ss-action" key={title} onClick={() => navigate(title)}><span className="ss-action-top"><span className={`ss-icon-tile tone-${i}`}><Icon name={iconNames[i]} size={24}/></span><Icon name="arrow"/></span><h3>{title}</h3><p>{description}</p><span className="ss-action-link">Explore <Icon name="arrow" size={16}/></span></button>)}</section>
            <section className="ss-panels">{user.role === "CUSTOMER" ? <RecentComplaints state={complaintsState} onOpen={openComplaint} onViewAll={() => navigate("My Complaints")}/> : <article className="ss-panel"><div className="ss-panel-heading"><h2><Icon name="file"/> {user.role === "TECHNICIAN" ? "Assigned jobs" : "Recent complaints"}</h2><span className="ss-pill">Coming soon</span></div><div className="ss-empty"><span className="ss-empty-icon"><Icon name="file" size={28}/></span><h3>Your next service step, simplified</h3><p>{user.role === "ADMIN" ? "Complaint management and technician assignment will be available here soon." : "Assigned jobs and repair status updates will be available here soon."}</p></div></article>}<article className="ss-panel ss-guide"><span className="ss-eyebrow">HOW IT WORKS</span><h2>From request to resolution</h2><ol>{["Register your device", "Raise a service complaint", "Technician starts the repair", "Track completion"].map((step,i) => <li key={step}><span>{String(i+1).padStart(2,"0")}</span>{step}</li>)}</ol></article></section>
          </> : user.role === "CUSTOMER" && (page === "My Products" || page === "Add Product") ? <ProductManagement key={page} state={productsState} initiallyAdding={page === "Add Product"}/> : user.role === "CUSTOMER" && ["Register Complaint", "My Complaints", "Track Repair"].includes(page) ? <ComplaintManagement key={`${page}:${selectedComplaint ?? "list"}`} state={complaintsState} productsState={productsState} initiallyCreating={page === "Register Complaint"} initialId={selectedComplaint} onAddProduct={() => navigate("Add Product")}/> : page === "My Profile" ? <section className="ss-panel ss-profile"><span className="ss-avatar ss-avatar-large">{initials}</span><h2>{user.name}</h2><p>{roleLabel} account</p><dl><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Phone number</dt><dd>{user.phone || "Not provided"}</dd></div><div><dt>Account role</dt><dd>{roleLabel}</dd></div></dl><button type="button" className="ss-button" onClick={() => navigate("Dashboard")}>Back to dashboard</button></section> : <section className="ss-panel ss-feature"><span className="ss-empty-icon"><Icon name={navigation.find(([label]) => label === page)?.[1] || "grid"} size={32}/></span><span className="ss-pill">Coming soon</span><h2>{page}</h2><p>{dashboard.cards.find((card) => card[1] === page)?.[2]} This feature will be available soon.</p><button type="button" className="ss-button" onClick={() => navigate("Dashboard")}>Back to dashboard <Icon name="arrow" size={16}/></button></section>}
          <footer className="ss-footer"><span>SmartServe · Service made simple</span><span><Icon name="shield" size={14}/> {roleLabel} workspace</span></footer>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(readToken()));
  const [sessionError, setSessionError] = useState("");
  const [retrySession, setRetrySession] = useState(0);

  function logout(notice = "") {
    storeToken("");
    setToken("");
    setUser(null);
    setCheckingSession(false);
    setSessionError("");
    setMode("login");
    setShowPassword(false);
    setForm({ name: "", email: "", phone: "", password: "" });
    setMessage(notice);
    setSuccess(false);
  }

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let busy = false;
    async function verify() {
      if (busy) return;
      busy = true;
      try {
        const currentUser = await fetchCurrentUser(token, controller.signal);
        if (!controller.signal.aborted) {
          setUser(currentUser);
          setSessionError("");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setUser(null);
        if ([401, 403, 404].includes(error.status)) {
          logout("Your session ended or access was denied. Please sign in again.");
        } else {
          setSessionError("Unable to reach the server. Check your connection and retry.");
        }
      } finally {
        busy = false;
        if (!controller.signal.aborted) setCheckingSession(false);
      }
    }
    setCheckingSession(true);
    verify();
    const interval = setInterval(verify, 60000);
    const onFocus = () => verify();
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [token, retrySession]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  function updateField(e) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  function changeMode(nextMode) {
    if (loading) return;
    setMode(nextMode);
    setMessage("");
    setSuccess(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const endpoint = mode === "login" ? "/login" : "/register";

      const body =
        mode === "login"
          ? {
              email: form.email,
              password: form.password,
            }
          : form;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      setSuccess(true);

      if (mode === "login") {
        if (typeof data.token !== "string" || !data.token) {
          throw new Error("Login response did not include an access token.");
        }
        storeToken(data.token);
        setCheckingSession(true);
        setUser(null);
        setSessionError("");
        setToken(data.token);
        setForm((prev) => ({ ...prev, password: "" }));
        setShowPassword(false);
      } else {
        setMessage("Registration completed successfully! Please login.");
        setForm((prev) => ({ ...prev, password: "" }));
        setMode("login");
      }
    } catch (error) {
      setMessage(error.message || "Unable to connect to server");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  }
  
  if (token && (checkingSession || sessionError)) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-main" aria-live="polite" aria-busy={checkingSession}>
          <h1>⚡ SMARTSERVE</h1>
          <p role="status">{checkingSession ? "Verifying your session…" : sessionError}</p>
          {!checkingSession && <button type="button" onClick={() => setRetrySession((n) => n + 1)}>Retry</button>}
          <button type="button" className="logout-btn" onClick={() => logout()}>Back to Sign In</button>
        </section>
      </main>
    );
  }

  if (user && token) {
    return <ServiceDashboard user={user} token={token} onLogout={(notice) => logout(typeof notice === "string" ? notice : "")} />;
  }

  return (
    <main className="auth-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="auth-layout">
        <section className="brand-panel">
          <div className="brand-top">
            <span className="brand-logo" aria-hidden="true">ϟ</span>
            <span>SMART<span className="brand-accent">SERVE</span></span>
          </div>

          <div className="brand-content">
            <div className="eyebrow">
              <span className="live-dot" />
              THE SMARTER WAY TO MANAGE SERVICE
            </div>

            <h1>
              Simplify service.
              <br />
              <span>Elevate trust.</span>
            </h1>

            <p>
              Register your electronics, track warranty details,
              and manage service complaints — all in one
              beautifully simple platform.
            </p>

            <div className="feature-list">
              <div className="feature">
                <span className="feature-icon"><Icon name="box" /></span>
                <div>
                  <strong>Product Management</strong>
                  <small>Keep your devices organized.</small>
                </div>
              </div>

              <div className="feature">
                <span className="feature-icon"><Icon name="file" /></span>
                <div>
                  <strong>Complaint Tracking</strong>
                  <small>Manage your service requests.</small>
                </div>
              </div>

              <div className="feature">
                <span className="feature-icon"><Icon name="headset" /></span>
                <div>
                  <strong>Expert Support</strong>
                  <small>Coordinate service support.</small>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-device-art" aria-hidden="true">
            <img src={authDevices} alt="" width="1774" height="887" />
          </div>
          <div className="brand-bottom">
            <span>© 2026 SmartServe</span>
            <span>Service made simple ✦</span>
          </div>
        </section>

        <section className="form-panel">
          <div className="mobile-brand">
            <span className="brand-logo" aria-hidden="true">ϟ</span>
            SMART<span className="brand-accent">SERVE</span>
          </div>

          <div className="form-container">
            <div className="welcome-icon">✦</div>

            <div className="heading-area">
              <span className="heading-label">
                {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
              </span>

              <h2>
                {mode === "login"
                  ? "Sign in to your account"
                  : "Create your account"}
              </h2>

              <p>
                {mode === "login"
                  ? "Your service experience starts here."
                  : "Join us and manage your electronics with ease."}
              </p>
            </div>

            <div className="tab-switch">
              <button
                type="button"
                className={mode === "login" ? "selected" : ""}
                aria-pressed={mode === "login"}
                onClick={() => changeMode("login")}
              >
                <Icon name="login" size={18} /> Sign In
              </button>

              <button
                type="button"
                className={mode === "register" ? "selected" : ""}
                aria-pressed={mode === "register"}
                onClick={() => changeMode("register")}
              >
                <Icon name="user" size={18} /> Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {mode === "register" && (
                <>
                  <div className="field">
                    <label htmlFor="name">Full Name</label>
                    <input
                      id="name"
                      name="name"
                      placeholder="Enter your full name"
                      value={form.name}
                      onChange={updateField}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="phone">Phone Number</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="Enter your phone number"
                      value={form.phone}
                      onChange={updateField}
                    />
                  </div>
                </>
              )}

              <div className="field">
                <label htmlFor="email">Email Address</label>
                <div className="auth-input-wrap">
                <span className="auth-input-icon"><Icon name="mail" size={18} /></span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={updateField}
                  autoComplete="email"
                  required
                />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>

                <div className="password-wrap auth-input-wrap">
                  <span className="auth-input-icon"><Icon name="lock" size={18} /></span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={updateField}
                    autoComplete={
                      mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                className="primary-btn"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Sign In →"
                  : "Create Account →"}
              </button>

              {message && (
                <div
                  role="status"
                  className={`status-message ${
                    success ? "success" : "error"
                  }`}
                >
                  {success ? "✓ " : "⚠ "}
                  {message}
                </div>
              )}
            </form>

            <div className="form-footer">
              {mode === "login" ? (
                <p>
                  New to SmartServe?{" "}
                  <button onClick={() => changeMode("register")}>
                    Create an account
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button onClick={() => changeMode("login")}>
                    Sign in
                  </button>
                </p>
              )}
            </div>

            <div className="secure-note">
              <span>♢</span> Your service management portal
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
