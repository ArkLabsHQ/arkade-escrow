import { useState } from "react";
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
import { toast } from "sonner";
import { z } from "zod";

const newRequestSchema = z.object({
  side: z.enum(["receiver", "sender"], {
    required_error: "Please select a side",
  }),
  amount: z.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number",
  }).int("Amount must be an integer").positive("Amount must be greater than zero"),
  description: z.string()
    .trim()
    .min(1, "Description is required")
    .max(255, "Description must be less than 255 characters"),
  isPublic: z.boolean(),
});

type NewRequestFormData = z.infer<typeof newRequestSchema>;

interface NewRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewRequestFormData) => void;
}

export const NewRequestSheet = ({
  open,
  onOpenChange,
  onSubmit,
}: NewRequestSheetProps) => {
  const [side, setSide] = useState<"receiver" | "sender">("receiver");
  const [amountString, setAmountString] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof NewRequestFormData, string>>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const amount = parseInt(amountString, 10);
      
      const data = newRequestSchema.parse({
        side,
        amount,
        description,
        isPublic,
      });

      onSubmit(data);
      
      // Reset form
      setSide("receiver");
      setAmountString("");
      setDescription("");
      setIsPublic(true);
      onOpenChange(false);
      
      toast.success("Request created successfully!", {
        description: "Your request is now visible in the orderbook",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof NewRequestFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof NewRequestFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast.error("Please fix the errors in the form");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (value: string) => {
    // Only allow digits
    const sanitized = value.replace(/[^0-9]/g, "");
    setAmountString(sanitized);
  };

  const formattedAmount = amountString ? (parseInt(amountString, 10) / 100000000).toFixed(8) : "0.00000000";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <SheetTitle className="text-2xl">Create New Request</SheetTitle>
          <SheetDescription className="text-base">
            Fill in the details to create a new escrow request
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Side Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Your Role</Label>
            <RadioGroup value={side} onValueChange={(value) => setSide(value as "receiver" | "sender")}>
              <div className="grid grid-cols-2 gap-4">
                <label
                  htmlFor="receiver"
                  className={`flex flex-col items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                    side === "receiver"
                      ? "border-success bg-success/5"
                      : "border-border hover:border-success/50"
                  }`}
                >
                  <RadioGroupItem value="receiver" id="receiver" className="sr-only" />
                  <ArrowDownLeft className={`h-8 w-8 ${side === "receiver" ? "text-success" : "text-muted-foreground"}`} />
                  <div className="text-center">
                    <p className={`font-medium ${side === "receiver" ? "text-success" : "text-foreground"}`}>
                      Receiver
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      I will receive payment
                    </p>
                  </div>
                </label>

                <label
                  htmlFor="sender"
                  className={`flex flex-col items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                    side === "sender"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="sender" id="sender" className="sr-only" />
                  <ArrowUpRight className={`h-8 w-8 ${side === "sender" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-center">
                    <p className={`font-medium ${side === "sender" ? "text-primary" : "text-foreground"}`}>
                      Sender
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      I will send payment
                    </p>
                  </div>
                </label>
              </div>
            </RadioGroup>
            {errors.side && <p className="text-sm text-destructive">{errors.side}</p>}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-base font-medium">
              Amount (SAT)
            </Label>
            <div className="space-y-2">
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={amountString}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className={errors.amount ? "border-destructive" : ""}
              />
              {amountString && (
                <p className="text-xs text-muted-foreground">
                  ≈ {formattedAmount} BTC
                </p>
              )}
            </div>
            {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description" className="text-base font-medium">
                Description
              </Label>
              <span className="text-xs text-muted-foreground">
                {description.length}/255
              </span>
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this escrow request is for..."
              maxLength={255}
              rows={4}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
          </div>

          {/* Public Toggle */}
          <div className="flex items-center justify-between p-4 border border-border rounded-xl">
            <div className="flex-1">
              <Label htmlFor="public" className="text-base font-medium cursor-pointer">
                Make Public
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Your request will be visible in the orderbook
              </p>
            </div>
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
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
