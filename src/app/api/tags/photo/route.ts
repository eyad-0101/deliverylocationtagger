import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

// Any logged-in driver can upload — same access level as tagging a
// location in the first place. Keep the limit modest; this is a normal
// part of tagging a pin, not something drivers do dozens of times a
// minute.
const UPLOAD_LIMIT = 20;
const UPLOAD_WINDOW_SECONDS = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
  }

  const { allowed, retryAfterSeconds } = rateLimit(
    `photo-upload:${session.driverId}`,
    UPLOAD_LIMIT,
    UPLOAD_WINDOW_SECONDS
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة جدًا، حاول مرة أخرى بعد قليل" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "لم يتم إرفاق صورة" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "نوع الملف غير مدعوم — استخدم JPEG أو PNG أو WebP" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "حجم الصورة كبير جدًا (الحد الأقصى 5 ميجابايت)" },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = EXT_BY_TYPE[file.type];
  const path = `${session.driverId}/${crypto.randomUUID()}.${ext}`;

  const supabase = supabaseAdmin();
  const { error: uploadError } = await supabase.storage
    .from("pin-photos")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from("pin-photos").getPublicUrl(path);

  return NextResponse.json({ url: publicUrlData.publicUrl });
}
