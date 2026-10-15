import { useCallback, useEffect, useRef, useState } from "react";

async function productRequest(apiBase, token, path = "", options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}/products${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(options.method === "POST" ? "Could not confirm the save. Refresh My Products before trying again." : "Unable to reach the server. Please check your connection and retry.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || (response.status === 403 ? "You do not have permission to access these products." : "Unable to complete the product request."));
    error.status = response.status;
    throw error;
  }
  return data;
}

export function useProducts(apiBase, token, user, onExpired) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(user.role === "CUSTOMER");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const expiredRef = useRef(onExpired);
  useEffect(() => { expiredRef.current = onExpired; }, [onExpired]);
  const request = useCallback(async (path = "", options = {}) => {
    try { return await productRequest(apiBase, token, path, options); }
    catch (err) {
      if (err.status === 401) expiredRef.current("Your session expired. Please sign in again.");
      throw err;
    }
  }, [apiBase, token]);
  useEffect(() => {
    if (user.role !== "CUSTOMER") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request("", { signal: controller.signal }).then((data) => {
      if (!Array.isArray(data.products)) throw new Error("The server returned an invalid product list.");
      if (!controller.signal.aborted) setProducts(data.products);
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [request, user.id, user.role, revision]);
  function refresh() { setRevision((value) => value + 1); }
  function created(product) {
    setProducts((previous) => [product, ...previous.filter((item) => item.id !== product.id)]);
    refresh();
  }
  return { products, loading, error, refresh, created, request };
}

function dateLabel(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
const EMPTY_FORM = { category: "", brand: "", name: "", modelNumber: "", serialNumber: "", purchaseDate: "", warrantyEnd: "", billUrl: "" };
function ProductForm({ request, onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
    if (!body.category || !body.brand || !body.name) { setError("Enter category, brand and product name."); return; }
    if (body.purchaseDate && body.warrantyEnd && body.warrantyEnd < body.purchaseDate) { setError("Warranty end date cannot be earlier than purchase date."); return; }
    if (body.billUrl && !/^https?:\/\//i.test(body.billUrl)) { setError("Bill link must start with https:// or http://."); return; }
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const data = await request("", { method: "POST", body: JSON.stringify(body) });
      if (!data.product || !data.product.id) throw new Error("The save response could not be confirmed. Refresh My Products before trying again.");
      onCreated(data.product);
    } catch (err) { setError(err.message); }
    finally { inFlight.current = false; setSaving(false); }
  }
  return <section className="ss-panel ss-product-form"><div className="ss-product-heading"><div><span className="ss-eyebrow">PRODUCT REGISTRATION</span><h2>Add a product</h2><p>Keep your device and warranty information in one place.</p></div></div><form onSubmit={submit} aria-busy={saving}>
    <fieldset disabled={saving}><legend className="ss-sr-only">Product information</legend><div className="ss-product-fields">
      {[["category", "Category", "e.g. Laptop", true], ["brand", "Brand", "e.g. Dell", true], ["name", "Product name", "e.g. Inspiron 14", true], ["modelNumber", "Model number", "Optional", false], ["serialNumber", "Serial number", "Optional", false], ["purchaseDate", "Purchase date", "", false], ["warrantyEnd", "Warranty end date", "", false], ["billUrl", "Bill / invoice link", "https://example.com/invoice", false]].map(([key,label,placeholder,required]) => <div className="ss-product-field" key={key}><label htmlFor={`product-${key}`}>{label}{required && <span aria-hidden="true"> *</span>}</label><input id={`product-${key}`} name={key} type={key.includes("Date") || key === "warrantyEnd" ? "date" : key === "billUrl" ? "url" : "text"} required={required} placeholder={placeholder} value={form[key]} list={key === "category" ? "ss-product-categories" : undefined} onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))}/></div>)}
    </div><datalist id="ss-product-categories">{["Laptop", "Smartphone", "Television", "Refrigerator", "Washing Machine", "Air Conditioner", "Headphones"].map((value) => <option key={value} value={value}/>)}</datalist><p className="ss-product-hint">* Required fields. The invoice link is optional; file uploads are not available here.</p></fieldset>
    {error && <div className="ss-product-alert error" role="alert">{error}</div>}
    <div className="ss-product-buttons"><button className="ss-button" type="submit" disabled={saving}>{saving && <span className="ss-loading-ring" aria-hidden="true"/>}{saving ? "Saving product…" : "Save Product"}</button><button className="ss-button ss-button-secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</button></div>
  </form></section>;
}

function ProductDetail({ id, request, onBack }) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setProduct(null);
    request(`/${encodeURIComponent(id)}`, { signal: controller.signal }).then((data) => {
      if (!data.product) throw new Error("Product details were not returned by the server.");
      if (!controller.signal.aborted) setProduct(data.product);
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, request, retry]);
  return <section className="ss-panel ss-product-detail"><button className="ss-button ss-button-secondary" type="button" onClick={onBack}>← Back to products</button>
    {loading ? <p className="ss-product-feedback" role="status">Loading product details…</p> : error ? <div className="ss-product-alert error" role="alert">{error}<button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div> : product && <><span className="ss-product-category">{product.category}</span><h2>{product.name}</h2><p>{product.brand}</p><dl>{[["Model number", product.modelNumber || "Not provided"], ["Serial number", product.serialNumber || "Not provided"], ["Purchase date", dateLabel(product.purchaseDate)], ["Warranty end date", dateLabel(product.warrantyEnd)]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{/^https?:\/\//i.test(product.billUrl || "") && <a className="ss-product-invoice" href={product.billUrl} target="_blank" rel="noopener noreferrer">Open invoice link ↗</a>}</>}
  </section>;
}

export default function ProductManagement({ state, initiallyAdding = false }) {
  const [adding, setAdding] = useState(initiallyAdding);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");
  if (adding) return <ProductForm request={state.request} onCancel={() => setAdding(false)} onCreated={(product) => { state.created(product); setAdding(false); setNotice("Product registered successfully."); }}/>;
  if (selectedId !== null) return <ProductDetail id={selectedId} request={state.request} onBack={() => setSelectedId(null)}/>;
  return <>
    <div className="ss-product-heading"><div><span className="ss-eyebrow">YOUR DEVICES</span><h2>My Products</h2><p>View your registered devices and warranty information.</p></div><div className="ss-product-buttons"><button className="ss-button ss-button-secondary" type="button" disabled={state.loading} onClick={state.refresh}>Refresh</button><button className="ss-button" type="button" onClick={() => { setNotice(""); setAdding(true); }}>+ Add Product</button></div></div>
    {notice && <div className="ss-product-alert success" role="status">{notice}</div>}
    {state.loading ? <section className="ss-panel ss-product-feedback" role="status">Loading your products…</section> : state.error ? <section className="ss-panel"><div className="ss-product-alert error" role="alert">{state.error}</div><button className="ss-button" type="button" onClick={state.refresh}>Retry</button></section> : state.products.length === 0 ? <section className="ss-panel ss-empty ss-products-empty"><span className="ss-empty-icon" aria-hidden="true">＋</span><h3>No products registered yet</h3><p>Add your first device to keep its product and warranty details organized.</p><button className="ss-button" type="button" onClick={() => setAdding(true)}>Add your first product</button></section> : <section className="ss-product-grid" aria-label="Your products">{state.products.map((product) => <article className="ss-panel ss-product-card" key={product.id}><div className="ss-product-card-top"><span className="ss-product-category">{product.category}</span><span className="ss-product-brand">{product.brand}</span></div><h3>{product.name}</h3><p className="ss-product-model">{product.modelNumber || "Model not provided"}</p><dl><div><dt>Serial number</dt><dd>{product.serialNumber || "Not provided"}</dd></div><div><dt>Warranty ends</dt><dd>{dateLabel(product.warrantyEnd)}</dd></div></dl><button className="ss-button ss-button-secondary" type="button" onClick={() => setSelectedId(product.id)}>View details →</button></article>)}</section>}
  </>;
}
