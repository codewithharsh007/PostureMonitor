from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.encoders import ENCODERS_BY_TYPE
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from typing import List, Optional
from posture_detector import PostureDetector
from bson import ObjectId
import asyncio, json, time, os
from dotenv import load_dotenv

load_dotenv()

# ── Global ObjectId fix — all routes serialized correctly ─────────
ENCODERS_BY_TYPE[ObjectId] = str

# ── Config ────────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
JWT_SECRET = os.getenv("JWT_SECRET", "changeme_use_a_real_secret")
JWT_ALGO = "HS256"
JWT_EXPIRE = int(os.getenv("JWT_EXPIRE_HOURS", 24))

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

# ── MongoDB ───────────────────────────────────────────────────────
mongo_client = AsyncIOMotorClient(MONGO_URI)
db = mongo_client["posture_mentor"]
users_col = db["users"]
posture_logs_col = db["posture_logs"]
notifs_col = db["notifications"]

# ── Per-user PostureDetector instances ────────────────────────────
user_detectors: dict[str, PostureDetector] = {}


def get_detector(user_id: str) -> PostureDetector:
    if user_id not in user_detectors:
        user_detectors[user_id] = PostureDetector()
    return user_detectors[user_id]


# ── WebSocket Manager ─────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, List[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        self.rooms.setdefault(user_id, []).append(ws)
        print(f"[WS] {user_id} connected. Total for user: {len(self.rooms[user_id])}")

    def disconnect(self, ws: WebSocket, user_id: str):
        if user_id in self.rooms:
            self.rooms[user_id] = [w for w in self.rooms[user_id] if w != ws]

    async def send(self, user_id: str, message: str):
        dead = []
        for ws in self.rooms.get(user_id, []):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.disconnect(d, user_id)

    def active_count(self) -> int:
        return sum(len(v) for v in self.rooms.values())


manager = ConnectionManager()


# ── Lifespan ──────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await users_col.create_index("username", unique=True)
    await posture_logs_col.create_index([("user_id", 1), ("created_at", -1)])
    await notifs_col.create_index([("user_id", 1), ("created_at", -1)])
    print("[startup] MongoDB indexes created")

    existing_admin = await users_col.find_one({"role": "admin"})
    if not existing_admin:
        await users_col.insert_one(
            {
                "_id": "admin_default",
                "username": "admin",
                "email": "admin@posturementor.com",
                "password": pwd_ctx.hash("Admin@123"),
                "role": "admin",
                "created_at": datetime.utcnow().isoformat(),
            }
        )
        print("[startup] Default admin created — username: admin | password: Admin@123")

    yield
    mongo_client.close()
    print("[shutdown] MongoDB connection closed")


# ── App Init ──────────────────────────────────────────────────────
app = FastAPI(title="Posture Mentor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with your Vercel URL in production
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# ── JWT Helpers ───────────────────────────────────────────────────
def create_token(data: dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await users_col.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user


# ── Pydantic Models ───────────────────────────────────────────────
class RegisterBody(BaseModel):
    username: str
    email: str
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


class AnalyzeBody(BaseModel):
    frame: str
    session_id: Optional[str] = None


# ── Auth Routes ───────────────────────────────────────────────────
@app.post("/auth/register")
async def register(body: RegisterBody):
    if len(body.username) < 3:
        raise HTTPException(
            status_code=400, detail="Username must be at least 3 characters"
        )
    if len(body.password) < 6:
        raise HTTPException(
            status_code=400, detail="Password must be at least 6 characters"
        )

    username = body.username.lower().strip()
    existing = await users_col.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user_id = f"user_{int(time.time())}_{username}"
    await users_col.insert_one(
        {
            "_id": user_id,
            "username": username,
            "email": body.email.lower().strip(),
            "password": pwd_ctx.hash(body.password),
            "role": "user",
            "created_at": datetime.utcnow().isoformat(),
        }
    )

    token = create_token({"sub": user_id, "role": "user", "username": username})
    return {"token": token, "username": username, "role": "user"}


@app.post("/auth/login")
async def login(body: LoginBody):
    username = body.username.lower().strip()
    user = await users_col.find_one({"username": username})

    if not user or not pwd_ctx.verify(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(
        {
            "sub": user["_id"],
            "role": user["role"],
            "username": user["username"],
        }
    )
    return {"token": token, "username": user["username"], "role": user["role"]}


@app.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {
        "username": user["username"],
        "role": user["role"],
        "email": user.get("email", ""),
    }


# ── Core Model Endpoint ───────────────────────────────────────────
@app.post("/model/analyze")
async def analyze(body: AnalyzeBody, user=Depends(get_current_user)):
    user_id = user["_id"]
    detector = get_detector(user_id)
    result = detector.analyze_frame(body.frame)

    if result is None:
        return {"status": "no_pose", "posture_score": 100}

    now = datetime.utcnow().isoformat() + "Z"

    log = {
        **result,
        "user_id": user_id,
        "session_id": body.session_id,
        "created_at": now,
    }
    log.pop("should_notify", None)
    log.pop("notify_msg", None)
    await posture_logs_col.insert_one(log)

    ws_payload = {
        k: v for k, v in result.items() if k not in ("should_notify", "notify_msg")
    }
    await manager.send(user_id, json.dumps(ws_payload))

    if result.get("should_notify"):
        notif = {
            "user_id": user_id,
            "type": "warning",
            "title": "Bad Posture Alert",
            "message": result["notify_msg"],
            "read": False,
            "created_at": now,
        }
        await notifs_col.insert_one(notif)
        await manager.send(
            user_id,
            json.dumps(
                {
                    "type": "POSTURE_ALERT",
                    "title": "Bad Posture Alert",
                    "message": result["notify_msg"],
                }
            ),
        )

    return {k: v for k, v in result.items() if k not in ("should_notify", "notify_msg")}


# ── Posture Today ─────────────────────────────────────────────────
@app.get("/posture/today")
async def posture_today(user=Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")

    logs = (
        await posture_logs_col.find(
            {"user_id": user["_id"], "created_at": {"$regex": f"^{today}"}}
        )
        .sort("created_at", -1)
        .to_list(2000)
    )

    if not logs:
        return {"avg_score": 0, "total_logs": 0, "logs": []}

    avg = sum(l["posture_score"] for l in logs) / len(logs)

    # ✅ Convert _id → string id for all logs
    clean_logs = []
    for l in logs[:100]:
        l["id"] = str(l.pop("_id"))
        clean_logs.append(l)

    return {
        "avg_score": round(avg, 1),
        "total_logs": len(logs),
        "logs": clean_logs,
    }


# ── Weekly Report ─────────────────────────────────────────────────
@app.get("/reports/weekly")
async def weekly_report(user=Depends(get_current_user)):
    from collections import defaultdict

    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
    logs = await posture_logs_col.find(
        {"user_id": user["_id"], "created_at": {"$gte": seven_days_ago}}
    ).to_list(50000)

    if not logs:
        return {"days": [], "summary": None}

    daily: dict = defaultdict(list)
    for log in logs:
        daily[log["created_at"][:10]].append(log)

    days = []
    for day, day_logs in sorted(daily.items()):
        avg_score = sum(l["posture_score"] for l in day_logs) / len(day_logs)
        bad_mins = sum(l.get("bad_posture_duration", 0) for l in day_logs) / 60
        days.append(
            {
                "date": day,
                "avg_score": round(avg_score, 1),
                "bad_duration_mins": round(bad_mins, 1),
                "neck_issues": sum(1 for l in day_logs if l.get("neck_bad")),
                "spine_issues": sum(1 for l in day_logs if l.get("spine_bad")),
                "leaning_issues": sum(1 for l in day_logs if l.get("leaning")),
                "tilt_issues": sum(1 for l in day_logs if l.get("head_tilt")),
                "total_samples": len(day_logs),
            }
        )

    all_scores = [l["posture_score"] for l in logs]
    summary = {
        "avg_score": round(sum(all_scores) / len(all_scores), 1),
        "best_day": max(days, key=lambda d: d["avg_score"])["date"],
        "worst_day": min(days, key=lambda d: d["avg_score"])["date"],
        "total_bad_mins": round(sum(d["bad_duration_mins"] for d in days), 1),
        "trend": (
            "improving"
            if len(days) > 1 and days[-1]["avg_score"] > days[0]["avg_score"]
            else "declining"
        ),
    }
    return {"days": days, "summary": summary}


# ── Notifications ─────────────────────────────────────────────────
@app.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    notifs = (
        await notifs_col.find({"user_id": user["_id"]})
        .sort("created_at", -1)
        .to_list(50)
    )
    result = []
    for n in notifs:
        n["id"] = str(n["_id"])
        del n["_id"]
        result.append(n)
    return result


@app.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user=Depends(get_current_user)):
    try:
        await notifs_col.update_one(
            {"_id": ObjectId(notif_id), "user_id": user["_id"]},
            {"$set": {"read": True}},
        )
    except Exception:
        pass
    return {"status": "ok"}


@app.delete("/notifications/clear")
async def clear_notifications(user=Depends(get_current_user)):
    await notifs_col.delete_many({"user_id": user["_id"]})
    return {"status": "ok"}


# ── Admin Routes ──────────────────────────────────────────────────
@app.get("/admin/stats")
async def admin_stats(_=Depends(require_admin)):
    total_users = await users_col.count_documents({})
    total_logs = await posture_logs_col.count_documents({})
    return {
        "total_users": total_users,
        "total_posture_logs": total_logs,
        "active_connections": manager.active_count(),
    }


@app.get("/admin/users")
async def admin_users(_=Depends(require_admin)):
    users = await users_col.find({}, {"password": 0}).to_list(100)
    result = []
    for u in users:
        u["id"] = str(u["_id"])
        del u["_id"]  # ✅ remove ObjectId — was missing before
        result.append(u)
    return result


# ── Health Check ──────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "Posture Mentor API running",
        "connections": manager.active_count(),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── WebSocket ─────────────────────────────────────────────────────
@app.websocket("/ws/posture")
async def ws_posture(ws: WebSocket, token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
        if not user_id:
            await ws.close(code=4001)
            return
    except JWTError:
        await ws.close(code=4001)
        return

    await manager.connect(ws, user_id)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                if msg == "ping":
                    await ws.send_text("pong")
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"ping": True}))
    except WebSocketDisconnect:
        manager.disconnect(ws, user_id)
    except Exception:
        manager.disconnect(ws, user_id)
