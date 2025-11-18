"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	children: ReactNode;
}

export function Button({ 
	variant = "primary", 
	size = "md", 
	children, 
	className = "", 
	disabled,
	...props 
}: ButtonProps) {
	const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-md";
	
	const variantStyles = {
		primary: disabled 
			? "bg-deepBrown/30 text-deepBrown/50 cursor-not-allowed"
			: "bg-accent-primary text-white hover:brightness-110 active:brightness-95 shadow-sm uppercase tracking-wide font-medium",
		secondary: disabled
			? "bg-transparent border border-deepBrown/20 text-deepBrown/50 cursor-not-allowed"
			: "bg-transparent border border-accent-primary/50 text-deepBrown dark:text-cream hover:bg-accent-primary/10 hover:border-accent-primary active:bg-accent-primary/20 uppercase tracking-wide font-normal"
	};
	
	const sizeStyles = {
		sm: "px-3 py-1.5 text-xs",
		md: "px-4 py-2 text-sm",
		lg: "px-6 py-3 text-base"
	};
	
	const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim();
	
	return (
		<button className={combinedClassName} disabled={disabled} {...props}>
			{children}
		</button>
	);
}

