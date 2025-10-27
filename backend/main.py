from fastapi import FastAPI, Depends, HTTPException, Form, UploadFile, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import or_

from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os, shutil, logging, re

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from database import Base, engine, SessionLocal
import models, schemas
from schemas import JournalCreate, JournalEntryCreate
from models import Journal, JournalEntry

from auth import (
    router as auth_router,
    get_current_user,
    get_optional_user,
)

# --- Email Config ---
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM", "noreply@dndwiki.calebdee.io"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)
fm = FastMail(conf)

# --- Setup ---
logging.basicConfig(level=logging.DEBUG)
app = FastAPI(debug=True)
Base.metadata.create_all(bind=engine)

# --- CORS ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://dndwiki.calebdee.io",
    "https://dndwiki.calebdee.io",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static images ---
IMAGES_DIR = "/app/images"
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# --- Include Auth ---
app.include_router(auth_router, prefix="/api")

# --- Database dependency ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Permission Helper ---
def can_view_page(page, current_user):
    """Determine if a given user can view the specified page."""
    if page.visibility == "public":
        return True
    if not current_user:
        return False
    if current_user.id == page.created_by:
        return True
    # Fix: compare by user.id, not object reference
    if any(u.id == current_user.id for u in page.allowed_users):
        return True
    return False


# --- Upload Image ---
@app.post("/api/upload-image")
def upload_image(file: UploadFile, filename: str = Form(...)):
    filepath = os.path.join(IMAGES_DIR, filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/images/{filename}"}


# --- List Public Pages ---
@app.get("/api/pages")
def list_pages(db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(get_optional_user)):
    if not current_user:
        return db.query(models.Page).filter(models.Page.visibility == "public").all()

    return db.query(models.Page).filter(
        or_(
            models.Page.visibility == "public",
            models.Page.created_by == current_user.id,
            models.Page.allowed_users.any(models.User.id == current_user.id)
        )
    ).all()

@app.get("/api/pages/summary", response_model=List[schemas.PageSummary])
def list_pages_summary(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user)
):
    """
    Return:
    - All public pages (for everyone)
    - All pages created by the current user (if logged in)
    - All private pages the user is allowed to view (if logged in)
    """
    # Always include public pages
    base_query = db.query(models.Page).filter(models.Page.visibility == "public")

    if current_user:
        # Include own pages
        own_pages = db.query(models.Page).filter(models.Page.created_by == current_user.id)

        # Include pages where user is allowed
        allowed_pages = (
            db.query(models.Page)
            .join(models.page_view_permissions, models.Page.id == models.page_view_permissions.c.page_id)
            .filter(models.page_view_permissions.c.user_id == current_user.id)
        )

        # Combine all three sets
        base_query = base_query.union(own_pages).union(allowed_pages)

    # Only return minimal fields for performance
    pages = (
        base_query.with_entities(models.Page.id, models.Page.slug, models.Page.title)
        .distinct()
        .order_by(models.Page.updated_at.desc())
        .all()
    )

    return [{"id": p.id, "slug": p.slug, "title": p.title} for p in pages]

@app.get("/api/pages/all")
def get_all_pages(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    pages = db.query(models.Page).all()
    return [
        {
            "slug": p.slug,
            "title": p.title,
            "visibility": p.visibility,
            "created_by": p.created_by,
        }
        for p in pages
    ]


# --- List Pages by User ---
@app.get("/api/user-pages/{username}")
def list_user_pages(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    # Adjusted for relational consistency
    user_obj = db.query(models.User).filter(models.User.username == username).first()
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")

    query = db.query(models.Page).filter(models.Page.created_by == user_obj.id)

    if not current_user or current_user.id != user_obj.id:
        query = query.filter(models.Page.visibility == "public")

    return query.order_by(models.Page.title.asc()).all()


import json

@app.get("/api/pages/{slug}", response_model=schemas.Page)
def get_page(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    page = db.query(models.Page).filter(models.Page.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if not can_view_page(page, current_user):
        raise HTTPException(status_code=403, detail="You are not authorized to view this page")

    creator = db.query(models.User).filter(models.User.id == page.created_by).first()
    creator_username = creator.username if creator else "Unknown"

    # --- Normalize info safely ---
    info_parsed = None
    if page.info:
        try:
            # handle double-encoded JSON (JSON string inside quotes)
            if isinstance(page.info, str):
                info_parsed = json.loads(page.info)
                if isinstance(info_parsed, str):
                    info_parsed = json.loads(info_parsed)
            else:
                info_parsed = page.info
        except Exception:
            info_parsed = page.info  # fallback to raw string if unparsable

    return schemas.Page(
        id=page.id,
        title=page.title,
        slug=page.slug,
        content=page.content or "",
        visibility=page.visibility,
        access_type=page.access_type,
        main_image=page.main_image,
        info=info_parsed,
        created_by=page.created_by,
        created_by_username=creator_username,
        updated_at=page.updated_at.isoformat() if page.updated_at else None,
    )


@app.post("/api/pages/{slug}/allow/{username}")
async def allow_user_to_view_page(
    slug: str,
    username: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    page = db.query(models.Page).filter(models.Page.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if page.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the page owner can manage access")

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user in page.allowed_users:
        raise HTTPException(status_code=400, detail="User already allowed")

    page.allowed_users.append(user)
    db.commit()

    if fm and user.email:
        subject = f"{current_user.username} shared a private DNDWiki page with you"
        page_link = f"https://dndwiki.calebdee.io/view/{slug}"
        message = MessageSchema(
            subject=subject,
            recipients=[user.email],  # ✅ no EmailStr() here
            body=f"Visit your shared page:\n\n{page_link}",
            subtype="plain"
        )
        background_tasks.add_task(fm.send_message, message)
        logging.info(f"📧 Queued email to {user.email}")

    return {"message": f"{username} can now view '{page.title}' and was notified if possible."}


# --- Create Page ---
@app.post("/api/pages")
def create_page(
    page: schemas.PageCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    slug = re.sub(r"[^a-zA-Z0-9_-]", "-", page.title).lower()
    db_page = models.Page(
        title=page.title,
        slug=slug,
        content=page.content,
        visibility=page.visibility,
        access_type=page.access_type,
        main_image=page.main_image,
        info=page.info,
        created_by=user.id,
    )
    db.add(db_page)
    db.commit()
    db.refresh(db_page)
    return db_page


# --- Update Page ---
@app.put("/api/pages/{slug}")
def update_page(
    slug: str,
    page: schemas.PageUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db_page = db.query(models.Page).filter(models.Page.slug == slug).first()
    if not db_page:
        raise HTTPException(status_code=404, detail="Page not found")

    # ✅ Compare user.id to created_by (numeric foreign key)
    print(f"[DEBUG update_page] user.id={user.id}, user.username={user.username}, db_page.created_by={db_page.created_by}")
    if db_page.created_by != user.id and getattr(user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to edit this page")

    db_page.title = page.title
    db_page.content = page.content
    db_page.main_image = page.main_image
    db_page.info = page.info
    if hasattr(page, "visibility") and page.visibility:
        db_page.visibility = page.visibility
    if hasattr(page, "access_type") and page.access_type:
        db_page.access_type = page.access_type

    db.commit()
    db.refresh(db_page)
    return db_page


# --- Update Visibility (PATCH) ---
class PageVisibilityUpdate(BaseModel):
    visibility: Optional[str] = None


@app.patch("/api/pages/{slug}")
def update_page_visibility(
    slug: str,
    update: PageVisibilityUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    page = db.query(models.Page).filter(models.Page.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if current_user.id != page.created_by and page.access_type != "all_users":
        raise HTTPException(status_code=403, detail="You are not authorized to modify this page")

    if update.visibility not in ["public", "private"]:
        raise HTTPException(status_code=400, detail="Invalid visibility value")

    page.visibility = update.visibility
    db.commit()
    db.refresh(page)
    return {"visibility": page.visibility}


# --- User Settings ---
@app.get("/api/user/settings", response_model=schemas.UserSettingsResponse)
def get_user_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    settings = (
        db.query(models.UserSettings)
        .filter(models.UserSettings.user_id == current_user.id)
        .first()
    )

    if settings is None:
        settings = models.UserSettings(
            user_id=current_user.id,
            theme="light",
            default_visibility="public",
            default_edit="private",
            display_name=current_user.username,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
        print(f"Created new settings for user {current_user.username}")

    return settings

# List all users (for admins / page owners)
@app.get("/api/users")
def list_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.User).all()

# List allowed users for a page
@app.get("/api/pages/{slug}/allowed")
def list_allowed_users(
    slug: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    page = db.query(models.Page).filter(models.Page.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if not (
        current_user.id == page.created_by
        or any(u.id == current_user.id for u in page.allowed_users)
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    return [{"id": u.id, "username": u.username} for u in page.allowed_users]

# --- Get all journals ---
@app.get("/api/journals")
def get_journals(db: Session = Depends(get_db)):
    return db.query(Journal).all()

# --- Get one journal with entries ---
@app.get("/api/journals/{journal_id}")
def get_journal(journal_id: int, db: Session = Depends(get_db)):
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    entries = db.query(JournalEntry).filter(JournalEntry.journal_id == journal_id).order_by(JournalEntry.order_index).all()
    return {"journal": journal, "entries": entries}

# --- Add entry ---
@app.post("/api/journals/{journal_id}/entries")
def add_entry(journal_id: int, entry: JournalEntryCreate, db: Session = Depends(get_db)):
    count = db.query(JournalEntry).filter(JournalEntry.journal_id == journal_id).count()
    new_entry = JournalEntry(journal_id=journal_id, content=entry.content, order_index=count)
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return new_entry

# --- Update entry ---
@app.put("/api/journal-entries/{entry_id}")
def update_entry(entry_id: int, content: str, db: Session = Depends(get_db)):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.content = content
    db.commit()
    db.refresh(entry)
    return entry

@app.get("/api/journals")
def get_all_journals(db: Session = Depends(get_db)):
    journals = db.query(Journal).order_by(Journal.created_at.desc()).all()
    return [{"id": j.id, "title": j.title} for j in journals]

@app.post("/api/journals")
def create_journal(journal: JournalCreate, db: Session = Depends(get_db)):
    if not journal.title.strip():
        raise HTTPException(status_code=400, detail="Title required")

    new_journal = Journal(title=journal.title.strip())
    db.add(new_journal)
    db.commit()
    db.refresh(new_journal)
    return {"id": new_journal.id, "title": new_journal.title}

