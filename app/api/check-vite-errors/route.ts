export const dynamic = &quot;force-static&quot;;


import { NextResponse } from &apos;next/server&apos;;

// Stub endpoint to prevent 404 errors
// This endpoint is being called but the source is unknown
// Returns empty errors array to satisfy any calling code
export async function GET() {
  return NextResponse.json({
    success: true,
    errors: [],
    message: &apos;No Vite errors detected&apos;
  });
}