import { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16 ${className}`}>
      {children}
    </div>
  );
}
