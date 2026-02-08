import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap font-display text-sm font-bold uppercase tracking-widest transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground border-2 border-primary/60 hover:bg-primary/90 hover:border-primary shadow-[0_2px_0_hsl(0_0%_0%/0.3),inset_0_1px_0_hsl(0_0%_100%/0.1)]",
				destructive:
					"bg-destructive text-destructive-foreground border-2 border-destructive/60 hover:bg-destructive/90 shadow-[0_2px_0_hsl(0_0%_0%/0.3),inset_0_1px_0_hsl(0_0%_100%/0.1)]",
				outline:
					"border-2 border-border bg-transparent text-foreground hover:bg-muted hover:border-primary/60 hover:text-primary shadow-[0_2px_0_hsl(0_0%_0%/0.2)]",
				secondary:
					"bg-secondary text-secondary-foreground border-2 border-border hover:bg-secondary/80 shadow-[0_2px_0_hsl(0_0%_0%/0.2)]",
				ghost:
					"text-muted-foreground hover:bg-muted hover:text-foreground border-2 border-transparent",
				link: "text-primary underline-offset-4 hover:underline",
				// Arena-specific variants - industrial control aesthetic
				arena:
					"bg-muted text-foreground border-2 border-border hover:border-primary/60 hover:text-primary shadow-[0_2px_0_hsl(0_0%_0%/0.3),inset_0_1px_0_hsl(var(--border)/0.3)]",
				arenaGold:
					"bg-arena-gold text-arena-gold-foreground border-2 border-arena-gold/60 hover:bg-arena-gold/90 shadow-[0_2px_0_hsl(0_0%_0%/0.3),inset_0_1px_0_hsl(0_0%_100%/0.15),0_0_20px_-8px_hsl(var(--arena-gold)/0.4)]",
				arenaPrimary:
					"bg-primary/20 text-primary border-2 border-primary/50 hover:bg-primary/30 hover:border-primary shadow-[0_2px_0_hsl(0_0%_0%/0.2),inset_0_0_15px_-10px_hsl(var(--primary)/0.3)]",
				hostControl:
					"bg-destructive/15 text-destructive border-2 border-destructive/40 hover:bg-destructive/25 hover:border-destructive/60 uppercase tracking-widest shadow-[0_2px_0_hsl(0_0%_0%/0.2),inset_0_0_15px_-10px_hsl(var(--destructive)/0.2)]",
			},
			size: {
				default: "h-11 px-6 py-2",
				sm: "h-9 px-4 text-xs",
				lg: "h-12 px-8 text-base",
				xl: "h-14 px-10 text-lg",
				icon: "h-11 w-11",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
		);
	}
);
Button.displayName = "Button";

export { Button, buttonVariants };
