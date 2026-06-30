import React, { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import { HashRouter, Routes, Route, Link, NavLink, useNavigate, useParams, Navigate } from 'react-router-dom';

const COLLECTION = 'tasks';

function useTasks() {
  const [tasks, setTasks] = useState([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const localData = localStorage.getItem(COLLECTION);
    if (localData) {
      try {
        setTasks(JSON.parse(localData));
      } catch (e) {
        /* ignore */
      }
    }
    if (window.API_BASE) {
      fetch(window.API_BASE + '/api/store/' + COLLECTION)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setTasks(data);
            localStorage.setItem(COLLECTION, JSON.stringify(data));
          }
        })
        .catch(() => {});
    }
  }, []);

  const persist = (updated) => {
    setTasks(updated);
    localStorage.setItem(COLLECTION, JSON.stringify(updated));
  };

  const addTask = async (title) => {
    const newRec = { title, done: false, createdAt: Date.now() };
    let saved = { ...newRec, id: 'local_' + Date.now() };
    if (window.API_BASE) {
      try {
        const res = await fetch(window.API_BASE + '/api/store/' + COLLECTION, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: newRec })
        });
        const data = await res.json();
        if (data && data.id) saved = data;
      } catch (e) { /* fallback to local */ }
    }
    persist([...tasks, saved]);
  };

  const toggleTask = async (id) => {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    persist(updated);
    if (window.API_BASE) {
      try {
        await fetch(window.API_BASE + '/api/store/' + COLLECTION + '/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updated.find(t => t.id === id) })
        });
      } catch (e) { /* fallback */ }
    }
  };

  const deleteTask = async (id) => {
    const updated = tasks.filter(t => t.id !== id);
    persist(updated);
    if (window.API_BASE) {
      try {
        await fetch(window.API_BASE + '/api/store/' + COLLECTION + '/' + id, { method: 'DELETE' });
      } catch (e) { /* fallback */ }
    }
  };

  return { tasks, addTask, toggleTask, deleteTask };
}

function TaskInput({ onAdd }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <form className="row" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="input"
        type="text"
        placeholder="What needs to be done?"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <button className="btn btn-primary" type="submit">Add</button>
    </form>
  );
}

function FilterBar({ filter, setFilter, counts }) {
  return (
    <div className="row filter-bar">
      <NavLink 
        to="/" 
        end
        className={({ isActive }) => isActive && filter === 'all' ? 'btn btn-primary filter-btn' : 'btn filter-btn'}
        onClick={() => setFilter('all')}
      >
        All <span className="pill">{counts.all}</span>
      </NavLink>
      <NavLink 
        to="/active" 
        className={({ isActive }) => isActive && filter === 'active' ? 'btn btn-primary filter-btn' : 'btn filter-btn'}
        onClick={() => setFilter('active')}
      >
        Active <span className="pill">{counts.active}</span>
      </NavLink>
      <NavLink 
        to="/done" 
        className={({ isActive }) => isActive && filter === 'done' ? 'btn btn-primary filter-btn' : 'btn filter-btn'}
        onClick={() => setFilter('done')}
      >
        Done <span className="pill">{counts.done}</span>
      </NavLink>
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete }) {
  const imgSeed = task.id ? task.id.replace(/\D/g, '') || '1' : '1';

  return (
    <li className="list-item rec">
      <img 
        className="avatar"
        src={`https://loremflickr.com/400/300/task,checklist?lock=${imgSeed}`}
        alt="task"
        onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/${imgSeed}/400/300`; }}
      />
      <div className="task-content">
        <span className={task.done ? 'task-title done' : 'task-title'}>{task.title}</span>
        {task.done && <span className="badge">Done</span>}
      </div>
      <div className="task-actions">
        <button 
          className={task.done ? 'btn toggle-btn' : 'btn btn-primary toggle-btn'} 
          onClick={() => onToggle(task.id)}
        >
          {task.done ? 'Undo' : 'Complete'}
        </button>
        <button className="btn delete-btn" onClick={() => onDelete(task.id)}>Delete</button>
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

function HomePage() {
  const { tasks, addTask, toggleTask, deleteTask } = useTasks();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    if (newFilter === 'all') navigate('/');
    else if (newFilter === 'active') navigate('/active');
    else if (newFilter === 'done') navigate('/done');
  };

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
    <div className="container">
      <header className="hero">
        <h1>Quick To-Do</h1>
        <p className="muted">Organize your day, one task at a time.</p>
      </header>

      <div className="card">
        <TaskInput onAdd={addTask} />
        <FilterBar filter={filter} setFilter={handleFilterChange} counts={counts} />
        <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} />
      </div>
    </div>
  );
}

function ActivePage() {
  const { tasks, addTask, toggleTask, deleteTask } = useTasks();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('active');

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    if (newFilter === 'all') navigate('/');
    else if (newFilter === 'active') navigate('/active');
    else if (newFilter === 'done') navigate('/done');
  };

  const filteredTasks = useMemo(() => tasks.filter(t => !t.done), [tasks]);

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter(t => !t.done).length,
    done: tasks.filter(t => t.done).length
  }), [tasks]);

  return (
    <div className="container">
      <header className="hero">
        <h1>Quick To-Do</h1>
        <p className="muted">Organize your day, one task at a time.</p>
      </header>

      <div className="card">
        <TaskInput onAdd={addTask} />
        <FilterBar filter={filter} setFilter={handleFilterChange} counts={counts} />
        <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} />
      </div>
    </div>
  );
}

function DonePage() {
  const { tasks, addTask, toggleTask, deleteTask } = useTasks();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('done');

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    if (newFilter === 'all') navigate('/');
    else if (newFilter === 'active') navigate('/active');
    else if (newFilter === 'done') navigate('/done');
  };

  const filteredTasks = useMemo(() => tasks.filter(t => t.done), [tasks]);

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter(t => !t.done).length,
    done: tasks.filter(t => t.done).length
  }), [tasks]);

  return (
    <div className="container">
      <header className="hero">
        <h1>Quick To-Do</h1>
        <p className="muted">Organize your day, one task at a time.</p>
      </header>

      <div className="card">
        <TaskInput onAdd={addTask} />
        <FilterBar filter={filter} setFilter={handleFilterChange} counts={counts} />
        <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <nav className="topbar nav">
          <Link to="/" className="app-title">Quick To-Do</Link>
          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>All</NavLink>
            <NavLink to="/active" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Active</NavLink>
            <NavLink to="/done" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Done</NavLink>
          </div>
        </nav>
        <main className="wrap">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/active" element={<ActivePage />} />
            <Route path="/done" element={<DonePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}