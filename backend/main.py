import secrets
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db

app = FastAPI(title="Quick To-Do")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(db.router)


class TaskCreate(BaseModel):
    title: str


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None


class TaskOut(BaseModel):
    id: str
    title: str
    done: bool
    created_at: str


@app.on_event("startup")
def startup():
    db.init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/tasks", response_model=TaskOut)
def create_task(body: TaskCreate):
    task_id = secrets.token_hex(8)
    now = datetime.utcnow().isoformat()
    task = {
        "id": task_id,
        "title": body.title,
        "done": False,
        "created_at": now,
    }
    db.add_record("tasks", task)
    return task


@app.get("/api/tasks", response_model=List[TaskOut])
def list_tasks(filter: Optional[str] = None):
    tasks = db.list_records("tasks")
    if filter == "Active":
        tasks = [t for t in tasks if not t.get("done", False)]
    elif filter == "Done":
        tasks = [t for t in tasks if t.get("done", False)]
    return tasks


@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: str, body: TaskUpdate):
    existing = None
    for t in db.list_records("tasks"):
        if t["id"] == task_id:
            existing = t
            break
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    update_data = {}
    if body.title is not None:
        update_data["title"] = body.title
    if body.done is not None:
        update_data["done"] = body.done
    if not update_data:
        return existing
    db.update_record(task_id, update_data)
    existing.update(update_data)
    return existing


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    existing = None
    for t in db.list_records("tasks"):
        if t["id"] == task_id:
            existing = t
            break
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete_record(task_id)
    return {"detail": "Task deleted"}
