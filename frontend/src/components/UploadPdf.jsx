import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Vendors are created on the fly by the backend, but a dropdown here keeps
// naming consistent so the same vendor doesn't fragment into "Ashoka" vs
// "ashoka travels" vs "Ashoka Travel & Logistics".
const KNOWN_VENDORS = ['Ashoka Travel & Logistics', 'Golden Travel Agencies', 'Kalpaka Travels'];

export default function UploadPdf() {
  const { auth, logout } = useAuth();
  const token = auth?.token;
  const [vendorName, setVendorName] = useState(KNOWN_VENDORS[0]);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('vendorName', vendorName);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok && res.status !== 202) throw new Error(data.error || 'Upload failed');
      setResult({ httpStatus: res.status, ...data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Upload booking PDF</h2>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: '#666' }}>{auth?.user?.email}</div>
          <button onClick={logout} style={{ fontSize: 12, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>
            Log out
          </button>
        </div>
      </div>
      <form onSubmit={handleUpload}>
        <label>
          Vendor
          <select value={vendorName} onChange={(e) => setVendorName(e.target.value)}>
            {KNOWN_VENDORS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <br /><br />
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <br /><br />
        <button type="submit" disabled={!file || loading}>
          {loading ? 'Processing…' : 'Upload'}
        </button>
      </form>

      {error && <p style={{ color: 'crimson' }}>❌ {error}</p>}

      {result && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #ccc', borderRadius: 8 }}>
          {result.status === 'awaiting_ai_module' && (
            <Badge color="#b45309" bg="#fef3c7">
              ⚠️ Image-based PDF — AI vision module coming soon. Saved, not yet processed.
            </Badge>
          )}
          {result.status === 'no_template' && (
            <Badge color="#b45309" bg="#fef3c7">
              ⚠️ Text found, but no parsing template exists yet for this vendor.
            </Badge>
          )}
          {result.status === 'processed' && result.review_status === 'approved' && (
            <Badge color="#166534" bg="#dcfce7">
              ✅ Text-based — parsed automatically ({result.passengers_found} passengers, confidence {result.confidence})
            </Badge>
          )}
          {result.status === 'processed' && result.review_status === 'pending' && (
            <Badge color="#b45309" bg="#fef3c7">
              ⚠️ Parsed, but confidence was low ({result.confidence}) — sent to review queue.
            </Badge>
          )}
          <pre style={{ fontSize: 12, marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Badge({ children, color, bg }) {
  return (
    <div style={{ background: bg, color, padding: '8px 12px', borderRadius: 6, fontWeight: 600 }}>
      {children}
    </div>
  );
}
