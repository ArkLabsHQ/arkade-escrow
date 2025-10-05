import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonIconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
}

export default function ButtonIcon({
	children,
	className = "",
	disabled = false,
	...props
}: ButtonIconProps) {
	return (
		<button
			{...props}
			disabled={disabled}
			className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 p-1.5 text-white
			 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 
			 disabled:opacity-50 ${className}`}
		>
			{children}
		</button>
	);
}
