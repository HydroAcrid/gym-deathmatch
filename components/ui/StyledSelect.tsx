"use client";

import { SelectHTMLAttributes, ReactNode } from "react";

interface StyledSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
	children: ReactNode;
	className?: string;
}

export function StyledSelect({ children, className = "", ...props }: StyledSelectProps) {
	return (
		<div className="relative inline-block">
			<select
				className={`
					h-10 px-3 pr-10 rounded-md
					border border-accent-primary/50
					bg-main text-main
					appearance-none
					-moz-appearance-none
					-webkit-appearance-none
					transition-all duration-200
					focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary
					hover:border-accent-primary hover:bg-accent-primary/5
					cursor-pointer
					min-w-[200px]
					${className}
				`.trim().replace(/\s+/g, " ")}
				style={{
					backgroundImage: "none"
				}}
				{...props}
			>
				{children}
			</select>
			{/* Custom caret icon - positioned relative to the select element */}
			<div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
				<svg
					width="12"
					height="12"
					viewBox="0 0 12 12"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					className="transition-colors duration-200"
					style={{ color: "var(--accent-primary)" }}
				>
					<path
						d="M2 4L6 8L10 4"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>
		</div>
	);
}

