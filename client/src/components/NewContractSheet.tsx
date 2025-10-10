import { useId, useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Switch } from "./ui/switch";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";

type Inputs = {
	side: "receiver" | "sender";
	amount: number;
	description: string;
	public: boolean;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: Inputs) => void;
};

export const NewContractSheet = ({ open, onOpenChange, onSubmit }: Props) => {
	const thisId = useId();

	const {
		register,
		handleSubmit: hs,
		watch,
		formState: { errors },
		control,
	} = useForm<Inputs>({
		defaultValues: {
			public: true,
			side: "receiver",
			amount: 1000,
		},
	});

	const descriptionValue = watch("description") ?? "";
	const sideValue = watch("side") ?? "receiver";

	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit: SubmitHandler<Inputs> = async (data) => {
		setIsSubmitting(true);
		try {
			onSubmit(data);
			onOpenChange(false);
		} catch (error) {
			console.error(error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-lg overflow-y-auto">
				<SheetHeader className="space-y-3">
					<SheetTitle className="text-2xl">Create New Request</SheetTitle>
					<SheetDescription className="text-base">
						Fill in the details to create a new escrow request
					</SheetDescription>
				</SheetHeader>

				<form onSubmit={hs(handleSubmit)} className="mt-8 space-y-6">
					{/* Side Selection */}
					<div className="space-y-3">
						<Label className="text-base font-medium">Your Role</Label>
						<Controller
							name="side"
							control={control}
							rules={{ required: "Please select a side" }}
							render={({ field }) => (
								<RadioGroup value={field.value} onValueChange={field.onChange}>
									<div className="grid grid-cols-2 gap-4">
										<label
											htmlFor={`${thisId}-receiver`}
											className={`flex flex-col items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
												sideValue === "receiver"
													? "border-success bg-success/5"
													: "border-border hover:border-success/50"
											}`}
										>
											<RadioGroupItem
												value="receiver"
												id={`${thisId}-receiver`}
												className="sr-only"
											/>
											<ArrowDownLeft
												className={`h-8 w-8 ${sideValue === "receiver" ? "text-success" : "text-muted-foreground"}`}
											/>
											<div className="text-center">
												<p
													className={`font-medium ${sideValue === "receiver" ? "text-success" : "text-foreground"}`}
												>
													Receiver
												</p>
												<p className="text-xs text-muted-foreground mt-1">
													I will receive payment
												</p>
											</div>
										</label>

										<label
											htmlFor={`${thisId}-sender`}
											className={`flex flex-col items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
												sideValue === "sender"
													? "border-primary bg-primary/5"
													: "border-border hover:border-primary/50"
											}`}
										>
											<RadioGroupItem
												value="sender"
												id={`${thisId}-sender`}
												className="sr-only"
											/>
											<ArrowUpRight
												className={`h-8 w-8 ${sideValue === "sender" ? "text-primary" : "text-muted-foreground"}`}
											/>
											<div className="text-center">
												<p
													className={`font-medium ${sideValue === "sender" ? "text-primary" : "text-foreground"}`}
												>
													Sender
												</p>
												<p className="text-xs text-muted-foreground mt-1">
													I will send payment
												</p>
											</div>
										</label>
									</div>
								</RadioGroup>
							)}
						/>

						{errors.side && (
							<p className="text-sm text-destructive">{errors.side.message}</p>
						)}
					</div>

					{/* Amount */}
					<div className="space-y-2">
						<Label htmlFor="amount" className="text-base font-medium">
							Amount (SAT)
						</Label>
						<div className="space-y-2">
							<Input
								id={`${thisId}-amount`}
								type="text"
								inputMode="numeric"
								placeholder="0"
								className={errors.amount ? "border-destructive" : ""}
								{...register("amount", {
									valueAsNumber: true,
									required: true,
									min: 1,
								})}
							/>
						</div>
						{errors.amount && (
							<p className="text-sm text-destructive">
								{errors.amount.message}
							</p>
						)}
					</div>

					{/* Description */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="description" className="text-base font-medium">
								Description
							</Label>
							<span className="text-xs text-muted-foreground">
								{descriptionValue.length}/255
							</span>
						</div>
						<Textarea
							id={`${thisId}-description`}
							placeholder="Describe what this escrow request is for..."
							maxLength={255}
							rows={4}
							className={errors.description ? "border-destructive" : ""}
							{...register("description", {
								required: true,
								minLength: 4,
								maxLength: 255,
							})}
						/>
						{errors.description && (
							<p className="text-sm text-destructive">
								{errors.description.message}
							</p>
						)}
					</div>

					{/* Public Toggle */}
					<div className="flex items-center justify-between p-4 border border-border rounded-xl">
						<div className="flex-1">
							<Label
								htmlFor={`${thisId}-public`}
								className="text-base font-medium cursor-pointer"
							>
								Make Public
							</Label>
							<p className="text-sm text-muted-foreground mt-1">
								Your request will be visible in the orderbook
							</p>
						</div>
						<Controller
							name="public"
							control={control}
							// No "required" here—false must be allowed
							render={({ field }) => (
								<Switch
									id={`${thisId}-public`}
									checked={!!field.value}
									onCheckedChange={(checked) => {
										field.onChange(checked);
										field.onBlur();
									}}
								/>
							)}
						/>
					</div>

					{/* Actions */}
					<div className="flex gap-3 pt-4">
						<Button
							type="button"
							variant="outline"
							className="flex-1"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Creating...
								</>
							) : (
								"Create Request"
							)}
						</Button>
					</div>
				</form>
			</SheetContent>
		</Sheet>
	);
};
