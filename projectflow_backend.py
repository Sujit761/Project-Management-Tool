from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, select, update, delete
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import asyncio
import json
import uuid

# ─── Config ───────────────────────────────────────────────────────────────────
SECRET_KEY = "projectflow-super-secret-key-2024-change-in-prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

DATABASE_URL = "sqlite+aiosqlite:///./projectflow.db"

# ─── DB Setup ─────────────────────────────────────────────────────────────────
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

# ─── Models ───────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    email = Column(String(100), unique=True, index=True)
    full_name = Column(String(100))
    hashed_password = Column(String(200))
    avatar_color = Column(String(10), default="#6366f1")
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    description = Column(Text, default="")
    color = Column(String(10), default="#6366f1")
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ProjectMember(Base):
    __tablename__ = "project_members"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String(20), default="member")  # owner, admin, member
    joined_at = Column(DateTime, default=datetime.utcnow)

class Column_(Base):
    __tablename__ = "columns"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(100))
    position = Column(Integer, default=0)
    color = Column(String(10), default="#64748b")
    created_at = Column(DateTime, default=datetime.utcnow)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500))
    description = Column(Text, default="")
    column_id = Column(Integer, ForeignKey("columns.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"))
    priority = Column(String(20), default="medium")  # low, medium, high, urgent
    due_date = Column(DateTime, nullable=True)
    position = Column(Integer, default=0)
    tags = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200))
    message = Column(Text)
    type = Column(String(50))  # task_assigned, comment_added, project_invite
    is_read = Column(Boolean, default=False)
    related_project_id = Column(Integer, nullable=True)
    related_task_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# ─── Pydantic Schemas ─────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    avatar_color: str
    created_at: datetime
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#6366f1"

class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    color: str
    owner_id: int
    created_at: datetime
    member_count: Optional[int] = 0
    task_count: Optional[int] = 0
    model_config = {"from_attributes": True}

class ColumnCreate(BaseModel):
    name: str
    color: Optional[str] = "#64748b"
    position: Optional[int] = 0

class ColumnOut(BaseModel):
    id: int
    project_id: int
    name: str
    position: int
    color: str
    model_config = {"from_attributes": True}

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    column_id: int
    assignee_id: Optional[int] = None
    priority: Optional[str] = "medium"
    due_date: Optional[datetime] = None
    tags: Optional[str] = ""

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    column_id: Optional[int] = None
    assignee_id: Optional[int] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    tags: Optional[str] = None
    position: Optional[int] = None

class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    column_id: int
    project_id: int
    assignee_id: Optional[int]
    creator_id: int
    priority: str
    due_date: Optional[datetime]
    position: int
    tags: str
    created_at: datetime
    updated_at: datetime
    assignee: Optional[UserOut] = None
    creator: Optional[UserOut] = None
    comment_count: Optional[int] = 0
    model_config = {"from_attributes": True}

class CommentCreate(BaseModel):
    content: str

class CommentOut(BaseModel):
    id: int
    task_id: int
    user_id: int
    content: str
    created_at: datetime
    user: Optional[UserOut] = None
    model_config = {"from_attributes": True}

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    related_project_id: Optional[int]
    related_task_id: Optional[int]
    created_at: datetime
    model_config = {"from_attributes": True}

# ─── Auth Utils ───────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def get_password_hash(password): return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="Could not validate credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

# ─── WebSocket Manager ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}  # project_id -> [ws]
        self.user_connections: Dict[int, List[WebSocket]] = {}    # user_id -> [ws]

    async def connect(self, websocket: WebSocket, project_id: int, user_id: int):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, project_id: int, user_id: int):
        if project_id in self.active_connections:
            self.active_connections[project_id] = [
                ws for ws in self.active_connections[project_id] if ws != websocket
            ]
        if user_id in self.user_connections:
            self.user_connections[user_id] = [
                ws for ws in self.user_connections[user_id] if ws != websocket
            ]

    async def broadcast_to_project(self, project_id: int, message: dict, exclude: WebSocket = None):
        if project_id in self.active_connections:
            dead = []
            for ws in self.active_connections[project_id]:
                if ws == exclude:
                    continue
                try:
                    await ws.send_json(message)
                except:
                    dead.append(ws)
            for ws in dead:
                self.active_connections[project_id].remove(ws)

    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.user_connections:
            dead = []
            for ws in self.user_connections[user_id]:
                try:
                    await ws.send_json(message)
                except:
                    dead.append(ws)
            for ws in dead:
                self.user_connections[user_id].remove(ws)

manager = ConnectionManager()

# ─── App Setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="ProjectFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed demo user
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "demo"))
        if not result.scalar_one_or_none():
            demo = User(
                username="demo", email="demo@projectflow.io",
                full_name="Demo User", avatar_color="#6366f1",
                hashed_password=get_password_hash("demo123")
            )
            db.add(demo)
            await db.commit()

# ─── Auth Routes ──────────────────────────────────────────────────────────────
@app.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(
        (User.username == user_data.username) | (User.email == user_data.email)
    ))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Username or email already registered")
    colors = ["#6366f1","#ec4899","#14b8a6","#f97316","#8b5cf6","#06b6d4","#84cc16","#f59e0b"]
    import random
    user = User(
        username=user_data.username, email=user_data.email,
        full_name=user_data.full_name, avatar_color=random.choice(colors),
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token({"sub": user.username}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Incorrect username or password")
    token = create_access_token({"sub": user.username}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.get("/auth/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ─── Users ────────────────────────────────────────────────────────────────────
@app.get("/users/search", response_model=List[UserOut])
async def search_users(q: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(User).where(
            (User.username.contains(q)) | (User.full_name.contains(q)) | (User.email.contains(q))
        ).limit(10)
    )
    return result.scalars().all()

# ─── Projects ─────────────────────────────────────────────────────────────────
@app.get("/projects", response_model=List[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get projects where user is a member
    result = await db.execute(
        select(Project).join(ProjectMember, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
    )
    projects = result.scalars().all()
    out = []
    for p in projects:
        mc = await db.execute(select(ProjectMember).where(ProjectMember.project_id == p.id))
        tc = await db.execute(select(Task).where(Task.project_id == p.id))
        po = ProjectOut.model_validate(p)
        po.member_count = len(mc.scalars().all())
        po.task_count = len(tc.scalars().all())
        out.append(po)
    return out

@app.post("/projects", response_model=ProjectOut)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = Project(name=data.name, description=data.description, color=data.color, owner_id=current_user.id)
    db.add(project)
    await db.flush()
    # Add owner as member
    member = ProjectMember(project_id=project.id, user_id=current_user.id, role="owner")
    db.add(member)
    # Create default columns
    defaults = [("To Do", "#64748b"), ("In Progress", "#3b82f6"), ("In Review", "#f59e0b"), ("Done", "#22c55e")]
    for i, (name, color) in enumerate(defaults):
        db.add(Column_(project_id=project.id, name=name, color=color, position=i))
    await db.commit()
    await db.refresh(project)
    po = ProjectOut.model_validate(project)
    po.member_count = 1
    po.task_count = 0
    return po

@app.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")
    # Check membership
    mr = await db.execute(select(ProjectMember).where(
        ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id
    ))
    if not mr.scalar_one_or_none():
        raise HTTPException(403, "Not a member of this project")
    mc = await db.execute(select(ProjectMember).where(ProjectMember.project_id == project_id))
    tc = await db.execute(select(Task).where(Task.project_id == project_id))
    po = ProjectOut.model_validate(project)
    po.member_count = len(mc.scalars().all())
    po.task_count = len(tc.scalars().all())
    return po

@app.post("/projects/{project_id}/members")
async def add_member(project_id: int, user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ProjectMember).where(
        ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
    ))
    if result.scalar_one_or_none():
        raise HTTPException(400, "User is already a member")
    target = await db.execute(select(User).where(User.id == user_id))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, "User not found")
    member = ProjectMember(project_id=project_id, user_id=user_id, role="member")
    db.add(member)
    # Notify
    project = await db.execute(select(Project).where(Project.id == project_id))
    proj = project.scalar_one_or_none()
    notif = Notification(
        user_id=user_id, title="Project Invitation",
        message=f"{current_user.full_name} added you to '{proj.name}'",
        type="project_invite", related_project_id=project_id
    )
    db.add(notif)
    await db.commit()
    await manager.send_to_user(user_id, {"type": "notification", "message": f"Added to project: {proj.name}"})
    return {"success": True}

@app.get("/projects/{project_id}/members", response_model=List[UserOut])
async def get_members(project_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(User).join(ProjectMember, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
    )
    return result.scalars().all()

# ─── Columns ──────────────────────────────────────────────────────────────────
@app.get("/projects/{project_id}/columns", response_model=List[ColumnOut])
async def get_columns(project_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(Column_).where(Column_.project_id == project_id).order_by(Column_.position)
    )
    return result.scalars().all()

@app.post("/projects/{project_id}/columns", response_model=ColumnOut)
async def create_column(project_id: int, data: ColumnCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    col = Column_(project_id=project_id, name=data.name, color=data.color, position=data.position)
    db.add(col)
    await db.commit()
    await db.refresh(col)
    await manager.broadcast_to_project(project_id, {"type": "column_created", "data": {"id": col.id, "name": col.name, "project_id": project_id, "position": col.position, "color": col.color}})
    return col

@app.delete("/projects/{project_id}/columns/{column_id}")
async def delete_column(project_id: int, column_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await db.execute(delete(Task).where(Task.column_id == column_id))
    await db.execute(delete(Column_).where(Column_.id == column_id))
    await db.commit()
    await manager.broadcast_to_project(project_id, {"type": "column_deleted", "data": {"id": column_id}})
    return {"success": True}

# ─── Tasks ────────────────────────────────────────────────────────────────────
async def enrich_task(task: Task, db: AsyncSession) -> TaskOut:
    to = TaskOut.model_validate(task)
    if task.assignee_id:
        ar = await db.execute(select(User).where(User.id == task.assignee_id))
        to.assignee = ar.scalar_one_or_none()
    cr = await db.execute(select(User).where(User.id == task.creator_id))
    to.creator = cr.scalar_one_or_none()
    cc = await db.execute(select(Comment).where(Comment.task_id == task.id))
    to.comment_count = len(cc.scalars().all())
    return to

@app.get("/projects/{project_id}/tasks", response_model=List[TaskOut])
async def get_tasks(project_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.position)
    )
    tasks = result.scalars().all()
    return [await enrich_task(t, db) for t in tasks]

@app.post("/projects/{project_id}/tasks", response_model=TaskOut)
async def create_task(project_id: int, data: TaskCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get max position in column
    result = await db.execute(select(Task).where(Task.column_id == data.column_id))
    existing = result.scalars().all()
    position = len(existing)
    task = Task(
        title=data.title, description=data.description, column_id=data.column_id,
        project_id=project_id, assignee_id=data.assignee_id, creator_id=current_user.id,
        priority=data.priority, due_date=data.due_date, tags=data.tags, position=position
    )
    db.add(task)
    await db.flush()
    # Notify assignee
    if data.assignee_id and data.assignee_id != current_user.id:
        project_r = await db.execute(select(Project).where(Project.id == project_id))
        proj = project_r.scalar_one_or_none()
        notif = Notification(
            user_id=data.assignee_id, title="Task Assigned",
            message=f"{current_user.full_name} assigned you '{data.title}' in {proj.name}",
            type="task_assigned", related_project_id=project_id, related_task_id=task.id
        )
        db.add(notif)
    await db.commit()
    await db.refresh(task)
    enriched = await enrich_task(task, db)
    task_dict = enriched.model_dump(mode="json")
    await manager.broadcast_to_project(project_id, {"type": "task_created", "data": task_dict})
    return enriched

@app.patch("/projects/{project_id}/tasks/{task_id}", response_model=TaskOut)
async def update_task(project_id: int, task_id: int, data: TaskUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    old_assignee = task.assignee_id
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    for k, v in update_data.items():
        setattr(task, k, v)
    # Notify new assignee
    if data.assignee_id and data.assignee_id != old_assignee and data.assignee_id != current_user.id:
        project_r = await db.execute(select(Project).where(Project.id == project_id))
        proj = project_r.scalar_one_or_none()
        notif = Notification(
            user_id=data.assignee_id, title="Task Assigned",
            message=f"{current_user.full_name} assigned you '{task.title}' in {proj.name}",
            type="task_assigned", related_project_id=project_id, related_task_id=task_id
        )
        db.add(notif)
    await db.commit()
    await db.refresh(task)
    enriched = await enrich_task(task, db)
    task_dict = enriched.model_dump(mode="json")
    await manager.broadcast_to_project(project_id, {"type": "task_updated", "data": task_dict})
    return enriched

@app.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_task(project_id: int, task_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await db.execute(delete(Comment).where(Comment.task_id == task_id))
    await db.execute(delete(Task).where(Task.id == task_id))
    await db.commit()
    await manager.broadcast_to_project(project_id, {"type": "task_deleted", "data": {"id": task_id}})
    return {"success": True}

# ─── Comments ─────────────────────────────────────────────────────────────────
@app.get("/tasks/{task_id}/comments", response_model=List[CommentOut])
async def get_comments(task_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Comment).where(Comment.task_id == task_id).order_by(Comment.created_at))
    comments = result.scalars().all()
    out = []
    for c in comments:
        co = CommentOut.model_validate(c)
        ur = await db.execute(select(User).where(User.id == c.user_id))
        co.user = ur.scalar_one_or_none()
        out.append(co)
    return out

@app.post("/tasks/{task_id}/comments", response_model=CommentOut)
async def create_comment(task_id: int, data: CommentCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = Comment(task_id=task_id, user_id=current_user.id, content=data.content)
    db.add(comment)
    # Get task for notification
    task_r = await db.execute(select(Task).where(Task.id == task_id))
    task = task_r.scalar_one_or_none()
    if task and task.assignee_id and task.assignee_id != current_user.id:
        notif = Notification(
            user_id=task.assignee_id, title="New Comment",
            message=f"{current_user.full_name} commented on '{task.title}'",
            type="comment_added", related_project_id=task.project_id, related_task_id=task_id
        )
        db.add(notif)
    await db.commit()
    await db.refresh(comment)
    co = CommentOut.model_validate(comment)
    co.user = current_user
    comment_dict = co.model_dump(mode="json")
    if task:
        await manager.broadcast_to_project(task.project_id, {"type": "comment_added", "data": comment_dict})
    return co

@app.delete("/tasks/{task_id}/comments/{comment_id}")
async def delete_comment(task_id: int, comment_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Comment).where(Comment.id == comment_id, Comment.user_id == current_user.id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(403, "Not authorized")
    await db.execute(delete(Comment).where(Comment.id == comment_id))
    await db.commit()
    return {"success": True}

# ─── Notifications ────────────────────────────────────────────────────────────
@app.get("/notifications", response_model=List[NotificationOut])
async def get_notifications(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Notification).where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc()).limit(50)
    )
    return result.scalars().all()

@app.post("/notifications/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await db.execute(update(Notification).where(
        Notification.user_id == current_user.id, Notification.is_read == False
    ).values(is_read=True))
    await db.commit()
    return {"success": True}

@app.get("/notifications/unread-count")
async def unread_count(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Notification).where(
        Notification.user_id == current_user.id, Notification.is_read == False
    ))
    return {"count": len(result.scalars().all())}

# ─── WebSocket ────────────────────────────────────────────────────────────────
@app.websocket("/ws/{project_id}/{token}")
async def websocket_endpoint(websocket: WebSocket, project_id: int, token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except:
        await websocket.close(code=1008)
        return
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if not user:
            await websocket.close(code=1008)
            return
    await manager.connect(websocket, project_id, user.id)
    try:
        await manager.broadcast_to_project(project_id, {
            "type": "user_joined",
            "data": {"user_id": user.id, "username": user.username, "full_name": user.full_name}
        }, exclude=websocket)
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id, user.id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
