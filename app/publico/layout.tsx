import { PublicShell } from "@/app/components/public-shell";

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
