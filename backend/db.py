"""Persistence layer for the generated app.

Stores records in PostgreSQL when DATABASE_URL is set (Supabase / Render), else
in a local SQLite file. If SQLAlchemy/psycopg aren't installed, falls back to
the stdlib sqlite3 module so the app still runs anywhere. Exposes a generic CRUD
router at /api/store/{collection} plus helper functions for custom endpoints.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any, Dict, List, Optional

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def _normalize(url: str) -> str:
    # SQLAlchemy needs the psycopg v3 driver prefix.
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


_BACKEND = None  # "sqlalchemy" | "sqlite3"
try:
    from sqlalchemy import (Column, Float, MetaData, String, Table, Text,
                            create_engine, delete, insert, select, update)

    _engine_url = _normalize(DATABASE_URL) if DATABASE_URL else "sqlite:///app.db"
    _engine = create_engine(_engine_url, future=True, pool_pre_ping=True)
    _meta = MetaData()
    _records = Table(
        "records", _meta,
        Column("id", String, primary_key=True),
        Column("collection", String, index=True),
        Column("data", Text),
        Column("created_at", Float),
    )
    _BACKEND = "sqlalchemy"
except Exception:  # noqa: BLE001
    import sqlite3

    _conn = sqlite3.connect("app.db", check_same_thread=False)
    _BACKEND = "sqlite3"


def backend_name() -> str:
    if _BACKEND == "sqlalchemy":
        return "postgres" if str(_engine.url).startswith("postgresql") else "sqlite"
    return "sqlite3-stdlib"


def init_db() -> None:
    global _engine
    if _BACKEND == "sqlalchemy":
        try:
            # Verify the configured DB is actually reachable before using it.
            with _engine.connect():
                pass
            _meta.create_all(_engine)
        except Exception:  # noqa: BLE001
            # DATABASE_URL set but unreachable (or no DB at all): fall back to a
            # local SQLite file so the app ALWAYS runs — no hard dependency on
            # the database URL. Data persists locally instead.
            _engine = create_engine("sqlite:///app.db", future=True, pool_pre_ping=True)
            _meta.create_all(_engine)
    else:
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS records "
            "(id TEXT PRIMARY KEY, collection TEXT, data TEXT, created_at REAL)"
        )
        _conn.commit()


def _row(rid: str, collection: str, data: str, created_at: float) -> Dict[str, Any]:
    out = {"id": rid, "collection": collection, "created_at": created_at}
    try:
        out.update(json.loads(data))
    except Exception:  # noqa: BLE001
        out["data"] = data
    return out


def list_records(collection: str) -> List[Dict[str, Any]]:
    if _BACKEND == "sqlalchemy":
        with _engine.begin() as c:
            rows = c.execute(select(_records).where(_records.c.collection == collection)).fetchall()
            return [_row(r.id, r.collection, r.data, r.created_at) for r in rows]
    cur = _conn.execute(
        "SELECT id, collection, data, created_at FROM records WHERE collection=?", (collection,)
    )
    return [_row(*r) for r in cur.fetchall()]


def add_record(collection: str, data: Dict[str, Any]) -> Dict[str, Any]:
    rid = uuid.uuid4().hex[:12]
    ts = time.time()
    payload = json.dumps(data)
    if _BACKEND == "sqlalchemy":
        with _engine.begin() as c:
            c.execute(insert(_records).values(id=rid, collection=collection, data=payload, created_at=ts))
    else:
        _conn.execute("INSERT INTO records VALUES (?,?,?,?)", (rid, collection, payload, ts))
        _conn.commit()
    return _row(rid, collection, payload, ts)


def update_record(rid: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    payload = json.dumps(data)
    if _BACKEND == "sqlalchemy":
        with _engine.begin() as c:
            res = c.execute(update(_records).where(_records.c.id == rid).values(data=payload))
            if res.rowcount == 0:
                return None
            row = c.execute(select(_records).where(_records.c.id == rid)).first()
            return _row(row.id, row.collection, row.data, row.created_at)
    cur = _conn.execute("UPDATE records SET data=? WHERE id=?", (payload, rid))
    _conn.commit()
    if cur.rowcount == 0:
        return None
    r = _conn.execute(
        "SELECT id, collection, data, created_at FROM records WHERE id=?", (rid,)
    ).fetchone()
    return _row(*r) if r else None


def delete_record(rid: str) -> bool:
    if _BACKEND == "sqlalchemy":
        with _engine.begin() as c:
            return c.execute(delete(_records).where(_records.c.id == rid)).rowcount > 0
    cur = _conn.execute("DELETE FROM records WHERE id=?", (rid,))
    _conn.commit()
    return cur.rowcount > 0


# Generic CRUD router (mounted by main.py). Optional: helper functions above can
# back custom endpoints instead.
try:
    from fastapi import APIRouter
    from pydantic import BaseModel

    router = APIRouter(prefix="/api/store", tags=["store"])

    class RecordIn(BaseModel):
        data: Dict[str, Any] = {}

    @router.get("/{collection}")
    def _list(collection: str):
        return list_records(collection)

    @router.post("/{collection}")
    def _create(collection: str, body: RecordIn):
        return add_record(collection, body.data)

    @router.put("/{collection}/{rid}")
    def _update(collection: str, rid: str, body: RecordIn):
        rec = update_record(rid, body.data)
        return rec if rec is not None else {"error": "not found"}

    @router.delete("/{collection}/{rid}")
    def _delete(collection: str, rid: str):
        return {"deleted": delete_record(rid)}
except Exception:  # noqa: BLE001
    router = None
