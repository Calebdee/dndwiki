from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    TIMESTAMP,
    JSON,
    DateTime,
    Table,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


# --- Association Table for Private Page Whitelist ---
page_view_permissions = Table(
    "page_view_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("page_id", Integer, ForeignKey("pages.id"), primary_key=True),
)


# --- User Model ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True)
    password_hash = Column(String)
    role = Column(String, default="user")
    created_at = Column(TIMESTAMP, server_default=func.now())
    email = Column(String, unique=True, nullable=False, default="")

    # Relationships
    settings = relationship("UserSettings", back_populates="user", uselist=False)

    # Pages this user is allowed to view (if private)
    permitted_pages = relationship(
        "Page",
        secondary="page_view_permissions",
        back_populates="allowed_users",
    )


# --- Page Model ---
class Page(Base):
    __tablename__ = "pages"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    content = Column(Text, nullable=False)
    visibility = Column(String, default="public")  # "public" or "private"
    access_type = Column(String, default="all_users")  # "private" or "all_users"
    main_image = Column(String, nullable=True)
    info = Column(JSON, nullable=True)  # dynamic sidebar info
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # --- Relationships ---
    allowed_users = relationship(
        "User",
        secondary="page_view_permissions",
        back_populates="permitted_pages",
    )

# --- User Settings Model ---
class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    theme = Column(String, default="light")  # "light" or "dark"
    default_visibility = Column(String, default="public")  # "public" or "private"
    default_edit = Column(String, default="private")  # "private" or "all_users"
    display_name = Column(String, nullable=True)

    user = relationship("User", back_populates="settings")
    
class Journal(Base):
    __tablename__ = "journals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    entries = relationship("JournalEntry", back_populates="journal", cascade="all, delete-orphan")


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey("journals.id"), nullable=False)
    content = Column(Text, nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    journal = relationship("Journal", back_populates="entries")

