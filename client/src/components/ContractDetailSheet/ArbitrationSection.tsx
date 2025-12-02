import { Badge } from "../ui/badge";
import { getArbitrationStatusColor } from "./helpers";
import { GetArbitrationDto } from "@/types/api";
import { Me } from "@/types/me";
import { format } from "date-fns";

type Props = {
	arbitration: GetArbitrationDto;
	me: Me;
};
export default function ArbitrationSection({ arbitration, me }: Props) {
	return (
		<div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
			<div className="flex items-start gap-3">
				<div className="flex-1">
					<p className="text-sm text-muted-foreground mb-1">Status</p>

					<Badge
						variant="outline"
						className={getArbitrationStatusColor(arbitration.status)}
					>
						{arbitration.status}
					</Badge>
				</div>

				<div className="flex-1">
					<p className="text-sm text-muted-foreground mb-1">Initiated</p>

					<p className="text-sm text-foreground">
						{format(arbitration.createdAt, "PPp")}
					</p>
				</div>
			</div>

			<div>
				<p className="text-sm text-muted-foreground mb-1">Claimant</p>

				<p className="text-sm font-medium text-foreground">
					{me.pubkeyAsMe(arbitration.claimantPublicKey)}
				</p>
			</div>

			<div>
				<p className="text-sm text-muted-foreground mb-1">Verdict</p>

				<p className="text-sm font-medium text-foreground">
					{arbitration.verdict ?? "-"}
				</p>
			</div>

			<div>
				<p className="text-sm text-muted-foreground mb-1">Reason</p>

				<p className="text-sm text-foreground italic">"{arbitration.reason}"</p>
			</div>
		</div>
	);
}
