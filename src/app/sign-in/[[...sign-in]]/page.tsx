import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-50 via-white to-orange-50 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Handson</h1>
        <p className="mt-2 text-gray-600">Plateforme Délégué Médical</p>
      </div>
      <SignIn />
    </div>
  );
}
