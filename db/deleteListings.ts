import supabase from './config';
import { TableNames } from './types';

export default async function dbDeleteListings(table: TableNames, retailerHostname: string): Promise<void> {
    if (!supabase) {
        throw new Error('No connection to supbase')
    }

    const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('retailer', retailerHostname)

    if (error) console.log(error)

    console.log('data', data)
};
