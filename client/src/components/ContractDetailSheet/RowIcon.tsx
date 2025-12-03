type Props = {
	children: React.ReactNode;
};
export function RowIcon({ children }: Props) {
	return (
		<span
			className={"flex w-8 h-16 min-w-8 max-w-8 justify-center items-center"}
		>
			{children}
		</span>
	);
}
