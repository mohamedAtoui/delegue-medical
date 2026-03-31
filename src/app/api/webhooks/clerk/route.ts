import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
  };
}

export async function POST(request: NextRequest) {
  const payload: ClerkWebhookEvent = await request.json();
  const { type, data } = payload;

  const supabase = createAdminClient();

  if (type === "user.created") {
    const { error } = await supabase.from("users").insert({
      clerk_id: data.id,
      email: data.email_addresses[0]?.email_address ?? "",
      first_name: data.first_name,
      last_name: data.last_name,
      role: "delegue",
    });

    if (error) {
      console.error("Error creating user:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (type === "user.updated") {
    const { error } = await supabase
      .from("users")
      .update({
        email: data.email_addresses[0]?.email_address ?? "",
        first_name: data.first_name,
        last_name: data.last_name,
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_id", data.id);

    if (error) {
      console.error("Error updating user:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
