import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Analytics() {
  const { auth } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/summary`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (error) return <p style={{ padding: 24, color: 'crimson' }}>❌ {error}</p>;
  if (!data) return null;

  const approved = data.byReviewStatus.find((s) => s.review_status === 'approved')?.count || 0;
  const pending = data.byReviewStatus.find((s) => s.review_status === 'pending')?.count || 0;
  const rejected = data.byReviewStatus.find((s) => s.review_status === 'rejected')?.count || 0;

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h2>Analytics</h2>
      <p style={{ color: '#666', marginTop: -8, fontSize: 13 }}>
        Showing what's supportable with current data volume. Route/boarding pattern analysis and
        6-month trend views need more uploaded history before they'd say anything meaningful.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        <StatCard label="Total PDFs processed" value={data.totalBatches} />
        <StatCard label="Total passengers recorded" value={data.totalPassengers} />
        <StatCard label="Approved batches" value={approved} color="#166534" bg="#dcfce7" />
        <StatCard label="Pending review" value={pending} color="#b45309" bg="#fef3c7" />
        {rejected > 0 && <StatCard label="Rejected" value={rejected} color="#b91c1c" bg="#fee2e2" />}
      </div>

      <h3 style={{ marginTop: 32 }}>Uploads by vendor</h3>
      {data.byVendor.length === 0 ? (
        <p style={{ color: '#666' }}>No uploads yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 400 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <th style={th}>Vendor</th>
              <th style={th}>PDFs</th>
            </tr>
          </thead>
          <tbody>
            {data.byVendor.map((v) => (
              <tr key={v.vendor_name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>{v.vendor_name}</td>
                <td style={td}>{v.batch_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatCard({ label, value, color = '#111827', bg = '#f3f4f6' }) {
  return (
    <div style={{ background: bg, color, padding: '16px 20px', borderRadius: 8, minWidth: 160 }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}

const th = { padding: '8px 6px', fontSize: 13, color: '#374151' };
const td = { padding: '8px 6px', fontSize: 14 };
