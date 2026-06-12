import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import ConfirmDialog from '../../components/ConfirmDialog';

const empty = { full_name: '', username: '', password: '' };

export default function Judges() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  const load = async () => setList((await api.get('/judges')).data);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.put(`/judges/${editing}`, form);
      else await api.post('/judges', form);
      setForm(empty); setEditing(null);
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  const toggle = async (j) => {
    await api.patch(`/judges/${j.judge_id}/status`, { status: j.status === 'active' ? 'inactive' : 'active' });
    load();
  };

  const remove = async () => {
    try { await api.delete(`/judges/${deleting}`); setDeleting(null); load(); }
    catch (err) { setError(errMsg(err)); setDeleting(null); }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Judge Management</h2>
      {error && <div className="rounded-lg bg-red-100 text-red-700 text-sm px-3 py-2">{error}</div>}

      <form onSubmit={save} className="card grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div><label className="label">Full Name</label>
          <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
        <div><label className="label">Username</label>
          <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
        <div><label className="label">{editing ? 'New Password (optional)' : 'Password'}</label>
          <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} /></div>
        <div className="flex gap-2">
          <button className="btn-gold">{editing ? 'Update' : 'Add Judge'}</button>
          {editing && <button type="button" className="btn-outline" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}
        </div>
      </form>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead><tr>
            <th className="table-th">Judge</th><th className="table-th">Username</th><th className="table-th">Status</th><th className="table-th">Actions</th>
          </tr></thead>
          <tbody>
            {list.map((j) => (
              <tr key={j.judge_id}>
                <td className="table-td font-semibold">{j.full_name}</td>
                <td className="table-td">{j.username}</td>
                <td className="table-td">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${j.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {j.status.toUpperCase()}
                  </span>
                </td>
                <td className="table-td space-x-3">
                  <button className="text-xs text-gold-600 hover:underline" onClick={() => { setEditing(j.judge_id); setForm({ full_name: j.full_name, username: j.username, password: '' }); }}>Edit</button>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => toggle(j)}>{j.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  <button className="text-xs text-red-600 hover:underline" onClick={() => setDeleting(j.judge_id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td className="table-td text-gray-500" colSpan="4">No judges yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Judge"
        message="Judges with recorded scores cannot be deleted — deactivate them instead. Continue?"
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
