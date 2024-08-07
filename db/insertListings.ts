
import supabase from './config';
import { TableNames } from './types';
import { type Listing } from "../utils/validateListings";

export default async function dbInsertListings(table: TableNames, rows: Listing[]) {
    console.log('inserting into db:', 'table:');
    console.log('table', table);

    if (!supabase) {
        throw new Error('No connection to supabase')
    }

    const res = await supabase
        .from(table)
        .insert(rows)
        .select()
   console.log('Insert results:', res);
};
