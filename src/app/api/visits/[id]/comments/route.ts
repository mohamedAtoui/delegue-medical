import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

const COMMENT_IMAGE_BUCKET = "comment-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visit_comments")
    .select("*, user:users(id, first_name, last_name, avatar_url)")
    .eq("visit_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  let content = "";
  let parent_id: string | null = null;
  let imageFile: File | null = null;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    content = String(formData.get("content") || "").trim();
    const rawParent = formData.get("parent_id");
    parent_id = rawParent ? String(rawParent) : null;
    const file = formData.get("image");
    if (file instanceof File && file.size > 0) {
      imageFile = file;
    }
  } else {
    const body = await request.json();
    content = (body.content || "").trim();
    parent_id = body.parent_id || null;
  }

  if (!content && !imageFile) {
    return NextResponse.json(
      { error: "Le commentaire ne peut pas être vide" },
      { status: 400 }
    );
  }

  if (imageFile) {
    if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
      return NextResponse.json(
        { error: "Format d'image non supporté (JPEG, PNG, WebP, GIF)" },
        { status: 400 }
      );
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "L'image dépasse la taille maximale (5 Mo)" },
        { status: 400 }
      );
    }
  }

  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  let image_url: string | null = null;
  if (imageFile) {
    const admin = createAdminClient();
    const ext = imageFile.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${id}/${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(COMMENT_IMAGE_BUCKET)
      .upload(path, buffer, {
        contentType: imageFile.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Échec du téléversement : ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: pub } = admin.storage
      .from(COMMENT_IMAGE_BUCKET)
      .getPublicUrl(path);
    image_url = pub.publicUrl;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visit_comments")
    .insert({
      visit_id: id,
      user_id: currentUser.id,
      parent_id,
      content: content || null,
      image_url,
    })
    .select("*, user:users(id, first_name, last_name, avatar_url)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
