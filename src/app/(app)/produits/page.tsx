import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { redirect } from "next/navigation";
import { ProduitsClient } from "./produits-client";

export default async function ProduitsPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "superviseur") redirect("/visites");
  return <ProduitsClient />;
}
