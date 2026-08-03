from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


# ---------- Sub-resource responses ----------

class CredentialResponse(BaseModel):
    credential_id: int
    credential_type: str
    credential_name: str
    institution: Optional[str] = None
    year_obtained: Optional[int] = None
    expiry_date: Optional[date] = None
    verification_url: Optional[str] = None
    is_verified: bool = False


class WorkHistoryResponse(BaseModel):
    work_history_id: int
    organization_name: str
    job_title: str
    employment_type: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    is_current: bool
    description: Optional[str] = None
    order_index: Optional[int] = None


class SpecializationResponse(BaseModel):
    specialization_id: int
    specialization: str
    proficiency_level: str
    years_in_specialization: Optional[int] = None


class SectorExperienceResponse(BaseModel):
    sector_exp_id: int
    sector: str
    years_experience_in_sector: Optional[int] = None
    compliance_standards_known: Optional[List[str]] = None
    anonymized_client_examples: Optional[str] = None


class EngagementTypeResponse(BaseModel):
    eng_type_id: int
    engagement_type: str
    typical_duration_weeks_min: Optional[int] = None
    typical_duration_weeks_max: Optional[int] = None
    typical_budget_min: Optional[float] = None
    typical_budget_max: Optional[float] = None
    approach_description: Optional[str] = None


# ---------- Profile responses ----------

class ExpertResponse(BaseModel):
    expert_profile_id: int
    first_name: str
    last_name: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    years_of_experience: Optional[int] = None
    linkedin_url: Optional[str] = None
    hourly_rate_min: Optional[float] = None
    hourly_rate_max: Optional[float] = None
    availability_status: str
    is_verified: bool
    verification_status: str
    avg_rating: Optional[float] = None
    total_completed_engagements: int = 0
    credentials: List[CredentialResponse] = []
    work_history: List[WorkHistoryResponse] = []
    specializations: List[SpecializationResponse] = []
    sector_experience: List[SectorExperienceResponse] = []
    engagement_types: List[EngagementTypeResponse] = []


class ExpertListItem(BaseModel):
    expert_profile_id: int
    first_name: str
    last_name: str
    headline: Optional[str] = None
    profile_photo_url: Optional[str] = None
    availability_status: str
    hourly_rate_min: Optional[float] = None
    hourly_rate_max: Optional[float] = None
    is_verified: bool
    avg_rating: Optional[float] = None
    total_completed_engagements: int = 0


# ---------- Profile request bodies ----------

class ExpertCreate(BaseModel):
    first_name: str
    last_name: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    years_of_experience: Optional[int] = None
    linkedin_url: Optional[str] = None
    hourly_rate_min: Optional[float] = None
    hourly_rate_max: Optional[float] = None
    availability_status: str = "available"
    preferred_engagement_length: Optional[str] = None


class ExpertUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    years_of_experience: Optional[int] = None
    linkedin_url: Optional[str] = None
    hourly_rate_min: Optional[float] = None
    hourly_rate_max: Optional[float] = None
    availability_status: Optional[str] = None
    preferred_engagement_length: Optional[str] = None


# ---------- Sub-resource request bodies ----------

class CredentialCreate(BaseModel):
    credential_type: str
    credential_name: str
    institution: Optional[str] = None
    year_obtained: Optional[int] = None
    expiry_date: Optional[date] = None
    verification_url: Optional[str] = None


class CredentialUpdate(BaseModel):
    credential_type: Optional[str] = None
    credential_name: Optional[str] = None
    institution: Optional[str] = None
    year_obtained: Optional[int] = None
    expiry_date: Optional[date] = None
    verification_url: Optional[str] = None


class WorkHistoryCreate(BaseModel):
    organization_name: str
    job_title: str
    employment_type: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False
    description: Optional[str] = None
    order_index: Optional[int] = None


class WorkHistoryUpdate(BaseModel):
    organization_name: Optional[str] = None
    job_title: Optional[str] = None
    employment_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class SpecializationCreate(BaseModel):
    specialization: str
    proficiency_level: str
    years_in_specialization: Optional[int] = None


class SpecializationUpdate(BaseModel):
    specialization: Optional[str] = None
    proficiency_level: Optional[str] = None
    years_in_specialization: Optional[int] = None


class SectorExperienceCreate(BaseModel):
    sector: str
    years_experience_in_sector: Optional[int] = None
    compliance_standards_known: Optional[List[str]] = None
    anonymized_client_examples: Optional[str] = None


class SectorExperienceUpdate(BaseModel):
    sector: Optional[str] = None
    years_experience_in_sector: Optional[int] = None
    compliance_standards_known: Optional[List[str]] = None
    anonymized_client_examples: Optional[str] = None


class EngagementTypeCreate(BaseModel):
    engagement_type: str
    typical_duration_weeks_min: Optional[int] = None
    typical_duration_weeks_max: Optional[int] = None
    typical_budget_min: Optional[float] = None
    typical_budget_max: Optional[float] = None
    approach_description: Optional[str] = None


class EngagementTypeUpdate(BaseModel):
    engagement_type: Optional[str] = None
    typical_duration_weeks_min: Optional[int] = None
    typical_duration_weeks_max: Optional[int] = None
    typical_budget_min: Optional[float] = None
    typical_budget_max: Optional[float] = None
    approach_description: Optional[str] = None
