from pydantic import BaseModel
from typing import Optional, Dict, Any, Union, List


# --- PAGE SCHEMAS ---
class PageBase(BaseModel):
    title: str
    content: str
    visibility: str = "public"
    access_type: str = "all_users"
    main_image: Optional[str] = None
    info: Optional[Union[str, dict]] = None  # stored as JSON string


class PageCreate(PageBase):
    pass

class PageSummary(BaseModel):
    id: int
    slug: str
    title: str

class PageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    main_image: Optional[str] = None
    info: Optional[str] = None
    visibility: Optional[str] = None
    access_type: Optional[str] = None

    class Config:
        from_attributes = True  # replaces orm_mode = True


class Page(PageBase):
    id: int
    slug: str
    created_by: Optional[int] = None  # ✅ numeric foreign key
    created_by_username: Optional[str] = None  # ✅ username of creator
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


# --- USER SCHEMAS ---
class UserCreate(BaseModel):
    username: str
    password: str
    email: str


# --- USER SETTINGS ---
class UserSettingsBase(BaseModel):
    display_name: Optional[str] = None
    theme: Optional[str] = "light"
    default_visibility: Optional[str] = "public"
    default_edit: Optional[str] = "private"


class UserSettingsUpdate(UserSettingsBase):
    """Used when updating user settings via PUT /api/user/settings."""
    pass


class UserSettingsResponse(UserSettingsBase):
    user_id: int

    class Config:
        from_attributes = True

class JournalCreate(BaseModel):
    title: str
    

class JournalEntryCreate(BaseModel):
    content: str