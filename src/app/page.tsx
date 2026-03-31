import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/clerk/sync-user";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getOrCreateUser();
  if (user?.role === "superviseur") {
    redirect("/dashboard");
  }

  redirect("/visites");
}
