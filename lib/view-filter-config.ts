import type {Column} from './columns';
export const canQuickFilter=(c:Column)=>!c.is_virtual&&!['image','signature','file','list','enumlist','longtext','latlong'].includes(c.type);
