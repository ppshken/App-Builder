export const MAX_FORM_IMAGE_COUNT = 200;
export const MAX_FORM_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_FORM_JSON_BYTES = 5 * 1024 * 1024;
export const FORM_IMAGE_TOKEN = /^\/api\/images\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export type FormImageDescriptor = {token:string;table:string;column:string};
