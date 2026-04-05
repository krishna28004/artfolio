import { TextareaHTMLAttributes, forwardRef } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full bg-transparent border-b border-outline-variant py-4 px-0 text-text placeholder:text-muted focus:outline-none focus:border-primary transition-colors duration-[600ms] ease-editorial rounded-none resize-none ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
