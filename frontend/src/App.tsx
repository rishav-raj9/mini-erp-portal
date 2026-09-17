import { useState, useEffect } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [tab, setTab] = useState<'customers' | 'products' | 'challans'>('challans');

  // Auth State
  const [email, setEmail] = useState('sales@erp.com');
  const [password, setPassword] = useState('password123');

  // Data States
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);
  const [error, setError] = useState('');

  // Form States
  const [newCust, setNewCust] = useState({ name: '', mobile: '', email: '', businessName: '', customerType: 'Retail', address: '', status: 'Lead' });
  const [newProd, setNewProd] = useState({ name: '', sku: '', category: '', unitPrice: 100, currentStock: 10, minStockAlert: 2, location: 'Bay 1' });
  const [challanCust, setChallanCust] = useState('');
  const [challanProd, setChallanProd] = useState('');
  const [challanQty, setChallanQty] = useState(1);

  const login = async (loginEmail = email) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (e: any) { alert(e.message); }
  };

  const fetchData = async () => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    try {
      const [c, p, ch] = await Promise.all([
        fetch(`${API_BASE}/customers`, { headers: h }).then(async (r) => {
          if (!r.ok) throw new Error('Unable to load customers');
          return r.json();
        }),
        fetch(`${API_BASE}/products`, { headers: h }).then(async (r) => {
          if (!r.ok) throw new Error('Unable to load products');
          return r.json();
        }),
        fetch(`${API_BASE}/challans`, { headers: h }).then(async (r) => {
          if (!r.ok) throw new Error('Unable to load challans');
          return r.json();
        })
      ]);
      setCustomers(Array.isArray(c) ? c : []);
      setProducts(Array.isArray(p) ? p : []);
      setChallans(Array.isArray(ch) ? ch : []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Something went wrong while loading data.');
      setToken('');
      localStorage.clear();
    }
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

  const addCustomer = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newCust)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to add customer');
      setError('');
      fetchData();
    } catch (e: any) {
      setError(e.message || 'Unable to add customer');
    }
  };

  const addProduct = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newProd)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to add product');
      setError('');
      fetchData();
    } catch (e: any) {
      setError(e.message || 'Unable to add product');
    }
  };

  const createChallan = async (status: 'Draft' | 'Confirmed') => {
    setError('');

    if (!challanCust || !challanProd) {
      setError('Please select both a customer and a product.');
      return;
    }

    const qty = Number(challanQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/challans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId: Number(challanCust),
          items: [{ productId: Number(challanProd), quantity: qty }],
          status
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to create challan');
      setError('');
      alert(`Challan ${status} created!`);
      fetchData();
    } catch (e: any) {
      setError(e.message || 'Unable to create challan');
    }
  };

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ padding: 40, width: 400, background: '#ffffff', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <h2 style={{ marginTop: 0, color: '#0f172a' }}>Mini ERP / CRM Login</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 15 }}>Click a quick-role button to log in:</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {['admin@erp.com', 'sales@erp.com', 'warehouse@erp.com'].map(em => (
              <button key={em} onClick={() => login(em)} style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#1e293b' }}>
                {em.split('@')[0].toUpperCase()}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); login(); }}>
            <input style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12, padding: 12, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
            <input style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16, padding: 12, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <button style={{ width: '100%', padding: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Log In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', display: 'flex', minHeight: '100vh', width: '100vw', margin: 0, background: '#f8fafc' }}>
      {/* Sidebar */}
      <div style={{ width: 240, background: '#0f172a', color: '#fff', padding: 24, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: 18 }}>Mini ERP Portal</h3>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px 0' }}>User: {user?.name} ({user?.role})</p>
        <hr style={{ borderColor: '#334155', margin: '0 0 20px 0' }} />
        <button onClick={() => setTab('customers')} style={{ display: 'block', width: '100%', padding: '12px 14px', margin: '6px 0', textAlign: 'left', background: tab === 'customers' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Customers CRM</button>
        <button onClick={() => setTab('products')} style={{ display: 'block', width: '100%', padding: '12px 14px', margin: '6px 0', textAlign: 'left', background: tab === 'products' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Inventory & Stock</button>
        <button onClick={() => setTab('challans')} style={{ display: 'block', width: '100%', padding: '12px 14px', margin: '6px 0', textAlign: 'left', background: tab === 'challans' ? '#2563eb' : 'transparent', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Sales Challans</button>
        <div style={{ marginTop: 'auto' }}>
          <button onClick={() => { setToken(''); localStorage.clear(); }} style={{ width: '100%', padding: 10, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Sign Out</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: 36, boxSizing: 'border-box', overflowY: 'auto' }}>
        {tab === 'customers' && (
          <div>
            <h2 style={{ color: '#0f172a', marginTop: 0 }}>Customer Management (CRM)</h2>
            <form onSubmit={addCustomer} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: '#fff', padding: 20, borderRadius: 8, marginBottom: 24, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <input placeholder="Name" required onChange={e => setNewCust({ ...newCust, name: e.target.value })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <input placeholder="Mobile" required onChange={e => setNewCust({ ...newCust, mobile: e.target.value })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <input placeholder="Email" required onChange={e => setNewCust({ ...newCust, email: e.target.value })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <input placeholder="Business Name" required onChange={e => setNewCust({ ...newCust, businessName: e.target.value })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <button style={{ gridColumn: 'span 4', padding: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Add Customer</button>
            </form>
            <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <thead><tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569' }}><th style={{ padding: 12 }}>Name</th><th style={{ padding: 12 }}>Business</th><th style={{ padding: 12 }}>Mobile</th><th style={{ padding: 12 }}>Email</th><th style={{ padding: 12 }}>Type</th><th style={{ padding: 12 }}>Status</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0', color: '#0f172a' }}><td style={{ padding: 12, fontWeight: 600 }}>{c.name}</td><td style={{ padding: 12 }}>{c.businessName}</td><td style={{ padding: 12 }}>{c.mobile}</td><td style={{ padding: 12 }}>{c.email}</td><td style={{ padding: 12 }}>{c.customerType}</td><td style={{ padding: 12 }}>{c.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'products' && (
          <div>
            <h2 style={{ color: '#0f172a', marginTop: 0 }}>Product & Inventory Management</h2>
            <form onSubmit={addProduct} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: '#fff', padding: 20, borderRadius: 8, marginBottom: 24, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <input placeholder="Product Name" required onChange={e => setNewProd({ ...newProd, name: e.target.value })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <input placeholder="SKU" required onChange={e => setNewProd({ ...newProd, sku: e.target.value })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <input placeholder="Category" required onChange={e => setNewProd({ ...newProd, category: e.target.value })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <input type="number" placeholder="Unit Price" required onChange={e => setNewProd({ ...newProd, unitPrice: Number(e.target.value) })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <input type="number" placeholder="Initial Stock" required onChange={e => setNewProd({ ...newProd, currentStock: Number(e.target.value) })} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <button style={{ gridColumn: 'span 3', padding: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Add Product</button>
            </form>
            <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <thead><tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569' }}><th style={{ padding: 12 }}>Name</th><th style={{ padding: 12 }}>SKU</th><th style={{ padding: 12 }}>Unit Price</th><th style={{ padding: 12 }}>Stock</th><th style={{ padding: 12 }}>Min Alert</th><th style={{ padding: 12 }}>Status</th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', color: '#0f172a' }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>{p.name}</td><td style={{ padding: 12 }}>{p.sku}</td><td style={{ padding: 12 }}>₹{p.unitPrice}</td>
                    <td style={{ padding: 12, fontWeight: 700 }}>{p.currentStock}</td><td style={{ padding: 12 }}>{p.minStockAlert}</td>
                    <td style={{ padding: 12 }}>{p.currentStock <= p.minStockAlert ? <span style={{ color: '#ef4444', fontWeight: 700 }}>Low Stock Alert</span> : <span style={{ color: '#16a34a', fontWeight: 600 }}>Normal</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'challans' && (
          <div>
            <h2 style={{ color: '#0f172a', marginTop: 0 }}>Sales Challan Dispatch Flow</h2>
            {error && <div style={{ padding: 12, background: '#fee2e2', color: '#b91c1c', marginBottom: 16, borderRadius: 6, border: '1px solid #f87171', fontWeight: 600 }}>{error}</div>}
            <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>Create New Challan</h4>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <select onChange={e => setChallanCust(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', flex: 1, color: '#0f172a' }}>
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.businessName})</option>)}
                </select>
                <select onChange={e => setChallanProd(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', flex: 1, color: '#0f172a' }}>
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock})</option>)}
                </select>
                <input type="number" value={challanQty} min={1} onChange={e => setChallanQty(Number(e.target.value))} style={{ width: 100, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a' }} />
              </div>
              <button onClick={() => createChallan('Draft')} style={{ padding: '10px 18px', marginRight: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: '#334155' }}>Save Draft</button>
              <button onClick={() => createChallan('Confirmed')} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Confirm & Deduct Stock</button>
            </div>
            <h3 style={{ color: '#0f172a' }}>Generated Challans</h3>
            <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <thead><tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569' }}><th style={{ padding: 12 }}>Challan #</th><th style={{ padding: 12 }}>Customer</th><th style={{ padding: 12 }}>Total Items</th><th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }}>Created By</th></tr></thead>
              <tbody>
                {challans.map(ch => (
                  <tr key={ch.id} style={{ borderBottom: '1px solid #e2e8f0', color: '#0f172a' }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>{ch.challanNumber}</td><td style={{ padding: 12 }}>{ch.customer?.name}</td><td style={{ padding: 12 }}>{ch.totalQuantity}</td>
                    <td style={{ padding: 12, color: ch.status === 'Confirmed' ? '#16a34a' : '#64748b', fontWeight: 700 }}>{ch.status}</td><td style={{ padding: 12 }}>{ch.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}