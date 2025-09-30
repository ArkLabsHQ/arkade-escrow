"use client";

import { IconCaretLeft } from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import AccountBadge from "./AccountBadge";

type Props = { title: string };
export default function Header({ title }: Props) {
	const router = useRouter();
	const currentPath = usePathname();

	return (
		<header className="flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white">
			{/* Sticky header */}
			<div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md">
				<div className="mx-auto max-w-3xl px-4 pt-6 pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							{currentPath !== "/" && (
								<button
									type="button"
									onClick={() => router.back()}
									className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
								>
									<IconCaretLeft className="h-5 w-5 text-slate-700" />
								</button>
							)}
							<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
						</div>
						<AccountBadge />
					</div>
				</div>
			</div>
		</header>
	);
}
