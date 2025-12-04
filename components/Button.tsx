import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = "",
  ...props 
}) => {
  const baseStyles = "px-4 py-3 rounded-xl font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200",
    secondary: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100",
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
