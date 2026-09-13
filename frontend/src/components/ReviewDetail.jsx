import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TRIP_FIELDS = [
  ['vehicle_reg_number', 'Vehicle Reg. Number'],
  ['driver_name', 'Driver Name'],
  ['start_location', 'Start Location'],
  ['end_location', 'End Location'],
  ['travel_date', 'Travel Date'],
  ['total_booked_seats', 'Total Booked Seats'],
  ['total_seats', 'Total Seats'],
  ['vacant_seats', 'Vacant Seats'],
];

const PASSENGER_FIELDS = ['seat_no', 'pnr', 'name', 'age', 'gender', 'mobile', 'boarding_point'];

export default function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [batch, setBatch] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadBatch();
    loadPdf();
    // Revoke the blob URL on unmount to avoid leaking memory
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadBatch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/batches/${id}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load batch');
      setBatch(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPdf() {
    try {
      const res = await fetch(`${API_BASE}/api/batches/${id}/pdf`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return; // e.g. file missing — silently skip preview
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch {
      // Preview is a nice-to-have; don't block the rest of the screen on it
    }
  }

  function updateTripField(field, value) {
    setBatch((prev) => ({ ...prev, [field]: value }));
  }

  function updatePassengerField(passengerId, field, value) {
    setBatch((prev) => ({
      ...prev,
      passengers: prev.passengers.map((p) => (p.id === passengerId ? { ...p, [field]: value } : p)),
    }));
  }

  async function saveTripFields() {
    setSaving(true);
    setMessage(null);
    try {
      const body = {};
      for (const [field] of TRIP_FIELDS) body[field] = batch[field];
      const res = await fetch(`${API_BASE}/api/batches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setMessage('Trip details saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePassenger(passenger) {
    try {
      const body = {};
      for (const f of PASSENGER_FIELDS) body[f] = passenger[f];
      const res = await fetch(`${API_BASE}/api/batches/${id}/passengers/${passenger.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setMessage(`Row saved (seat ${passenger.seat_no || '—'}).`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleExtractWithAI() {
    if (!confirm('This calls the Claude API and will incur a small cost. Continue?')) return;
    setAiLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/batches/${id}/extract-ai`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI extraction failed');
      setMessage(`AI re-extraction complete — found ${data.passengers_found} passengers. Review below before approving.`);
      await loadBatch();
    } catch (err) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleApprove() {
    try {
      const res = await fetch(`${API_BASE}/api/batches/${id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Approve failed');
      navigate('/review');
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (error && !batch) return <p style={{ padding: 24, color: 'crimson' }}>❌ {error}</p>;
  if (!batch) return null;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '16px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <Link to="/review">← Back to queue</Link>
      <h2 style={{ marginTop: 8 }}>{batch.original_filename}</h2>
      <p style={{ color: '#666', marginTop: -8 }}>
        Vendor: <strong>{batch.vendor_name}</strong> · Method: <strong>{batch.extraction_method}</strong> ·
        Confidence: <strong>{batch.confidence_score ?? '—'}</strong> · Status: <strong>{batch.review_status}</strong>
      </p>

      {message && <p style={{ color: '#166534', background: '#dcfce7', padding: 8, borderRadius: 6 }}>{message}</p>}
      {error && <p style={{ color: 'crimson' }}>❌ {error}</p>}

      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        {/* PDF preview */}
        <div style={{ flex: '1 1 45%', minWidth: 320 }}>
          <h3>Original PDF</h3>
          {pdfUrl ? (
            <iframe src={pdfUrl} title="PDF preview" style={{ width: '100%', height: 600, border: '1px solid #e5e7eb' }} />
          ) : (
            <p style={{ color: '#999' }}>Preview unavailable.</p>
          )}
        </div>

        {/* Editable fields */}
        <div style={{ flex: '1 1 55%', minWidth: 360 }}>
          <h3>Trip details</h3>
          {TRIP_FIELDS.map(([field, label]) => (
            <div key={field} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13, color: '#374151', display: 'block' }}>{label}</label>
              <input
                value={batch[field] ?? ''}
                onChange={(e) => updateTripField(field, e.target.value)}
                style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <button onClick={saveTripFields} disabled={saving}>
            {saving ? 'Saving…' : 'Save trip details'}
          </button>

          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button onClick={handleExtractWithAI} disabled={aiLoading}>
              {aiLoading ? 'Extracting with AI…' : '✨ Extract with AI'}
            </button>
            <button onClick={handleApprove} style={{ background: '#166534', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 4 }}>
              ✅ Approve
            </button>
          </div>

          <h3 style={{ marginTop: 24 }}>Passengers ({batch.passengers.length})</h3>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {PASSENGER_FIELDS.map((f) => (
                    <th key={f} style={{ textAlign: 'left', padding: 4, borderBottom: '1px solid #e5e7eb' }}>{f}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batch.passengers.map((p) => (
                  <tr key={p.id}>
                    {PASSENGER_FIELDS.map((f) => (
                      <td key={f} style={{ padding: 2 }}>
                        <input
                          value={p[f] ?? ''}
                          onChange={(e) => updatePassengerField(p.id, f, e.target.value)}
                          style={{ width: 70, fontSize: 12, padding: 3 }}
                        />
                      </td>
                    ))}
                    <td>
                      <button onClick={() => savePassenger(p)} style={{ fontSize: 11 }}>Save</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
