/** A Builder-authored validation message safe to display, distinct from internal errors. */
export class InvalidValueError extends Error { constructor(message:string){super(message);this.name="InvalidValueError";} }
