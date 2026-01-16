import { redirect } from "next/navigation";

export default function AppPage() {
  // Simple redirect - layout will handle auth/company checks
  redirect("/app/board");
}

