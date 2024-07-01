import { type ListingTitle } from './getPageListings'

export default function isNewListings(oldListingsData: ListingTitle[], newListingsData: ListingTitle[] | undefined): boolean {
    console.log('old', oldListingsData)
    console.log('new', newListingsData)
    const oldListingsSet = new Set(oldListingsData?.map((elem) => elem?.href));
    console.log(newListingsData?.filter(el => !oldListingsSet.has(el.href)))
    return newListingsData?.some((newListing) => !oldListingsSet?.has(newListing?.href)) || false;
}