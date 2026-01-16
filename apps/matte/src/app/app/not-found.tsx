import { NotFound } from "@/components/ui/error";

export default function AppNotFound() {
  return (
    <NotFound
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
      backHref="/app/board"
      backLabel="Go to Board"
    />
  );
}

