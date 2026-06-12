import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import ConfirmDialog from '../../components/ConfirmDialog';

const empty = { candidate_number: '', candidate_name: '', municipality: '', age: '' };

export default function Candidates() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  const load = async () => setList((await api.get('/candidates')).data);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (photo) fd.append('photo', photo);
    try {
      if (editing) await api.put(`/candidates/${editing}`, fd);
      else await api.post('/candidates', fd);
      setForm(empty); setPhoto(null); setEditing(null);
      e.target.reset && e.target.reset();
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  const startEdit = (c) => {
    setEditing(c.candidate_id);
    setForm({ candidate_number: c.candidate_number, candidate_name: c.candidate_name, municipality: c.municipality, age: c.age });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async () => {
    try { await api.delete(`/candidates/${deleting}`); setDeleting(null); load(); }
    catch (err) { setError(errMsg(err)); setDeleting(null); }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Candidate Management</h2>
      {error && <div className="rounded-lg bg-red-100 text-red-700 text-sm px-3 py-2">{error}</div>}

      <form onSubmit={save} className="card grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div><label className="label">Number</label>
          <input type="number" min="1" className="input" value={form.candidate_number} onChange={(e) => setForm({ ...form, candidate_number: e.target.value })} required /></div>
        <div className="col-span-2"><label className="label">Full Name</label>
          <input className="input" value={form.candidate_name} onChange={(e) => setForm({ ...form, candidate_name: e.target.value })} required /></div>
        <div><label className="label">Cluster / Origin</label>
          <input className="input" value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} required /></div>
        <div><label className="label">Age</label>
          <input type="number" min="15" max="40" className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required /></div>
        <div><label className="label">Photo</label>
          <input type="file" accept="image/*" className="input !p-1.5" onChange={(e) => setPhoto(e.target.files[0])} /></div>
        <div className="col-span-2 lg:col-span-6 flex gap-2">
          <button className="btn-gold">{editing ? 'Update Candidate' : 'Add Candidate'}</button>
          {editing && <button type="button" className="btn-outline" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {list.map((c) => (
          <div key={c.candidate_id} className="card flex gap-3">
            <div className="h-20 w-20 shrink-0 rounded-lg bg-gold-100 dark:bg-gold-900/30 overflow-hidden flex items-center justify-center text-3xl">
              {c.photo ? <img src={c.photo} alt={c.candidate_name} className="h-full w-full object-cover" /> : '👑'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate">#{c.candidate_number} {c.candidate_name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{c.municipality} · {c.age} yrs</div>
              <div className="mt-1 flex gap-1">
                {!!c.is_top5 && <span className="rounded bg-gold-100 dark:bg-gold-900/40 px-1.5 text-[10px] font-bold text-gold-700 dark:text-gold-300">TOP 5</span>}
                {!!c.is_top3 && <span className="rounded bg-gold-500 px-1.5 text-[10px] font-bold text-white">TOP 3</span>}
              </div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs text-gold-600 hover:underline" onClick={() => startEdit(c)}>Edit</button>
                <button className="text-xs text-red-600 hover:underline" onClick={() => setDeleting(c.candidate_id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {!list.length && <p className="text-sm text-gray-500">No candidates yet. Add the first one above.</p>}
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Candidate"
        message="This permanently removes the candidate and all of her scores. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
