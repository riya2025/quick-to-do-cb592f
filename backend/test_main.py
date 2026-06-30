from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_add_task():
    response = client.post("/api/tasks", json={"title": "Test task"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["id"], str)
    assert data["title"] == "Test task"
    assert data["done"] is False


def test_list_tasks():
    client.post("/api/tasks", json={"title": "Task A"})
    client.post("/api/tasks", json={"title": "Task B"})
    response = client.get("/api/tasks")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for item in data:
        assert isinstance(item["id"], str)
        assert isinstance(item["title"], str)
        assert isinstance(item["done"], bool)


def test_list_tasks_filter_active():
    resp1 = client.post("/api/tasks", json={"title": "Active task"})
    task_id = resp1.json()["id"]
    resp2 = client.post("/api/tasks", json={"title": "Done task"})
    done_id = resp2.json()["id"]
    client.put(f"/api/tasks/{done_id}", json={"done": True})

    response = client.get("/api/tasks", params={"filter": "Active"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for item in data:
        assert item["done"] is False
    assert any(t["id"] == task_id for t in data)


def test_list_tasks_filter_done():
    resp1 = client.post("/api/tasks", json={"title": "Active task 2"})
    active_id = resp1.json()["id"]
    resp2 = client.post("/api/tasks", json={"title": "Done task 2"})
    done_id = resp2.json()["id"]
    client.put(f"/api/tasks/{done_id}", json={"done": True})

    response = client.get("/api/tasks", params={"filter": "Done"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for item in data:
        assert item["done"] is True
    assert any(t["id"] == done_id for t in data)


def test_update_task_title():
    resp = client.post("/api/tasks", json={"title": "Old title"})
    task_id = resp.json()["id"]
    response = client.put(f"/api/tasks/{task_id}", json={"title": "New title"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == task_id
    assert data["title"] == "New title"
    assert data["done"] is False


def test_update_task_done():
    resp = client.post("/api/tasks", json={"title": "Task to complete"})
    task_id = resp.json()["id"]
    response = client.put(f"/api/tasks/{task_id}", json={"done": True})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == task_id
    assert data["done"] is True


def test_update_task_no_fields():
    resp = client.post("/api/tasks", json={"title": "No change task"})
    task_id = resp.json()["id"]
    response = client.put(f"/api/tasks/{task_id}", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == task_id
    assert data["title"] == "No change task"
    assert data["done"] is False


def test_update_task_not_found():
    response = client.put("/api/tasks/nonexistent-id", json={"title": "X"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


def test_delete_task():
    resp = client.post("/api/tasks", json={"title": "Task to delete"})
    task_id = resp.json()["id"]
    response = client.delete(f"/api/tasks/{task_id}")
    assert response.status_code == 200
    assert response.json() == {"detail": "Task deleted"}

    verify = client.get("/api/tasks")
    assert all(t["id"] != task_id for t in verify.json())


def test_delete_task_not_found():
    response = client.delete("/api/tasks/nonexistent-id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"