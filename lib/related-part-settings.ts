import type {Column} from './columns';
export function relatedPartDraft(column:Column):Partial<Column>{
 const valid=column.is_part_of?column.part_valid_if?.trim()||'':'';
 return {is_part_of:!!column.is_part_of,part_valid_if:column.related_required?(valid?'AND(COUNT([_THIS]) > 0, ('+valid+'))':'COUNT([_THIS]) > 0'):column.part_valid_if||'',part_show_if:column.part_show_if||'',part_add_if:column.part_add_if||''};
}
