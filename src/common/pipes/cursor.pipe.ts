import { Cursor, cursorFromString, emptyCursor } from "../dto/envelopes";
import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class ParseCursorPipe
	implements PipeTransform<string | undefined, Cursor>
{
	transform(value: string | undefined): Cursor {
		if (!value) {
			return emptyCursor;
		}
		try {
			return cursorFromString(value);
		} catch {
			throw new BadRequestException("Invalid cursor");
		}
	}
}
