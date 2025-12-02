import { Wallet } from "lucide-react";

type Props = {
	amount: number;
	side: string;
};

export function RequestAmount({ amount, side }: Props) {
	const variant = side === "sender" ? "primary" : "success";
	return (
		<div className="bg-gradient-shine rounded-lg p-4 border border-border">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm text-muted-foreground mb-1">Amount</p>
					<p className="text-3xl font-bold text-foreground">{amount}</p>
					<p className="text-xs text-muted-foreground mt-1">SAT</p>
				</div>

				<Wallet className={`h-10 w-10 text-${variant}/30`} />
			</div>
		</div>
	);
}
