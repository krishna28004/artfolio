import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = 'primary', children, ...props }, ref) => {

    // Stitch Architecture Base styles
    const baseStyles = "px-12 py-4 uppercase text-[13px] tracking-[0.1em] font-medium transition-all duration-[600ms] ease-editorial active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

    // Gradient Glass + Precision Ghost variants
    const primaryStyles = "bg-gradient-to-r from-primary to-primary-container text-[#3c2f00] hover:brightness-110 shadow-ambient";
    const secondaryStyles = "bg-transparent border border-outline-variant/50 text-text hover:bg-surface-highest/20";

    const variantStyles = variant === 'primary' ? primaryStyles : secondaryStyles;

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
