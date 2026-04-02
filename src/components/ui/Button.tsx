import { ButtonHTMLAttributes, forwardRef } from "react";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <button 
        ref={ref}
        className={`px-12 py-4 border border-text/20 text-text uppercase text-[13px] tracking-[0.1em] font-medium transition-all duration-[600ms] hover:border-text hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
