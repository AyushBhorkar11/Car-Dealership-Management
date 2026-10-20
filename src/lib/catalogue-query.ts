import { queryOptions } from '@tanstack/react-query';
import { getCatalogue } from './catalogue.functions';
export const catalogueQuery = queryOptions({queryKey:['catalogue'],queryFn:()=>getCatalogue(),staleTime:30000});
