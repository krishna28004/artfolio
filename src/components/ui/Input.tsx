import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input 
        ref={ref}
        className={`w-full bg-transparent border-b border-white/20 py-4 px-0 text-text placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors duration-[600ms] rounded-none ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
