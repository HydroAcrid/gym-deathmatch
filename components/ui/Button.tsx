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
	const baseStyles = "inline-flex items-center justify-center transition-all duration-200 rounded-md";
	
	const variantStyles = {
		primary: disabled 
			? "bg-muted text-muted-foreground cursor-not-allowed"
			: "arena-badge arena-badge-primary uppercase tracking-wide font-medium",
		secondary: disabled
			? "bg-transparent border border-border text-muted-foreground cursor-not-allowed"
			: "arena-badge uppercase tracking-wide font-normal"
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

