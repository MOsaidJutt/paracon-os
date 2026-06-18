export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export class UnauthorisedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorisedError";
  }
}
