import os
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import db

app = FastAPI(title="Quick To-Do")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    db.init_db()


app.include_router(db.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


class TaskCreate(BaseModel):
    title: str


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None


class TaskOut(BaseModel):
    id: str
    title: str
    done: bool


@app.post("/api/tasks", response_model=TaskOut)
def add_task(task_in: TaskCreate):
    data = {"title": task_in.title, "done": False}
    record = db.add_record("tasks", data)
    return record


@app.get("/api/tasks", response_model=List[TaskOut])
def list_tasks(filter: Optional[str] = None):
    records = db.list_records("tasks")
    if filter == "Active":
        records = [r for r in records if not r.get("done")]
    elif filter == "Done":
        records = [r for r in records if r.get("done")]
    return records


@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: str, task_in: TaskUpdate):
    existing = None
    for r in db.list_records("tasks"):
        if r["id"] == task_id:
            existing = r
            break
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    update_data = {}
    if task_in.title is not None:
        update_data["title"] = task_in.title
    if task_in.done is not None:
        update_data["done"] = task_in.done
    if not update_data:
        return existing
    updated = db.update_record(task_id, update_data)
    return updated


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    existing = None
    for r in db.list_records("tasks"):
        if r["id"] == task_id:
            existing = r
            break
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete_record(task_id)
    return {"detail": "Task deleted"}
