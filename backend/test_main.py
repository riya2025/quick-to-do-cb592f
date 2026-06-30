from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok"}


def test_create_task():
    response = client.post("/api/tasks", json={"title": "Test task"})
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data["id"], str)
    assert data["title"] == "Test task"
    assert data["done"] is False
    assert isinstance(data["created_at"], str)


def test_list_tasks():
    client.post("/api/tasks", json={"title": "Task 1"})
    response = client.get("/api/tasks")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        task = data[-1]
        assert isinstance(task["id"], str)
        assert isinstance(task["title"], str)
        assert isinstance(task["done"], bool)
        assert isinstance(task["created_at"], str)


def test_list_tasks_filter_active():
    client.post("/api/tasks", json={"title": "Active task"})
    response = client.get("/api/tasks", params={"filter": "active"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for task in data:
        assert task["done"] is False


def test_list_tasks_filter_done():
    create_resp = client.post("/api/tasks", json={"title": "Task to complete"})
    task_id = create_resp.json()["id"]
    client.put(f"/api/tasks/{task_id}", json={"done": True})
    
    response = client.get("/api/tasks", params={"filter": "done"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for task in data:
        assert task["done"] is True


def test_update_task_title():
    create_resp = client.post("/api/tasks", json={"title": "Old title"})
    task_id = create_resp.json()["id"]
    
    update_resp = client.put(f"/api/tasks/{task_id}", json={"title": "New title"})
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["id"] == task_id
    assert data["title"] == "New title"
    assert data["done"] is False


def test_update_task_done():
    create_resp = client.post("/api/tasks", json={"title": "Task to mark done"})
    task_id = create_resp.json()["id"]
    
    update_resp = client.put(f"/api/tasks/{task_id}", json={"done": True})
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["id"] == task_id
    assert data["done"] is True


def test_update_task_no_fields():
    create_resp = client.post("/api/tasks", json={"title": "Unchanged task"})
    task_id = create_resp.json()["id"]
    
    update_resp = client.put(f"/api/tasks/{task_id}", json={})
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["id"] == task_id
    assert data["title"] == "Unchanged task"
    assert data["done"] is False


def test_update_task_not_found():
    response = client.put("/api/tasks/nonexistent-id", json={"title": "Doesn't matter"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


def test_delete_task():
    create_resp = client.post("/api/tasks", json={"title": "Task to delete"})
    task_id = create_resp.json()["id"]
    
    delete_resp = client.delete(f"/api/tasks/{task_id}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["detail"] == "Task deleted"
    
    list_resp = client.get("/api/tasks")
    task_ids = [t["id"] for t in list_resp.json()]
    assert task_id not in task_ids


def test_delete_task_not_found():
    response = client.delete("/api/tasks/nonexistent-id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"