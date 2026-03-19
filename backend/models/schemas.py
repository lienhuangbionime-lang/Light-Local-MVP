from pydantic import BaseModel
from typing import List, Optional

class OrderItem(BaseModel):
    product_code: str
    quantity: int
    product_name: str = ""
    price: float = 0.0

class Order(BaseModel):
    order_id: str = ""
    fb_user_id: str = ""
    fb_user_name: str = "Unknown"
    items: List[OrderItem] = []
    status: str = "PENDING"  # PENDING, CONFIRMED, HARVESTED
    shipping_info: Optional[str] = None
    phone: Optional[str] = None
    buyer_name: Optional[str] = None
    instance_id: Optional[str] = None
    created_at: float = 0.0
    shipping_fee: float = 0.0
    free_shipping_threshold: int = 999

class ConfirmOrderRequest(BaseModel):
    shipping_info: str
    phone: str
    buyer_name: Optional[str] = None

class CheckoutLink(BaseModel):
    order_id: str
    url: str
