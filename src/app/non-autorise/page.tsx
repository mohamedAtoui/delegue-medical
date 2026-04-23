import { SignOutButton } from "@clerk/nextjs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function NonAutorisePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              Accès non autorisé
            </h1>
            <p className="text-sm text-muted-foreground">
              Votre adresse email n&apos;a pas été ajoutée à la liste des
              délégués autorisés.
            </p>
            <p className="text-sm text-muted-foreground">
              Veuillez contacter votre superviseur pour qu&apos;il vous invite,
              puis réessayez de vous connecter.
            </p>
          </div>

          <SignOutButton redirectUrl="/sign-in">
            <Button variant="outline" className="w-full cursor-pointer">
              Se déconnecter
            </Button>
          </SignOutButton>
        </CardContent>
      </Card>
    </div>
  );
}
