import os
import random
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db

app = FastAPI(title="Quick To-Do", version="1.0.0")

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


class TaskListResponse(BaseModel):
    tasks: List[TaskOut]


@app.on_event("startup")
def startup():
    db.init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/tasks", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreate):
    data = {
        "title": body.title,
        "done": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    record = db.add_record("tasks", data)
    return record


@app.get("/api/tasks", response_model=TaskListResponse)
def list_tasks(filter: Optional[str] = Query(None, alias="filter")):
    records = db.list_records("tasks")
    if filter == "active":
        records = [r for r in records if not r.get("done", False)]
    elif filter == "done":
        records = [r for r in records if r.get("done", False)]
    return {"tasks": records}


@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: str, body: TaskUpdate):
    existing = None
    for r in db.list_records("tasks"):
        if r.get("id") == task_id:
            existing = r
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
    updated = db.update_record(task_id, update_data)
    return updated


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    existing = None
    for r in db.list_records("tasks"):
        if r.get("id") == task_id:
            existing = r
            break
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete_record(task_id)
    return {"detail": "Task deleted"}
