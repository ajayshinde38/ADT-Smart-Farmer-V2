from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID


class PhoneLoginRequest(BaseModel):
    phone: str = Field(..., description="10-digit mobile number")


class OTPVerifyRequest(BaseModel):
    phone: str = Field(..., description="10-digit mobile number")
    otp: str = Field(..., description="6-digit OTP code")


class ProfileSelectRequest(BaseModel):
    phone: str
    farmer_id: UUID


class FarmerProfileSummary(BaseModel):
    farmer_id: UUID
    name: str
    mobile: str
    prn: Optional[str] = None
    village: Optional[str] = None
    farm_id: Optional[UUID] = None
    farm_area_acres: Optional[float] = None


class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    is_multi_profile: bool = False
    profiles: List[FarmerProfileSummary] = []
    selected_farmer: Optional[FarmerProfileSummary] = None
    message: str = "Success"
