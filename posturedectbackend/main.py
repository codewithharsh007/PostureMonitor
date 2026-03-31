from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from typing import List, Optional
from posture_detector import PostureDetector
import asyncio, json, time, os
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────
# All secrets and config come from .env — never hardcoded
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
JWT_SECRET = os.getenv("JWT_SECRET", "changeme_use_a_real_secret")
JWT_ALGO = "HS256"
JWT_EXPIRE = int(os.getenv("JWT_EXPIRE_HOURS", 24))

# bcrypt password hashing context — requires bcrypt==4.0.1
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTPBearer reads "Authorization: Bearer <token>" header
# auto_error=False means it returns None instead of 401 if header missing
# we handle the 401 manually in get_current_user
bearer = HTTPBearer(auto_error=False)

# ── MongoDB ───────────────────────────────────────────────────────
# AsyncIOMotorClient is the async MongoDB driver — works with FastAPI's async routes
mongo_client = AsyncIOMotorClient(MONGO_URI)
db = mongo_client["posture_mentor"]
users_col = db["users"]
posture_logs_col = db["posture_logs"]
notifs_col = db["notifications"]

# ── Per-user PostureDetector instances ────────────────────────────
# Dict maps user_id → their own PostureDetector instance
# This isolates each user's smoothed_score, bad_posture_timer, grace_period
# Refreshing the browser does NOT reset this — it lives on the server
user_detectors: dict[str, PostureDetector] = {}


def get_detector(user_id: str) -> PostureDetector:
    # Lazy init — create detector on first frame from this user
    if user_id not in user_detectors:
        user_detectors[user_id] = PostureDetector()
    return user_detectors[user_id]


# ── WebSocket Manager ─────────────────────────────────────────────
# Per-user rooms: each user_id maps to a list of their WebSocket connections
# Supports multiple tabs open at once for the same user
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
        # Send to all open tabs for this user, silently drop dead connections
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


# ── Lifespan (replaces deprecated @app.on_event) ─────────────────
# FastAPI 0.93+ uses lifespan context manager for startup/shutdown
# Everything before `yield` runs on startup, after yield on shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create MongoDB indexes on startup
    # unique=True on username prevents duplicate registrations at DB level
    await users_col.create_index("username", unique=True)
    await posture_logs_col.create_index([("user_id", 1), ("created_at", -1)])
    await notifs_col.create_index([("user_id", 1), ("created_at", -1)])
    print("[startup] MongoDB indexes created")

    # Seed default admin account if no admin exists yet
    # This runs once — subsequent restarts skip it
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
    # Shutdown — close MongoDB connection cleanly
    mongo_client.close()
    print("[shutdown] MongoDB connection closed")


# ── App Init ──────────────────────────────────────────────────────
app = FastAPI(title="Posture Mentor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production: replace with your actual domain
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── JWT Helpers ───────────────────────────────────────────────────
def create_token(data: dict) -> str:
    # Add expiry to payload and sign with HS256
    payload = {**data, "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    # Called on every protected route via Depends(get_current_user)
    # Validates JWT, fetches user from DB, returns user dict
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
    # Stacked dependency — first validates JWT, then checks role
    # Returns 403 for valid users who are not admins
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
    frame: str  # base64 encoded JPEG from browser canvas
    session_id: Optional[str] = None


# ── Auth Routes ───────────────────────────────────────────────────
@app.post("/auth/register")
async def register(body: RegisterBody):
    # Validate length before hitting DB
    if len(body.username) < 3:
        raise HTTPException(
            status_code=400, detail="Username must be at least 3 characters"
        )
    if len(body.password) < 6:
        raise HTTPException(
            status_code=400, detail="Password must be at least 6 characters"
        )

    # Normalize username to lowercase before storing
    username = body.username.lower().strip()
    existing = await users_col.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Build unique user_id from timestamp + username
    # Using string _id instead of ObjectId for simpler JWT handling
    user_id = f"user_{int(time.time())}_{username}"
    await users_col.insert_one(
        {
            "_id": user_id,
            "username": username,
            "email": body.email.lower().strip(),
            "password": pwd_ctx.hash(body.password),  # bcrypt hash
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

    # pwd_ctx.verify does constant-time comparison — safe against timing attacks
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
    # Used by frontend on load to verify token is still valid
    return {
        "username": user["username"],
        "role": user["role"],
        "email": user.get("email", ""),
    }


# ── Core Model Endpoint ───────────────────────────────────────────
@app.post("/model/analyze")
async def analyze(body: AnalyzeBody, user=Depends(get_current_user)):
    user_id = user["_id"]

    # Get or create this user's isolated PostureDetector instance
    detector = get_detector(user_id)

    # Decode base64 frame → run MediaPipe → run your analyze_posture() logic
    result = detector.analyze_frame(body.frame)

    if result is None:
        # No human pose detected in frame (e.g. user stepped away)
        # Return 100 so dashboard doesn't show false bad posture
        return {"status": "no_pose", "posture_score": 100}

    now = datetime.utcnow().isoformat()

    # Build DB log — strip internal notification flags before saving
    log = {
        **result,
        "user_id": user_id,
        "session_id": body.session_id,
        "created_at": now,
    }
    log.pop("should_notify", None)
    log.pop("notify_msg", None)
    await posture_logs_col.insert_one(log)

    # Build clean payload for WebSocket (no internal flags)
    ws_payload = {
        k: v for k, v in result.items() if k not in ("should_notify", "notify_msg")
    }

    # Broadcast posture data to this user's open dashboard tabs
    await manager.send(user_id, json.dumps(ws_payload))

    # If bad posture threshold crossed — save notification + send browser alert
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

        # This special message type triggers browser Notification API on frontend
        alert_payload = json.dumps(
            {
                "type": "POSTURE_ALERT",
                "title": "Bad Posture Alert",
                "message": result["notify_msg"],
            }
        )
        await manager.send(user_id, alert_payload)

    # Return clean result to camera page for live metrics display
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

    # ✅ Strip ObjectId _id before returning — FastAPI can't serialize it
    clean_logs = []
    for l in logs[:100]:
        l["id"] = str(l.pop("_id"))  # convert ObjectId → string, rename to "id"
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

    # Group logs by date (first 10 chars of ISO string = YYYY-MM-DD)
    daily: dict = defaultdict(list)
    for log in logs:
        daily[log["created_at"][:10]].append(log)

    days = []
    for day, day_logs in sorted(daily.items()):
        avg_score = sum(l["posture_score"] for l in day_logs) / len(day_logs)
        # Sum all bad_posture_duration values and convert seconds → minutes
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
        # Trend = comparing first day's avg to last day's avg
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
        # MongoDB _id is ObjectId — convert to string for JSON serialization
        n["id"] = str(n["_id"])
        del n["_id"]
        result.append(n)
    return result


@app.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user=Depends(get_current_user)):
    from bson import ObjectId

    try:
        await notifs_col.update_one(
            # Double check user_id so users can't mark other users' notifs
            {"_id": ObjectId(notif_id), "user_id": user["_id"]},
            {"$set": {"read": True}},
        )
    except Exception:
        pass  # Invalid ObjectId format — just ignore
    return {"status": "ok"}


@app.delete("/notifications/clear")
async def clear_notifications(user=Depends(get_current_user)):
    await notifs_col.delete_many({"user_id": user["_id"]})
    return {"status": "ok"}


# ── Admin Routes ──────────────────────────────────────────────────
@app.get("/admin/stats")
async def admin_stats(_=Depends(require_admin)):
    # require_admin dependency enforces admin role before this runs
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
    for u in users:
        u["id"] = str(u["_id"])
    return users


# ── Health Check ──────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "Posture Mentor API running",
        "connections": manager.active_count(),
    }


# ── WebSocket ─────────────────────────────────────────────────────
@app.websocket("/ws/posture")
async def ws_posture(ws: WebSocket, token: str):
    # Token passed as query param: ws://host/ws/posture?token=xxx
    # Validate JWT before accepting connection
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
                # Wait for ping from client with 30s timeout
                msg = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                if msg == "ping":
                    await ws.send_text("pong")
            except asyncio.TimeoutError:
                # Send keepalive to prevent proxy/load balancer from closing idle connection
                await ws.send_text(json.dumps({"ping": True}))
    except WebSocketDisconnect:
        manager.disconnect(ws, user_id)
    except Exception:
        manager.disconnect(ws, user_id)
