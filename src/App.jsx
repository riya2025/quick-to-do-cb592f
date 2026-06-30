import React, { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import { HashRouter, Routes, Route, Link, NavLink, useNavigate, useParams, Navigate } from 'react-router-dom';

const COLLECTION = 'tasks';

function useTodos() {
  const [tasks, setTasks] = useState([]);
  const isLoaded = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(COLLECTION);
    if (stored) {
      try { setTasks(JSON.parse(stored)); } catch(e) {}
    }
    const apiBase = window.API_BASE;
    if (apiBase) {
      fetch(apiBase + '/api/store/' + COLLECTION)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setTasks(data);
            localStorage.setItem(COLLECTION, JSON.stringify(data));
          }
        })
        .catch(() => {});
    }
    isLoaded.current = true;
  }, []);

  useEffect(() => {
    if (isLoaded.current || tasks.length > 0) {
      localStorage.setItem(COLLECTION, JSON.stringify(tasks));
    }
  }, [tasks]);

  const addTask = async (title) => {
    const newTask = { title, done: false, createdAt: Date.now() };
    const apiBase = window.API_BASE;
    if (apiBase) {
      try {
        const res = await fetch(apiBase + '/api/store/' + COLLECTION, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: newTask })
        });
        const saved = await res.json();
        setTasks(prev => [...prev, saved]);
      } catch {
        const localTask = { ...newTask, id: 'local_' + Date.now() };
        setTasks(prev => [...prev, localTask]);
      }
    } else {
      const localTask = { ...newTask, id: 'local_' + Date.now() };
      setTasks(prev => [...prev, localTask]);
    }
  };

  const toggleTask = async (task) => {
    const updated = { ...task, done: !task.done };
    const apiBase = window.API_BASE;
    if (apiBase && task.id && !task.id.startsWith('local_')) {
      try {
        const res = await fetch(apiBase + '/api/store/' + COLLECTION + '/' + task.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updated })
        });
        const saved = await res.json();
        setTasks(prev => prev.map(t => t.id === task.id ? saved : t));
      } catch {
        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      }
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    }
  };

  const deleteTask = async (id) => {
    const apiBase = window.API_BASE;
    if (apiBase && id && !id.startsWith('local_')) {
      try {
        await fetch(apiBase + '/api/store/' + COLLECTION + '/' + id, { method: 'DELETE' });
      } catch {}
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return { tasks, addTask, toggleTask, deleteTask };
}

function TopBar() {
  return (
    <header className="topbar">
      <div className="container row">
        <Link to="/" className="nav brand">✅ Quick To-Do</Link>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav link active' : 'nav link'}>Home</NavLink>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero center">
      <div className="container">
        <h1>Quick To-Do</h1>
        <p className="muted">Organize your tasks effortlessly. Add, complete, and filter your to-dos in seconds.</p>
      </div>
    </section>
  );
}

function TaskInput({ onAdd }) {
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed) {
      onAdd(trimmed);
      setTitle('');
      if (inputRef.current) inputRef.current.focus();
    }
  };

  return (
    <form className="row task-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="input"
        type="text"
        placeholder="What needs to be done?"
        value={title}
        onChange={e => setTitle(e.target.value)}
        aria-label="New task title"
      />
      <button className="btn btn-primary" type="submit">Add Task</button>
    </form>
  );
}

function FilterBar({ filter, setFilter, counts }) {
  return (
    <div className="row filter-bar">
      <button
        className={`btn ${filter === 'all' ? 'btn-primary' : ''}`}
        onClick={() => setFilter('all')}
      >
        All <span className="pill">{counts.all}</span>
      </button>
      <button
        className={`btn ${filter === 'active' ? 'btn-primary' : ''}`}
        onClick={() => setFilter('active')}
      >
        Active <span className="pill">{counts.active}</span>
      </button>
      <button
        className={`btn ${filter === 'done' ? 'btn-primary' : ''}`}
        onClick={() => setFilter('done')}
      >
        Done <span className="pill">{counts.done}</span>
      </button>
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete }) {
  const imgId = (parseInt(task.id?.replace(/\D/g, ''), 10) || 1) % 70 + 1;
  const avatarUrl = `https://i.pravatar.cc/300?img=${imgId}`;
  const fallbackUrl = `https://picsum.photos/seed/${task.id}/40/40`;

  const handleImgError = (e) => {
    e.target.onerror = null;
    e.target.src = fallbackUrl;
  };

  return (
    <li className={`list-item rec ${task.done ? 'done' : ''}`}>
      <img
        className="avatar"
        src={avatarUrl}
        alt="Task avatar"
        onError={handleImgError}
      />
      <div className="task-content">
        <span className={`task-title ${task.done ? 'muted' : ''}`}>
          {task.title}
        </span>
        {task.done && <span className="badge">Completed</span>}
      </div>
      <div className="row task-actions">
        <button
          className={`btn ${task.done ? '' : 'btn-primary'}`}
          onClick={() => onToggle(task)}
          aria-label={task.done ? 'Mark as active' : 'Mark as done'}
        >
          {task.done ? 'Undo' : 'Done'}
        </button>
        <button
          className="btn btn-danger"
          onClick={() => onDelete(task.id)}
          aria-label="Delete task"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function TaskList({ tasks, onToggle, onDelete }) {
  if (tasks.length === 0) {
    return (
      <div className="center box empty-state">
        <p className="muted">No tasks here yet. Add one above!</p>
      </div>
    );
  }

  return (
    <ul className="list">
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function Stats({ counts }) {
  return (
    <div className="grid stats-grid">
      <div className="stat box center">
        <span className="stat-number">{counts.all}</span>
        <span className="muted">Total</span>
      </div>
      <div className="stat box center">
        <span className="stat-number primary">{counts.active}</span>
        <span className="muted">Active</span>
      </div>
      <div className="stat box center">
        <span className="stat-number">{counts.done}</span>
        <span className="muted">Done</span>
      </div>
    </div>
  );
}

function HomePage() {
  const { tasks, addTask, toggleTask, deleteTask } = useTodos();
  const [filter, setFilter] = useState('all');

  const filteredTasks = useMemo(() => {
    if (filter === 'active') return tasks.filter(t => !t.done);
    if (filter === 'done') return tasks.filter(t => t.done);
    return tasks;
  }, [tasks, filter]);

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter(t => !t.done).length,
    done: tasks.filter(t => t.done).length
  }), [tasks]);

  return (
    <div className="container page">
      <Hero />
      <div className="card">
        <TaskInput onAdd={addTask} />
      </div>
      <Stats counts={counts} />
      <div className="card">
        <FilterBar filter={filter} setFilter={setFilter} counts={counts} />
        <TaskList
          tasks={filteredTasks}
          onToggle={toggleTask}
          onDelete={deleteTask}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <TopBar />
        <main className="wrap">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}