import { UserProfile } from "@clerk/nextjs";

export default function ProfilPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Mon Profil</h1>
      <UserProfile />
    </div>
  );
}
