import { Bell } from "lucide-react";
import { Logo } from "./Logo";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import Config from "@/Config";

interface HeaderProps {
	notificationCount?: number;
}

export const Header = ({ notificationCount = 3 }: HeaderProps) => {
	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-16 items-center justify-between px-4 md:px-6">
				<Link
					to={`${Config.appRootUrl}`}
					className="flex items-center space-x-3 cursor-pointer transition-transform hover:scale-105"
				>
					<Logo size={32} />
					<span className="text-xl font-semibold bg-gradient-primary bg-clip-text text-transparent">
						Escrow
					</span>
				</Link>

				<div className="flex items-center space-x-4">
					<Link to="/notifications">
						<Button
							variant="ghost"
							size="icon"
							className="relative hover:bg-secondary"
						>
							<Bell className="h-5 w-5" />
							{notificationCount > 0 && (
								<Badge
									variant="destructive"
									className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
								>
									{notificationCount}
								</Badge>
							)}
						</Button>
					</Link>
				</div>
			</div>
		</header>
	);
};
