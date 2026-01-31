"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          ref={ref}
          {...props}
        />
        <div
          className={cn(
            "h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 peer-checked:bg-primary peer-checked:text-primary-foreground flex items-center justify-center",
            className
          )}
        >
          <Check className="h-3 w-3 opacity-0 peer-checked:opacity-100" />
        </div>
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

// Simple checkbox that works without peer selectors
const SimpleCheckbox = React.forwardRef<
  HTMLInputElement,
  CheckboxProps & { checked?: boolean }
>(({ className, checked, onChange, ...props }, ref) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cn(
        "h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center transition-colors",
        checked && "bg-primary text-primary-foreground",
        className
      )}
      onClick={() => {
        if (onChange) {
          const event = {
            target: { checked: !checked },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(event);
        }
      }}
    >
      <input
        type="checkbox"
        className="sr-only"
        ref={ref}
        checked={checked}
        onChange={onChange}
        {...props}
      />
      {checked && <Check className="h-3 w-3" />}
    </button>
  );
});
SimpleCheckbox.displayName = "SimpleCheckbox";

export { Checkbox, SimpleCheckbox };

