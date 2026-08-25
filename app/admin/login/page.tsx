import { LoginForm } from "./login-form";
import { BrandIcon } from "@/app/components/brand-mark";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8 min-h-screen">
      <div className="max-w-sm w-full space-y-6 panel-enter">
        <div className="flex items-center gap-2.5">
          <BrandIcon className="h-10 w-10" priority />
          <div>
            <h1 className="text-xl font-bold">Panel de administración</h1>
            <p className="text-sm panel-label mt-0.5">Liga Robótica Neuquina</p>
          </div>
        </div>
        <div className="panel-card rounded-xl p-5">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
