export const FORM_SUBMISSION_HEADER='x-nocode-form-submission';
export type FormSubmission={context?:string;key?:string};
// One intent per open form, retained through unknown network results and validation retries.
export function newFormSubmission(context?:string):FormSubmission{return {context};}
