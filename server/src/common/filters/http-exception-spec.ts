import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";
import { Response } from "express";

describe("HttpExceptionFilter", () => {
	let httpExceptionFilter: HttpExceptionFilter;

	beforeEach(() => {
		httpExceptionFilter = new HttpExceptionFilter();
	});

	it("should handle HttpException and send the correct status and error message", () => {
		const mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as unknown as Response;

		const mockHost = {
			switchToHttp: jest.fn().mockReturnValue({
				getResponse: () => mockResponse,
			}),
		} as unknown as ArgumentsHost;

		const exception = new HttpException(
			["Custom error message"],
			HttpStatus.BAD_REQUEST,
		);

		httpExceptionFilter.catch(exception, mockHost);

		expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
		expect(mockResponse.json).toHaveBeenCalledWith({
			errors: ["Custom error message"],
		});
	});

	it("should handle unknown exception and default to internal server error", () => {
		const mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as unknown as Response;

		const mockHost = {
			switchToHttp: jest.fn().mockReturnValue({
				getResponse: () => mockResponse,
			}),
		} as unknown as ArgumentsHost;

		const exception = new Error("Unknown error");

		httpExceptionFilter.catch(exception, mockHost);

		expect(mockResponse.status).toHaveBeenCalledWith(
			HttpStatus.INTERNAL_SERVER_ERROR,
		);
		expect(mockResponse.json).toHaveBeenCalledWith({
			errors: ["Unknown error"],
		});
	});

	it("should handle exceptions with status and message properties", () => {
		const mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as unknown as Response;

		const mockHost = {
			switchToHttp: jest.fn().mockReturnValue({
				getResponse: () => mockResponse,
			}),
		} as unknown as ArgumentsHost;

		const exception = {
			status: HttpStatus.UNAUTHORIZED,
			message: "Unauthorized access",
		};

		httpExceptionFilter.catch(exception, mockHost);

		expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
		expect(mockResponse.json).toHaveBeenCalledWith({
			errors: ["Unauthorized access"],
		});
	});

	it("should handle HttpException with string response", () => {
		const mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as unknown as Response;

		const mockHost = {
			switchToHttp: jest.fn().mockReturnValue({
				getResponse: () => mockResponse,
			}),
		} as unknown as ArgumentsHost;

		const exception = new HttpException("Error string", HttpStatus.NOT_FOUND);

		httpExceptionFilter.catch(exception, mockHost);

		expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
		expect(mockResponse.json).toHaveBeenCalledWith({
			errors: ["Error string"],
		});
	});

	it("should handle HttpException with empty message array", () => {
		const mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as unknown as Response;

		const mockHost = {
			switchToHttp: jest.fn().mockReturnValue({
				getResponse: () => mockResponse,
			}),
		} as unknown as ArgumentsHost;

		const exception = new HttpException([], HttpStatus.BAD_REQUEST);

		httpExceptionFilter.catch(exception, mockHost);

		expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
		expect(mockResponse.json).toHaveBeenCalledWith({ errors: [] });
	});
});
