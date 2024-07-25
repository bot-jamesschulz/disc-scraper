import { type ListingTitle } from '../src/getPageData'

export default function isNewListings(oldListingsData: ListingTitle[], newListingsData: ListingTitle[] | undefined): boolean {
    const oldListingsSet = new Set(oldListingsData?.map((elem) => elem?.href));
    // console.log('new listings', newListingsData);
    // console.log('old listings', oldListingsData);
    // console.log('listings diff', newListingsData?.filter(el => !oldListingsSet.has(el.href)))
    return newListingsData?.some((newListing) => !oldListingsSet?.has(newListing?.href)) || false;
}