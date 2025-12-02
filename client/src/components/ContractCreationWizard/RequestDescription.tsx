import { Label } from "recharts";

type Props = {
	description: string;
};

export function RequestDescription({ description }: Props) {
	return (
		<div className="space-y-2">
			<Label>Description</Label>
			<div className="bg-muted/30 rounded-lg p-3 border border-border">
				<p className="text-sm text-foreground leading-relaxed">{description}</p>
			</div>
		</div>
	);
}
