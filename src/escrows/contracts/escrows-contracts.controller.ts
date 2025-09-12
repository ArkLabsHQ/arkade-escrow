import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { EscrowsContractsService } from "./escrows-contracts.service";

@ApiTags("Escrow Contracts")
@Controller()
export class EscrowsContractsController {
	constructor(private readonly _service: EscrowsContractsService) {}
}
