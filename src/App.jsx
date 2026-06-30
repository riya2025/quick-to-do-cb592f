import React, { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import { HashRouter, Routes, Route, Link, NavLink, useNavigate, useParams, Navigate } from 'react-router-dom';

const COLLECTION = 'tasks';

function loadLocal() {
  try {
    const raw = localStorage.getItem('quicktodo_tasks');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(tasks) {
  try {
    localStorage.setItem('quicktodo_tasks', JSON.stringify(tasks));
  } catch {}
}

async function apiFetch(method, path, body) {
  const base = window.API_BASE;
  if (!base) return null;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(base + path, opts);
  if (method === 'DELETE') return null;
  return await res.json();
}

export default function App() {
  const [tasks, setTasks] = useState(loadLocal);
  const [filter, setFilter] = useState('all');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch('GET', '/api/store/' + COLLECTION);
        if (mounted && Array.isArray(data)) {
          setTasks(data);
          saveLocal(data);
        }
      } catch {}
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    saveLocal(tasks);
  }, [tasks]);

  const filtered = useMemo(() => {
    if (filter === 'active') return tasks.filter(t => !t.done);
    if (filter === 'done') return tasks.filter(t => t.done);
    return tasks;
  }, [tasks, filter]);

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter(t => !t.done).length,
    done: tasks.filter(t => t.done).length
  }), [tasks]);

  async function addTask(e) {
    e.preventDefault();
    const title = input.trim();
    if (!title) return;
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const newTask = { id: tempId, title, done: false, createdAt: Date.now() };
    setTasks(prev => [newTask, ...prev]);
    setInput('');
    inputRef.current?.focus();
    try {
      const saved = await apiFetch('POST', '/api/store/' + COLLECTION, { data: { title, done: false, createdAt: newTask.createdAt } });
      if (saved && saved.id) {
        setTasks(prev => prev.map(t => t.id === tempId ? saved : t));
      }
    } catch {}
  }

  async function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const updated = { ...task, done: !task.done };
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    try {
      await apiFetch('PUT', '/api/store/' + COLLECTION + '/' + id, { data: { title: updated.title, done: updated.done, createdAt: updated.createdAt } });
    } catch {}
  }

  async function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await apiFetch('DELETE', '/api/store/' + COLLECTION + '/' + id);
    } catch {}
  }

  return (
    <HashRouter>
      <div className="app">
        <header className="topbar">
          <div className="container wrap">
            <h1 className="hero">Quick To-Do</h1>
            <span className="badge">{counts.active} active</span>
          </div>
        </header>
        <main className="container">
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <form className="row" onSubmit={addTask}>
              <input
                ref={inputRef}
                className="input"
                type="text"
                placeholder="What needs to be done?"
                value={input}
                onChange={e => setInput(e.target.value)}
                aria-label="New task title"
              />
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
          </div>

          <div className="row" style={{ marginBottom: '1rem', gap: '0.5rem' }}>
            {['all', 'active', 'done'].map(f => (
              <button
                key={f}
                className={`btn ${filter === f ? 'btn-primary' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="pill" style={{ marginLeft: '0.5rem' }}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {loading && tasks.length === 0 ? (
            <div className="center muted">Loading tasks…</div>
          ) : filtered.length === 0 ? (
            <div className="center muted">
              {filter === 'all' ? 'No tasks yet — add one above!' : `No ${filter} tasks.`}
            </div>
          ) : (
            <ul className="list">
              {filtered.map(task => (
                <li key={task.id} className="list-item rec">
                  <label className="field row" style={{ flex: 1, gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!task.done}
                      onChange={() => toggleTask(task.id)}
                      aria-label={`Mark "${task.title}" as ${task.done ? 'active' : 'done'}`}
                    />
                    <span className={task.done ? 'muted' : ''} style={{ textDecoration: task.done ? 'line-through' : 'none', flex: 1 }}>
                      {task.title}
                    </span>
                  </label>
                  <button className="btn" onClick={() => deleteTask(task.id)} aria-label={`Delete "${task.title}"`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {counts.done > 0 && (
            <div className="center muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              {counts.done} task{counts.done !== 1 ? 's' : ''} completed
            </div>
          )}
        </main>
      </div>
    </HashRouter>
  );
}