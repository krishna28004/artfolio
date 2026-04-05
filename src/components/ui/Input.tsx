import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full bg-transparent border-b border-outline-variant py-4 px-0 text-text placeholder:text-muted focus:outline-none focus:border-primary transition-colors duration-[600ms] ease-editorial rounded-none ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
