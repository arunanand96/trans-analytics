import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PassengerSearch() {
  const { auth } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [expandedMobile, setExpandedMobile] = useState(null);
  const [travelLog, setTravelLog] = useState([]);
  const [coTravellers, setCoTravellers] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (query.trim().length < 2) {
      setError('Enter at least 2 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    setExpandedMobile(null);
    try {
      const res = await fetch(`${API_BASE}/api/passengers?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function viewDetail(mobile) {
    if (expandedMobile === mobile) {
      setExpandedMobile(null);
      return;
    }
    setExpandedMobile(mobile);
    setDetailLoading(true);
    try {
      const [logRes, coRes] = await Promise.all([
        fetch(`${API_BASE}/api/passengers/travel-log/${mobile}`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        }),
        fetch(`${API_BASE}/api/passengers/co-travellers/${mobile}`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        }),
      ]);
      setTravelLog(await logRes.json());
      setCoTravellers(await coRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <h2>Passenger Search</h2>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, mobile, or PNR"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      {error && <p style={{ color: 'crimson' }}>❌ {error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={th}>Name</th>
            <th style={th}>Mobile</th>
            <th style={th}>PNR</th>
            <th style={th}>Route</th>
            <th style={th}>Date</th>
            <th style={th}>Vendor</th>
            <th style={th}>Reliability</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <>
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.mobile}</td>
                <td style={td}>{r.pnr}</td>
                <td style={td}>{r.start_location} → {r.end_location}</td>
                <td style={td}>{r.travel_date ? new Date(r.travel_date).toLocaleDateString() : '—'}</td>
                <td style={td}>{r.vendor_name}</td>
                <td style={td}>{reliabilityBadge(r.source_reliability)}</td>
                <td style={td}>
                  <button onClick={() => viewDetail(r.mobile)} style={{ fontSize: 12 }}>
                    {expandedMobile === r.mobile ? 'Hide' : 'Travel log'}
                  </button>
                </td>
              </tr>
              {expandedMobile === r.mobile && (
                <tr>
                  <td colSpan={8} style={{ background: '#f9fafb', padding: 12 }}>
                    {detailLoading ? (
                      <p>Loading…</p>
                    ) : (
                      <div style={{ display: 'flex', gap: 24 }}>
                        <div style={{ flex: 1 }}>
                          <strong>Travel history ({travelLog.length} trips)</strong>
                          <ul style={{ fontSize: 13 }}>
                            {travelLog.map((t, i) => (
                              <li key={i}>
                                {t.travel_date ? new Date(t.travel_date).toLocaleDateString() : '—'} ·
                                {' '}{t.start_location} → {t.end_location} · {t.vendor_name} · Seat {t.seat_no}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div style={{ flex: 1 }}>
                          <strong>Frequent co-travellers</strong>
                          {coTravellers.length === 0 ? (
                            <p style={{ fontSize: 13, color: '#666' }}>None found (needs 2+ shared trips).</p>
                          ) : (
                            <ul style={{ fontSize: 13 }}>
                              {coTravellers.map((c, i) => (
                                <li key={i}>{c.name} ({c.mobile}) — {c.shared_trips} shared trips</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {!loading && results.length === 0 && query && !error && (
        <p style={{ color: '#666', marginTop: 12 }}>No matches found.</p>
      )}
    </div>
  );
}

function reliabilityBadge(r) {
  const isHigh = r === 'high';
  return (
    <span style={{
      background: isHigh ? '#dcfce7' : '#fef3c7',
      color: isHigh ? '#166534' : '#b45309',
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    }}>
      {isHigh ? 'verified' : 'needs review'}
    </span>
  );
}

const th = { padding: '8px 6px', fontSize: 13, color: '#374151' };
const td = { padding: '8px 6px', fontSize: 14 };
