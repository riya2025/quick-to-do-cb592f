import React, { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import { HashRouter, Routes, Route, Link, NavLink, useNavigate, useParams, Navigate } from 'react-router-dom';

const COLLECTION = 'tasks';

function loadLocal() {
  try {
    const raw = localStorage.getItem('quicktodo_tasks');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(tasks) {
  try { localStorage.setItem('quicktodo_tasks', JSON.stringify(tasks)); } catch {}
}

async function apiFetch(method, path, body) {
  const base = window.API_BASE || '';
  if (!base) return null;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(base + '/api/store/' + path, opts);
  if (res.status === 204) return null;
  return res.json();
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={<TodoApp />} />
      </Routes>
    </HashRouter>
  );
}

function TodoApp() {
  const [tasks, setTasks] = useState(loadLocal);
  const [filter, setFilter] = useState('all');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    saveLocal(tasks);
  }, [tasks]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch('GET', COLLECTION);
        if (!cancelled && Array.isArray(data)) {
          setTasks(data);
          saveLocal(data);
        }
      } catch (err) {
        {/* fallback to localStorage already loaded */ }
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'active') return tasks.filter(t => !t.done);
    if (filter === 'done') return tasks.filter(t => t.done);
    return tasks;
  }, [tasks, filter]);

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter(t => !t.done).length,
    done: tasks.filter(t => t.done).length,
  }), [tasks]);

  async function addTask(e) {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    const newRec = { title, done: false, createdAt: Date.now() };
    setInput('');
    inputRef.current && inputRef.current.focus();

    const tempId = 'temp_' + Date.now();
    const optimistic = { id: tempId, ...newRec };
    setTasks(prev => [optimistic, ...prev]);

    try {
      const saved = await apiFetch('POST', COLLECTION, { data: newRec });
      if (saved && saved.id) {
        setTasks(prev => prev.map(t => t.id === tempId ? saved : t));
      }
    } catch {
      {/* keep optimistic in localStorage */ }
    }
  }

  async function toggleTask(id) {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, done: !t.done } : t);
      const target = updated.find(t => t.id === id);
      if (target) {
        apiFetch('PUT', COLLECTION + '/' + id, { data: { title: target.title, done: target.done, createdAt: target.createdAt } }).catch(() => {});
      }
      return updated;
    });
  }

  async function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await apiFetch('DELETE', COLLECTION + '/' + id); } catch {}
  }

  function handleImgError(e) {
    e.target.src = 'https://picsum.photos/seed/' + encodeURIComponent('todo') + '/400/300';
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="container row center">
          <h1 className="hero">Quick To-Do</h1>
          <span className="badge">{counts.active} active</span>
        </div>
      </header>

      <main className="container wrap">
        <div className="card box" style={{ marginBottom: '1.5rem' }}>
          <div className="hero" style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <img
              className="avatar"
              src="https://loremflickr.com/400/300/checklist?lock=42"
              alt="Checklist"
              onError={handleImgError}
              style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: '1rem' }}
            />
            <h2>What needs to be done?</h2>
          </div>
          <form className="row" onSubmit={addTask} style={{ gap: '0.5rem' }}>
            <input
              ref={inputRef}
              className="input field"
              type="text"
              placeholder="Add a new task..."
              value={input}
              onChange={e => setInput(e.target.value)}
              aria-label="New task title"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit">Add</button>
          </form>
        </div>

        <div className="row center" style={{ gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {['all', 'active', 'done'].map(f => (
            <button
              key={f}
              className={`btn ${filter === f ? 'btn-primary' : ''}`}
              onClick={() => setFilter(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
              <span className="pill" style={{ marginLeft: 6 }}>{counts[f]}</span>
            </button>
          ))}
        </div>

        {loading && tasks.length === 0 ? (
          <div className="center muted" style={{ padding: '2rem' }}>Loading tasks...</div>
        ) : filtered.length === 0 ? (
          <div className="card center muted" style={{ padding: '2rem' }}>
            {filter === 'all' ? 'No tasks yet. Add one above!' : `No ${filter} tasks.`}
          </div>
        ) : (
          <ul className="list">
            {filtered.map((task, idx) => (
              <li key={task.id} className="list-item card row center" style={{ gap: '0.75rem', padding: '0.75rem 1rem' }}>
                <button
                  className={`btn ${task.done ? 'btn-primary' : ''}`}
                  onClick={() => toggleTask(task.id)}
                  aria-label={task.done ? 'Mark as active' : 'Mark as done'}
                  style={{ minWidth: 36, minHeight: 36, fontSize: '1.1rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {task.done ? '✓' : '○'}
                </button>
                <span
                  className="rec"
                  style={{
                    flex: 1,
                    textDecoration: task.done ? 'line-through' : 'none',
                    opacity: task.done ? 0.6 : 1,
                    fontSize: '1rem',
                  }}
                >
                  {task.title}
                </span>
                {task.done && <span className="pill" style={{ background: '#22c55e', color: '#fff' }}>Done</span>}
                <button
                  className="btn"
                  onClick={() => deleteTask(task.id)}
                  aria-label="Delete task"
                  style={{ color: '#ef4444', minWidth: 32 }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {tasks.length > 0 && (
          <div className="center muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            {counts.done} of {counts.all} tasks completed
          </div>
        )}
      </main>
    </div>
  );
}