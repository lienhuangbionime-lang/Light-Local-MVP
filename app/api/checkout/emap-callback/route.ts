import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const storeId = formData.get('storeid') as string;
    const storeName = formData.get('storename') as string;
    const storeAddress = formData.get('storeaddress') as string;
    
    // 從 URL 參數中取得 order_id (我們在傳送給 7-11 時會帶上)
    const url = new URL(req.url);
    const orderId = url.searchParams.get('order_id');
    
    if (!orderId) {
      console.error('[7-11 Callback] Missing order_id in query params');
      return new NextResponse('Missing order_id', { status: 400 });
    }

    console.log(`[7-11 Callback] Received store: ${storeName} (${storeId}) for order ${orderId}`);

    // 重導向回到結帳頁面，並帶上門市資訊
    const redirectUrl = new URL(`/checkout/${orderId}`, req.url);
    redirectUrl.searchParams.set('storeId', storeId || '');
    redirectUrl.searchParams.set('storeName', storeName || '');
    redirectUrl.searchParams.set('storeAddress', storeAddress || '');
    
    // 也要把本來的 backend 參數帶回去，否則前端會連不到後端
    const originBackend = url.searchParams.get('backend') || url.searchParams.get('b');
    if (originBackend) {
      redirectUrl.searchParams.set('backend', originBackend);
    }

    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    console.error('[7-11 Callback] Error processing POST:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
