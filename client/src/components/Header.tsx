import { FileSignature, Settings, NotebookTabs } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import Config from "@/Config";

interface HeaderProps {
	title: string;
}

export const Header = ({ title = "" }: HeaderProps) => {
	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-16 items-center justify-between px-4 md:px-6">
				<Link
					to={`${Config.appRootUrl}`}
					className="flex items-center space-x-3 cursor-pointer transition-transform hover:scale-105"
				>
					<Logo size={32} />
					<span className="text-xl font-semibold bg-gradient-primary bg-clip-text text-transparent">
						{title}
					</span>
				</Link>
				<div className="flex items-center space-x-1 sm:space-x-2">
					<Link to={`${Config.appRootUrl}/requests`}>
						<Button
							variant="ghost"
							size="sm"
							className="gap-2 hover:bg-secondary px-2 sm:px-3"
						>
							<NotebookTabs className="h-4 w-4" />
							<span className="hidden sm:inline">My Requests</span>
						</Button>
					</Link>

					<Link to={`${Config.appRootUrl}/contracts`}>
						<Button
							variant="ghost"
							size="sm"
							className="gap-2 hover:bg-secondary px-2 sm:px-3"
						>
							<FileSignature className="h-4 w-4" />
							<span className="hidden sm:inline">My Contracts</span>
						</Button>
					</Link>

					<Link to="/settings">
						<Button
							variant="ghost"
							size="sm"
							className="gap-2 hover:bg-secondary px-2 sm:px-3"
						>
							<Settings className="h-4 w-4" />
							<span className="hidden md:inline">Settings</span>
						</Button>
					</Link>
				</div>
			</div>
		</header>
	);
};
