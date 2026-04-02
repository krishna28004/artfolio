import { TextareaHTMLAttributes, forwardRef } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea 
        ref={ref}
        className={`w-full bg-transparent border-b border-white/20 py-4 px-0 text-text placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors duration-[600ms] rounded-none resize-none ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
