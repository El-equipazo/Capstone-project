from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class OrgCreate(BaseModel):
    org_name: str
    sector: str
    sub_sector: Optional[str] = None
    founded_year: Optional[int] = None
    employee_count_range: Optional[str] = None
    country: Optional[str] = None
    state_province: Optional[str] = None
    website: Optional[str] = None
    org_description: Optional[str] = None
    quantum_knowledge_level: Optional[str] = None
    budget_range: Optional[str] = None
    urgency_level: Optional[str] = None
    default_connection_expiry_days: int = 30


class OrgUpdate(BaseModel):
    org_name: Optional[str] = None
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    founded_year: Optional[int] = None
    employee_count_range: Optional[str] = None
    country: Optional[str] = None
    state_province: Optional[str] = None
    website: Optional[str] = None
    org_description: Optional[str] = None
    quantum_knowledge_level: Optional[str] = None
    budget_range: Optional[str] = None
    urgency_level: Optional[str] = None
    default_connection_expiry_days: Optional[int] = None


class OrgResponse(BaseModel):
    org_profile_id: int
    user_id: int
    org_name: str
    sector: str
    sub_sector: Optional[str] = None
    founded_year: Optional[int] = None
    employee_count_range: Optional[str] = None
    country: Optional[str] = None
    state_province: Optional[str] = None
    website: Optional[str] = None
    org_description: Optional[str] = None
    quantum_knowledge_level: Optional[str] = None
    budget_range: Optional[str] = None
    urgency_level: Optional[str] = None
    default_connection_expiry_days: int
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class InfrastructureCreate(BaseModel):
    data_categories: Optional[List[str]] = None
    storage_type: Optional[str] = None
    primary_cloud_providers: Optional[List[str]] = None
    current_encryption_standards: Optional[List[str]] = None
    data_retention_years: Optional[int] = None
    oldest_system_age_years: Optional[int] = None
    compliance_requirements: Optional[List[str]] = None
    has_dedicated_security_team: Optional[bool] = None
    had_prior_quantum_assessment: Optional[bool] = None
    known_risks_freetext: Optional[str] = None


class InfrastructureResponse(BaseModel):
    infra_id: int
    org_id: int
    data_categories: Optional[List[str]] = None
    storage_type: Optional[str] = None
    primary_cloud_providers: Optional[List[str]] = None
    current_encryption_standards: Optional[List[str]] = None
    data_retention_years: Optional[int] = None
    oldest_system_age_years: Optional[int] = None
    compliance_requirements: Optional[List[str]] = None
    has_dedicated_security_team: Optional[bool] = None
    had_prior_quantum_assessment: Optional[bool] = None
    known_risks_freetext: Optional[str] = None
    created_at: datetime
    updated_at: datetime
