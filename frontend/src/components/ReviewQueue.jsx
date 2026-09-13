import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function ReviewQueue() {
  const { auth } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending | all

  useEffect(() => {
    loadBatches();
  }, [filter]);

  async function loadBatches() {
    setLoading(true);
    setError(null);
    try {
      const query = filter === 'pending' ? '?review_status=pending' : '';
      const res = await fetch(`${API_BASE}/api/batches${query}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load batches');
      setBatches(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Review Queue</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">Needs review</option>
          <option value="all">All batches</option>
        </select>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'crimson' }}>❌ {error}</p>}

      {!loading && batches.length === 0 && (
        <p style={{ color: '#666' }}>Nothing here — every batch is either approved or there's nothing uploaded yet.</p>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={th}>File</th>
            <th style={th}>Vendor</th>
            <th style={th}>Method</th>
            <th style={th}>Status</th>
            <th style={th}>Confidence</th>
            <th style={th}>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={td}>
                <Link to={`/review/${b.id}`}>{b.original_filename}</Link>
              </td>
              <td style={td}>{b.vendor_name}</td>
              <td style={td}>{methodLabel(b.extraction_method)}</td>
              <td style={td}>{statusBadge(b.review_status)}</td>
              <td style={td}>{b.confidence_score != null ? b.confidence_score : '—'}</td>
              <td style={td}>{new Date(b.uploaded_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function methodLabel(m) {
  return { text: 'Text (generic)', text_ai: 'Text + AI', vision: 'AI vision', manual: 'Manual', pending_ai: 'Awaiting AI' }[m] || m;
}

function statusBadge(status) {
  const colors = {
    approved: { bg: '#dcfce7', color: '#166534' },
    pending: { bg: '#fef3c7', color: '#b45309' },
    rejected: { bg: '#fee2e2', color: '#b91c1c' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
      {status}
    </span>
  );
}

const th = { padding: '8px 6px', fontSize: 13, color: '#374151' };
const td = { padding: '8px 6px', fontSize: 14 };
