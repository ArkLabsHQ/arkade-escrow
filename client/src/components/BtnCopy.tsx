import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type Props = {
	value: string | (() => Promise<string>);
	disabled?: boolean;
	onSuccess?: () => void;
};

export default function BtnCopy({ value, disabled, onSuccess }: Props) {
	const [copied, setCopied] = useState(false);
	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const v = await (typeof value === "string"
			? Promise.resolve(value)
			: value());
		await navigator.clipboard.writeText(v);
		if (onSuccess) onSuccess();
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};
	return (
		<Button
			disabled={disabled}
			variant="ghost"
			size="sm"
			onClick={handleCopy}
			className="shrink-0"
		>
			{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		</Button>
	);
}
