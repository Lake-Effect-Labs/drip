"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ErrorMessageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  className,
}: ErrorMessageProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-8 text-center", className)}>
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

interface ErrorPageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorPage({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
}: ErrorPageProps) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-4">
      <div className="max-w-md">
        <ErrorMessage title={title} message={message} onRetry={onRetry} />
      </div>
    </div>
  );
}

interface NotFoundProps {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
}

export function NotFound({
  title = "Not found",
  message = "The page or resource you're looking for doesn't exist.",
  backHref = "/app",
  backLabel = "Go back",
}: NotFoundProps) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-muted-foreground">404</span>
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <a href={backHref}>
          <Button variant="outline">{backLabel}</Button>
        </a>
      </div>
    </div>
  );
}

