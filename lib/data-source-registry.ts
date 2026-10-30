import {previewExternalConnection,collectExternalRecords} from './external-connector';
// Server-only connector registry. New protocols must implement the same bounded read contract.
export const DATA_SOURCE_CONNECTORS={EXTERNAL_REST_API:{kind:'EXTERNAL_REST_API' as const,preview:previewExternalConnection,collect:collectExternalRecords}} as const;
export const restDataConnector=DATA_SOURCE_CONNECTORS.EXTERNAL_REST_API;
