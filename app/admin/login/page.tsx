import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8 min-h-screen">
      <div className="max-w-sm w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold">Panel de administración</h1>
          <p className="text-sm panel-label mt-1">Liga Robótica Neuquina</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
