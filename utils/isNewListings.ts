import { type ListingTitle } from '../src/getPageListings'
const minNewListings = 5;

export default function isNewListings(oldListingsData: ListingTitle[], newListingsData: ListingTitle[] | undefined): boolean {
    const oldListingsSet = new Set(oldListingsData?.map((elem) => elem?.href));
    // console.log('new listings', newListingsData);
    // console.log('old listings', oldListingsData);
    // console.log('listings diff', newListingsData?.filter(el => !oldListingsSet.has(el.href)))

    const difListings = newListingsData?.filter((newListing) => !oldListingsSet?.has(newListing?.href));
    return difListings && difListings.length >= minNewListings ? true : false;
}