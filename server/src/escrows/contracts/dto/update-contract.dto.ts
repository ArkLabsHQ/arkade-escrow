import {ApiProperty} from "@nestjs/swagger";
import {IsOptional, IsString} from "class-validator";

export class UpdateContractDto {
    @ApiProperty({ description: "ARK address to receive the funds, only the receiver can set this", example: "ark1qpt0syx7j0jspe69kldtljet0x9jz6ns4xw70m0w0xl30yfhn0mz6e9gu6zr3epntklwz8h330j8m03u27a4lqnc4dc7z829kxczves5stw760"})
    @IsString()
    @IsOptional()
    releaseAddress?: string;
}