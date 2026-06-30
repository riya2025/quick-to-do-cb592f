from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"


def test_create_task():
    response = client.post("/api/tasks", json={"title": "Test task"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["id"], str)
    assert isinstance(data["title"], str)
    assert isinstance(data["done"], bool)
    assert isinstance(data["created_at"], str)
    assert data["title"] == "Test task"
    assert data["done"] is False


def test_list_tasks():
    client.post("/api/tasks", json={"title": "List task 1"})
    client.post("/api/tasks", json={"title": "List task 2"})
    
    response = client.get("/api/tasks")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    for task in data:
        assert isinstance(task["id"], str)
        assert isinstance(task["title"], str)
        assert isinstance(task["done"], bool)
        assert isinstance(task["created_at"], str)


def test_list_tasks_filter_active():
    client.post("/api/tasks", json={"title": "Active task"})
    
    response = client.get("/api/tasks", params={"filter": "Active"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for task in data:
        assert task["done"] is False


def test_list_tasks_filter_done():
    create_resp = client.post("/api/tasks", json={"title": "Done filter task"})
    task_id = create_resp.json()["id"]
    client.put(f"/api/tasks/{task_id}", json={"done": True})
    
    response = client.get("/api/tasks", params={"filter": "Done"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for task in data:
        assert task["done"] is True


def test_update_task_title():
    create_resp = client.post("/api/tasks", json={"title": "Original title"})
    task_id = create_resp.json()["id"]
    
    update_resp = client.put(f"/api/tasks/{task_id}", json={"title": "Updated title"})
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert isinstance(data["id"], str)
    assert isinstance(data["title"], str)
    assert isinstance(data["done"], bool)
    assert isinstance(data["created_at"], str)
    assert data["title"] == "Updated title"


def test_update_task_done():
    create_resp = client.post("/api/tasks", json={"title": "Mark done task"})
    task_id = create_resp.json()["id"]
    
    update_resp = client.put(f"/api/tasks/{task_id}", json={"done": True})
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert isinstance(data["id"], str)
    assert isinstance(data["title"], str)
    assert isinstance(data["done"], bool)
    assert isinstance(data["created_at"], str)
    assert data["done"] is True


def test_update_task_no_fields():
    create_resp = client.post("/api/tasks", json={"title": "No update task"})
    task_id = create_resp.json()["id"]
    
    update_resp = client.put(f"/api/tasks/{task_id}", json={})
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["title"] == "No update task"
    assert data["done"] is False


def test_update_task_not_found():
    response = client.put("/api/tasks/nonexistent_id", json={"title": "Does not matter"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


def test_delete_task():
    create_resp = client.post("/api/tasks", json={"title": "Delete me"})
    task_id = create_resp.json()["id"]
    
    delete_resp = client.delete(f"/api/tasks/{task_id}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["detail"] == "Task deleted"


def test_delete_task_not_found():
    response = client.delete("/api/tasks/nonexistent_id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"