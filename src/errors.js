// Thrown for problems the caller can fix (bad input, duplicate report). Anything else is an
// infrastructure failure and must not leak details to the response.
export class UserError extends Error {}
