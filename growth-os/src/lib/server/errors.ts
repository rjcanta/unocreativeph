export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "APP_ERROR",
    /** Retrying will not help (policy blocks, missing capability, bad input). */
    public retryable = true,
  ) {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(what: string) {
    super(`${what} not found in this workspace.`, "NOT_FOUND", false);
  }
}
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION", false);
  }
}
export class PolicyError extends AppError {
  constructor(message: string) {
    super(message, "POLICY_BLOCKED", false);
  }
}
export class CapabilityNotEnabledError extends AppError {
  constructor(message: string) {
    super(message, "CAPABILITY_NOT_ENABLED", false);
  }
}
