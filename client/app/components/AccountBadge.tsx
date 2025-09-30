"use client";

import { IconUserOff } from "@tabler/icons-react";
import ButtonIcon from "./ButtonIcon";
import { useRouter } from "next/navigation";

export default function () {
	const router = useRouter();
	return (
		<ButtonIcon
			onClick={() => {
				console.log("to login");
				router.push("/account");
			}}
			aria-label="Sign in"
			title="Sign in"
		>
			<IconUserOff />
		</ButtonIcon>
	);
}
