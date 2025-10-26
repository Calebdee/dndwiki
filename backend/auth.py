from fastapi import APIRouter, Depends, HTTPException, status, Security
from fastapi.security import (
    OAuth2PasswordBearer,
    OAuth2PasswordRequestForm,
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Optional
from database import SessionLocal
import models, schemas

router = APIRouter()

# --- JWT CONFIG ---
SECRET_KEY = "21c4e179bf3ad9a195361d1d807fb80e992d599c10eaa1187102b472162ca037"  # store in env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

# --- Password hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- OAuth2 setup ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

# --- DB Dependency ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Password utils ---
def verify_password(plain_password, password_hash):
    return pwd_context.verify(plain_password, password_hash)


def get_password_hash(password):
    if len(password) > 72:  # bcrypt limit
        password = password[:72]
    return pwd_context.hash(password)


# --- JWT utils ---
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# --- REQUIRED authentication ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: Optional[int] = payload.get("uid")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Fetch full user record
    query = db.query(models.User).filter(models.User.username == username)
    if user_id:
        query = query.filter(models.User.id == user_id)
    user = query.first()

    if user is None:
        raise credentials_exception
    return user


# --- OPTIONAL authentication (no 401) ---
bearer_scheme = HTTPBearer(auto_error=False)

def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """Returns the current user if logged in, otherwise None."""
    if credentials is None:
        return None

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: Optional[int] = payload.get("uid")
        if not username:
            return None
    except JWTError:
        return None

    query = db.query(models.User).filter(models.User.username == username)
    if user_id:
        query = query.filter(models.User.id == user_id)
    return query.first()


# --- REGISTER ---
@router.post("/register")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = (
        db.query(models.User)
        .filter(
            (models.User.username == user.username) |
            (models.User.email == user.email)
        )
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username or email already exists"
        )

    hashed_pw = get_password_hash(user.password)

    new_user = models.User(
        username=user.username,
        email=user.email,
        password_hash=hashed_pw,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully", "username": new_user.username}


# --- LOGIN ---
@router.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # ✅ include both username + user_id in token
    access_token = create_access_token(data={"sub": user.username, "uid": user.id})
    return {"access_token": access_token, "token_type": "bearer"}


# --- CURRENT USER INFO ---
@router.get("/me")
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
    }
