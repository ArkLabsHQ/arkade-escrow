import { GetArbitrationDto } from "@/types/api";

export const getArbitrationStatusColor = (
	status: GetArbitrationDto["status"],
) => {
	switch (status) {
		case "pending":
			return "bg-warning/10 text-warning border-warning/20";
		case "resolved":
			return "bg-success/10 text-success border-success/20";
		case "executed":
			return "bg-primary/10 text-primary border-primary/20";
		default:
			return "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20";
	}
};
